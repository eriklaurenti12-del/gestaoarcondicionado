import { supabase } from '@/integrations/supabase/client';
import { endOfMonth, format } from 'date-fns';

export interface MonthDataset {
  monthYYYYMM: string;
  monthLabel: string;
  sales: any[];
  records: any[];
  fixedExpenses: any[];
  payroll: { name: string; salary: number; vale: number; total: number; expense_category: string }[];
  providerCosts: { name: string; monthly_cost: number }[];
  totals: {
    receitaServicos: number;
    receitaProdutos: number;
    receitaOutras: number;
    receitaBruta: number;
    despesasFixas: number;
    salarios: number;
    vales: number;
    prestadores: number;
    saques: number;
    reservas: number;
    despesasTotais: number;
    lucroLiquido: number;
  };
}

const buildRange = (monthYYYYMM: string) => {
  const [yr, mo] = monthYYYYMM.split('-').map(Number);
  const start = `${monthYYYYMM}-01`;
  const end = format(endOfMonth(new Date(yr, mo - 1, 1)), 'yyyy-MM-dd');
  return { start, end, endIso: `${end}T23:59:59.999Z` };
};

/**
 * Aggregates everything that hits a month's books, broken down by source
 * (sales, fixed expenses, employee salaries/vale, provider costs) so we
 * can emit a precise CSV/PDF the user can hand to their accountant.
 */
export async function buildMonthDataset(
  userId: string,
  monthYYYYMM: string
): Promise<MonthDataset> {
  const { start, end, endIso } = buildRange(monthYYYYMM);

  const [salesRes, recordsRes, expensesRes, teamRes, settingsRes] = await Promise.all([
    supabase.from('sales')
      .select('id, sale_date, sale_price, qty, total_profit, payment_method, appointment_id, products(name), clients(name)')
      .eq('user_id', userId)
      .gte('sale_date', start).lte('sale_date', endIso)
      .order('sale_date', { ascending: true }),
    supabase.from('financial_records')
      .select('id, type, amount, description, payment_method, category, record_date, appointment_id')
      .eq('user_id', userId)
      .gte('record_date', start).lte('record_date', endIso)
      .order('record_date', { ascending: true }),
    supabase.from('fixed_expenses')
      .select('id, expense_date, category, description, helper_name, amount, is_recurring')
      .eq('user_id', userId)
      .gte('expense_date', start).lte('expense_date', end)
      .order('expense_date', { ascending: true }),
    supabase.from('team_members')
      .select('id, name, monthly_salary, vale_amount, expense_category, is_active')
      .eq('user_id', userId).eq('is_active', true),
    supabase.from('admin_settings').select('value').eq('key', 'service_providers').maybeSingle(),
  ]);

  const sales = salesRes.data || [];
  const records = recordsRes.data || [];
  const fixedExpenses = expensesRes.data || [];
  const team = teamRes.data || [];
  let providers: any[] = [];
  if (settingsRes.data?.value) {
    try { providers = JSON.parse(settingsRes.data.value); } catch { providers = []; }
  }

  const payroll = team.map((t: any) => {
    const salary = Number(t.monthly_salary) || 0;
    const vale = Number(t.vale_amount) || 0;
    return {
      name: t.name,
      salary,
      vale,
      total: salary + vale,
      expense_category: t.expense_category || 'Salário',
    };
  });

  const providerCosts = providers
    .filter((p: any) => p.active !== false && p.is_recurring_expenses && Number(p.monthly_cost) > 0)
    .map((p: any) => ({ name: p.name, monthly_cost: Number(p.monthly_cost) || 0 }));

  // Totalizers from financial_records (entradas)
  const entradas = records.filter((r: any) => r.type === 'entrada');
  const receitaServicos = entradas.filter((r: any) => r.category === 'Serviço')
    .reduce((s, r: any) => s + Number(r.amount), 0);
  const receitaProdutos = entradas.filter((r: any) => r.category === 'Produto')
    .reduce((s, r: any) => s + Number(r.amount), 0);
  const receitaOutras = entradas.filter((r: any) => r.category !== 'Serviço' && r.category !== 'Produto')
    .reduce((s, r: any) => s + Number(r.amount), 0);
  const receitaBruta = receitaServicos + receitaProdutos + receitaOutras;

  const saques = records.filter((r: any) => r.type === 'saque').reduce((s, r: any) => s + Number(r.amount), 0);
  const reservas = records.filter((r: any) => r.type === 'reserva').reduce((s, r: any) => s + Number(r.amount), 0);

  // Tag-based segmentation for fixed_expenses
  let salarios = 0;
  let vales = 0;
  let prestadores = 0;
  let despesasFixasOutras = 0;
  for (const e of fixedExpenses) {
    const desc: string = (e.description || '');
    const amt = Number(e.amount) || 0;
    if (/^auto:team:/i.test(desc) && /\bvale\b/i.test(desc)) vales += amt;
    else if (/^auto:team:/i.test(desc)) salarios += amt;
    else if (/^auto:provider:/i.test(desc)) prestadores += amt;
    else if ((e.category || '').toLowerCase() === 'vale') vales += amt;
    else despesasFixasOutras += amt;
  }
  const despesasFixas = salarios + vales + prestadores + despesasFixasOutras;
  const despesasTotais = despesasFixas + saques + reservas;
  const lucroLiquido = receitaBruta - despesasTotais;

  const monthLabel = (() => {
    const [yr, mo] = monthYYYYMM.split('-').map(Number);
    return format(new Date(yr, mo - 1, 1), 'MM/yyyy');
  })();

  return {
    monthYYYYMM,
    monthLabel,
    sales,
    records,
    fixedExpenses,
    payroll,
    providerCosts,
    totals: {
      receitaServicos, receitaProdutos, receitaOutras, receitaBruta,
      despesasFixas, salarios, vales, prestadores,
      saques, reservas, despesasTotais, lucroLiquido,
    },
  };
}

/* ============================ CSV ============================ */

const csvEscape = (v: any): string => {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};
const fmt = (n: number) => Number(n || 0).toFixed(2).replace('.', ',');
const csvRow = (cols: any[]) => cols.map(csvEscape).join(';');

export interface CsvFilters {
  vendas: boolean;
  despesasFixas: boolean;
  salarios: boolean;
  vale: boolean;
  prestadores: boolean;
  movimentacoes: boolean;
}

export const DEFAULT_CSV_FILTERS: CsvFilters = {
  vendas: true, despesasFixas: true, salarios: true, vale: true,
  prestadores: true, movimentacoes: true,
};

export function buildMonthCsv(ds: MonthDataset, filters: CsvFilters = DEFAULT_CSV_FILTERS): string {
  const lines: string[] = [];
  lines.push(`Extrato Financeiro;${ds.monthLabel}`);
  lines.push('');

  // ---- Totalizers (always on top) ----
  lines.push('RESUMO;');
  lines.push(csvRow(['Receita Serviços', fmt(ds.totals.receitaServicos)]));
  lines.push(csvRow(['Receita Produtos', fmt(ds.totals.receitaProdutos)]));
  lines.push(csvRow(['Outras Entradas', fmt(ds.totals.receitaOutras)]));
  lines.push(csvRow(['RECEITA BRUTA', fmt(ds.totals.receitaBruta)]));
  lines.push(csvRow(['Salários', fmt(ds.totals.salarios)]));
  lines.push(csvRow(['Vales/Adiantamentos', fmt(ds.totals.vales)]));
  lines.push(csvRow(['Prestadores (custo fixo)', fmt(ds.totals.prestadores)]));
  lines.push(csvRow(['Despesas Fixas', fmt(ds.totals.despesasFixas)]));
  lines.push(csvRow(['Saques (saídas avulsas)', fmt(ds.totals.saques)]));
  lines.push(csvRow(['Reservas', fmt(ds.totals.reservas)]));
  lines.push(csvRow(['DESPESAS TOTAIS', fmt(ds.totals.despesasTotais)]));
  lines.push(csvRow(['LUCRO LÍQUIDO', fmt(ds.totals.lucroLiquido)]));
  lines.push('');

  if (filters.vendas && ds.sales.length) {
    lines.push('VENDAS (sales);');
    lines.push(csvRow(['Data', 'Cliente', 'Produto/Serviço', 'Qtd', 'Preço', 'Lucro', 'Pgto']));
    for (const s of ds.sales) {
      lines.push(csvRow([
        format(new Date(s.sale_date), 'dd/MM/yyyy'),
        s.clients?.name || '-',
        s.products?.name || '-',
        s.qty,
        fmt(s.sale_price),
        fmt(s.total_profit),
        s.payment_method || '-',
      ]));
    }
    const sub = ds.sales.reduce((acc, s) => acc + Number(s.sale_price), 0);
    lines.push(csvRow(['', '', '', '', 'TOTAL', fmt(sub)]));
    lines.push('');
  }

  if (filters.movimentacoes && ds.records.length) {
    lines.push('MOVIMENTAÇÕES FINANCEIRAS (financial_records);');
    lines.push(csvRow(['Data', 'Tipo', 'Categoria', 'Descrição', 'Pgto', 'Valor']));
    for (const r of ds.records) {
      lines.push(csvRow([
        format(new Date(r.record_date), 'dd/MM/yyyy'),
        r.type,
        r.category || '-',
        r.description || '-',
        r.payment_method || '-',
        fmt(r.amount),
      ]));
    }
    lines.push('');
  }

  if (filters.salarios || filters.vale) {
    const items = ds.payroll.filter(p => (filters.salarios && p.salary > 0) || (filters.vale && p.vale > 0));
    if (items.length) {
      lines.push('FOLHA DE PAGAMENTO (funcionários);');
      lines.push(csvRow(['Funcionário', 'Categoria', 'Salário', 'Vale', 'Total']));
      let ts = 0, tv = 0, tt = 0;
      for (const p of items) {
        lines.push(csvRow([p.name, p.expense_category, fmt(p.salary), fmt(p.vale), fmt(p.total)]));
        ts += p.salary; tv += p.vale; tt += p.total;
      }
      lines.push(csvRow(['', 'TOTAL', fmt(ts), fmt(tv), fmt(tt)]));
      lines.push('');
    }
  }

  if (filters.prestadores && ds.providerCosts.length) {
    lines.push('PRESTADORES (custo mensal fixo);');
    lines.push(csvRow(['Prestador', 'Custo Mensal']));
    let t = 0;
    for (const p of ds.providerCosts) {
      lines.push(csvRow([p.name, fmt(p.monthly_cost)]));
      t += p.monthly_cost;
    }
    lines.push(csvRow(['TOTAL', fmt(t)]));
    lines.push('');
  }

  if (filters.despesasFixas && ds.fixedExpenses.length) {
    lines.push('DESPESAS FIXAS (fixed_expenses);');
    lines.push(csvRow(['Data', 'Categoria', 'Descrição', 'Pessoa', 'Recorrente', 'Valor']));
    for (const e of ds.fixedExpenses) {
      lines.push(csvRow([
        format(new Date(e.expense_date + 'T12:00:00'), 'dd/MM/yyyy'),
        e.category,
        (e.description || '').replace(/^auto:[a-z]+:[^|\s]+\s*\|\s*\w+\s*\|\s*/i, ''),
        e.helper_name || '-',
        e.is_recurring ? 'Sim' : 'Não',
        fmt(e.amount),
      ]));
    }
    const sub = ds.fixedExpenses.reduce((s, e) => s + Number(e.amount), 0);
    lines.push(csvRow(['', '', '', '', 'TOTAL', fmt(sub)]));
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadCsv(filename: string, content: string) {
  // Prepend BOM so Excel detects UTF-8 properly
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ===================== DANFE / NF-e XML ===================== */

export interface DanfeItem {
  numero: number;
  descricao: string;
  ncm?: string;
  cfop?: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface DanfeParsed {
  chave?: string;
  numero?: string;
  serie?: string;
  dataEmissao?: string;
  emitente?: { nome?: string; cnpj?: string };
  destinatario?: { nome?: string; cnpj?: string };
  itens: DanfeItem[];
  valorProdutos: number;
  valorImpostos: number;
  valorTotal: number;
}

const xmlText = (el: Element | null, sel: string): string | undefined => {
  if (!el) return undefined;
  const f = el.querySelector(sel);
  return f?.textContent?.trim() || undefined;
};
const xmlNum = (el: Element | null, sel: string): number => {
  const v = xmlText(el, sel);
  return v ? Number(v) : 0;
};

export function parseDanfeXml(xml: string): DanfeParsed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('XML inválido');

  const inf = doc.querySelector('infNFe') || doc.querySelector('NFe') || doc.documentElement;
  const ide = inf.querySelector('ide');
  const emit = inf.querySelector('emit');
  const dest = inf.querySelector('dest');
  const total = inf.querySelector('total ICMSTot');

  const chave = (inf.getAttribute('Id') || '').replace(/^NFe/, '') || undefined;

  const itens: DanfeItem[] = [];
  const dets = inf.querySelectorAll('det');
  dets.forEach((d) => {
    const prod = d.querySelector('prod');
    if (!prod) return;
    const numero = Number(d.getAttribute('nItem') || '0');
    itens.push({
      numero,
      descricao: xmlText(prod, 'xProd') || '',
      ncm: xmlText(prod, 'NCM'),
      cfop: xmlText(prod, 'CFOP'),
      unidade: xmlText(prod, 'uCom'),
      quantidade: xmlNum(prod, 'qCom'),
      valorUnitario: xmlNum(prod, 'vUnCom'),
      valorTotal: xmlNum(prod, 'vProd'),
    });
  });

  return {
    chave,
    numero: xmlText(ide, 'nNF'),
    serie: xmlText(ide, 'serie'),
    dataEmissao: xmlText(ide, 'dhEmi') || xmlText(ide, 'dEmi'),
    emitente: { nome: xmlText(emit, 'xNome'), cnpj: xmlText(emit, 'CNPJ') || xmlText(emit, 'CPF') },
    destinatario: { nome: xmlText(dest, 'xNome'), cnpj: xmlText(dest, 'CNPJ') || xmlText(dest, 'CPF') },
    itens,
    valorProdutos: xmlNum(total, 'vProd'),
    valorImpostos: xmlNum(total, 'vTotTrib'),
    valorTotal: xmlNum(total, 'vNF'),
  };
}
