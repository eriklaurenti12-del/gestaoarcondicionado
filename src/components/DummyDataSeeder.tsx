import React, { useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Database, PlusCircle, AlertTriangle, Loader2, Eye, CheckCircle2,
  Users, Package, Wrench, CalendarDays, DollarSign, UserCog, Truck, MapPin, FileText
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { recordFinancialEntry } from "@/utils/financialHelpers";
import { reconcileFinancialMonth } from "@/utils/recurringSync";
import { getUserPref, setUserPref } from "@/utils/userPreferences";

// ---- Categories the user can select ----
// Cada categoria abaixo está mapeada a uma aba/funcionalidade REAL existente no sistema.
// `tab` = onde a aba aparece para o usuário. `tables` = tabelas reais que o reset varre.
type Cat =
  | 'clientes' | 'produtos' | 'servicos' | 'agendas'
  | 'financeiro' | 'funcionarios' | 'prestadores' | 'rotas' | 'impostos'
  | 'fornecedores';

const CATEGORIES: Array<{ key: Cat; label: string; desc: string; icon: React.ComponentType<any>; tab: string; tables: string[] }> = [
  { key: 'clientes',     label: 'Clientes',     desc: '8 clientes (PF + PJ)',                  icon: Users,        tab: 'Cadastros › Clientes',       tables: ['clients'] },
  { key: 'produtos',     label: 'Produtos',     desc: '3 itens em estoque',                    icon: Package,      tab: 'Cadastros › Estoque',        tables: ['products'] },
  { key: 'servicos',     label: 'Serviços',     desc: '3 serviços com imagens',                icon: Wrench,       tab: 'Cadastros › Serviços',       tables: ['products'] },
  { key: 'agendas',      label: 'Agenda',       desc: '2 hoje + 1 passado concluído',          icon: CalendarDays, tab: 'Agenda + Agenda Online',     tables: ['appointments','online_bookings','online_booking_settings'] },
  { key: 'financeiro',   label: 'Financeiro',   desc: 'Venda + entrada do concluído',          icon: DollarSign,   tab: 'Financeiro',                 tables: ['sales','financial_records','installments'] },
  { key: 'funcionarios', label: 'Funcionários', desc: '3 funcionários (salário/vale)',         icon: UserCog,      tab: 'Equipe › Funcionários',      tables: ['team_members'] },
  { key: 'prestadores',  label: 'Prestadores',  desc: '3 prestadores + gastos diários',        icon: Truck,        tab: 'Equipe › Prestadores',       tables: ['fixed_expenses'] },
  { key: 'rotas',        label: 'Rotas',        desc: 'Marca prestador nos agendamentos',      icon: MapPin,       tab: 'Agenda › Rotas',             tables: ['appointments'] },
  { key: 'impostos',     label: 'Impostos',     desc: 'Registro do mês + folha + provedores', icon: FileText,     tab: 'Financeiro › Impostos',      tables: ['tax_records'] },
  { key: 'fornecedores', label: 'Fornecedores', desc: '3 fornecedores cadastrados',            icon: Truck,        tab: 'Cadastros › Fornecedores',   tables: ['suppliers'] },
];

const ALL_ON: Record<Cat, boolean> = CATEGORIES.reduce((acc, c) => ({ ...acc, [c.key]: true }), {} as any);
const PREF_KEY = 'seeder_categories';

const DummyDataSeeder: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [picker, setPicker] = useState<Record<Cat, boolean>>(ALL_ON);
  const [resetReport, setResetReport] = useState<Array<{ table: string; deleted: number; status: 'ok' | 'empty' | 'error'; message?: string }> | null>(null);
  const queryClient = useQueryClient();

  // Carrega preferência salva
  useEffect(() => {
    (async () => {
      const saved = await getUserPref<Record<Cat, boolean>>(PREF_KEY);
      if (saved && typeof saved === 'object') {
        setPicker({ ...ALL_ON, ...saved });
      }
    })();
  }, []);

  // Salva preferência sempre que mudar (debounced via microtask)
  useEffect(() => {
    const t = setTimeout(() => { setUserPref(PREF_KEY, picker); }, 400);
    return () => clearTimeout(t);
  }, [picker]);

  const toggle = (k: Cat) => setPicker((p) => ({ ...p, [k]: !p[k] }));
  const setAll = (v: boolean) => setPicker(CATEGORIES.reduce((a, c) => ({ ...a, [c.key]: v }), {} as Record<Cat, boolean>));

  const preview = useMemo(() => {
    const lines: Array<{ label: string; count: number; detail: string }> = [];
    if (picker.clientes)     lines.push({ label: 'Clientes',     count: 4, detail: 'Carlos, Ana, Roberto, Empresa ABC' });
    if (picker.produtos)     lines.push({ label: 'Produtos',     count: 1, detail: 'Ar Split 12000 BTU (R$ 2.500)' });
    if (picker.servicos)     lines.push({ label: 'Serviços',     count: 2, detail: 'Limpeza R$ 250 · Instalação R$ 650' });
    if (picker.agendas)      lines.push({ label: 'Agendamentos', count: 3, detail: '2 pendentes hoje + 1 concluído (-2 dias)' });
    if (picker.financeiro)   lines.push({ label: 'Financeiro',   count: 2, detail: '1 venda + 1 entrada do concluído' });
    if (picker.funcionarios) lines.push({ label: 'Funcionários', count: 1, detail: 'Salário R$ 1.800 + Vale R$ 200' });
    if (picker.prestadores)  lines.push({ label: 'Prestadores',  count: 3, detail: 'Custo mensal recorrente' });
    if (picker.rotas)        lines.push({ label: 'Rotas',        count: 2, detail: 'Marca [PRESTADOR:nome] nos agendamentos' });
    if (picker.impostos)     lines.push({ label: 'Impostos',     count: 1, detail: 'Registro do mês corrente com folha' });
    if (picker.fornecedores) lines.push({ label: 'Fornecedores', count: 3, detail: 'Distribuidoras com contato' });
    return lines;
  }, [picker]);

  const hasAny = preview.length > 0;

  const seed = async () => {
    if (!hasAny) {
      toast.error('Selecione pelo menos 1 categoria.');
      return;
    }
    setLoading(true);
    setPreviewOpen(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) return;
      const userId = session.user.id;

      const now = new Date();
      const monthYYYYMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthStart = `${monthYYYYMM}-01`;

      // Helpers aleatórios
      const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
      const fakePhone = () => {
        const ddd = rand(['11','21','16','19','27','31','41','47','51','61','71','81','85']);
        const p1 = String(90000 + Math.floor(Math.random()*9999)).padStart(5,'0');
        const p2 = String(Math.floor(Math.random()*9999)).padStart(4,'0');
        return `${ddd}9${p1.slice(0,4)}${p2}`.slice(0,11);
      };
      const FAKE_NAMES = [
        'Carlos Oliveira','Ana Beatriz','Roberto Santos','Juliana Costa','Pedro Almeida',
        'Mariana Souza','Felipe Rocha','Camila Ribeiro','Lucas Ferreira','Patrícia Lima',
        'Bruno Carvalho','Fernanda Martins','Rafael Mendes','Gabriela Pinto','Thiago Araújo'
      ];

      // --- Prestadores (admin_settings JSON) ---
      const providers = [
        { id: crypto.randomUUID(), name: "Erik Laurenti (TESTE)", phone: "16992600631", specialty: "Geral",       cost_per_hour: 50, monthly_cost: 1200, is_recurring_expenses: true, color: "#3b82f6", active: true, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: "Marcio Técnico (TESTE)", phone: "11988887777", specialty: "Instalação", cost_per_hour: 45, monthly_cost: 800,  is_recurring_expenses: true, color: "#10b981", active: true, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: "Equipe Alpha (TESTE)",  phone: "11977776666", specialty: "Limpeza",    cost_per_hour: 40, monthly_cost: 600,  is_recurring_expenses: true, color: "#f59e0b", active: true, created_at: new Date().toISOString() },
      ];
      if (picker.prestadores) {
        await supabase.from('admin_settings').upsert({ key: 'service_providers', value: JSON.stringify(providers), description: 'Simulação' }, { onConflict: 'key' });

        // Gastos diários de combustível + alimentação por prestador (últimos 5 dias)
        const dailyExpenses: any[] = [];
        for (let d = 0; d < 5; d++) {
          const day = new Date(now); day.setDate(now.getDate() - d);
          const dateStr = day.toISOString().slice(0,10);
          for (const p of providers) {
            dailyExpenses.push({
              user_id: userId,
              category: 'Combustível',
              description: `Combustível ${p.name}`,
              amount: 30 + Math.floor(Math.random()*40),
              expense_date: dateStr,
              helper_name: p.name,
              is_recurring: false,
            });
            dailyExpenses.push({
              user_id: userId,
              category: 'Alimentação',
              description: `Alimentação ${p.name}`,
              amount: 18 + Math.floor(Math.random()*22),
              expense_date: dateStr,
              helper_name: p.name,
              is_recurring: false,
            });
          }
        }
        if (dailyExpenses.length) {
          await supabase.from('fixed_expenses').insert(dailyExpenses);
        }
      }

      // --- Funcionários (3 com nomes/telefones aleatórios) ---
      if (picker.funcionarios) {
        const funcs = Array.from({ length: 3 }).map((_, i) => ({
          user_id: userId,
          name: `${rand(FAKE_NAMES)} (TESTE)`,
          phone: fakePhone(),
          role: i === 0 ? 'gerente' : 'sistema',
          monthly_salary: 1500 + Math.floor(Math.random()*1500),
          vale_amount: 100 + Math.floor(Math.random()*200),
          expense_category: 'Salário',
          is_active: true,
        }));
        await supabase.from('team_members').insert(funcs);
      }

      // --- Clientes (8 aleatórios) ---
      let createdClients: any[] = [];
      if (picker.clientes) {
        const used = new Set<string>();
        const fakeClients = Array.from({ length: 8 }).map((_, i) => {
          let n = rand(FAKE_NAMES); while (used.has(n)) n = rand(FAKE_NAMES); used.add(n);
          return {
            name: `${n} (TESTE)`,
            telefone: fakePhone(),
            address: rand(['Av. Paulista, 1000 - SP','Rua Augusta, 500 - SP','Av. Atlântica, 200 - RJ','Rua das Flores, 88 - SP','Av. Brasil, 1500 - RJ','Rua XV, 320 - PR']),
            user_id: userId,
            is_company: i === 7,
          };
        });
        const { data, error } = await supabase.from('clients').insert(fakeClients).select();
        if (error) throw error;
        createdClients = data || [];
      }

      // --- Produtos / Serviços (com imagens) ---
      let createdProducts: any[] = [];
      const wantProducts = picker.produtos || picker.servicos;
      if (wantProducts) {
        const rows: any[] = [];
        if (picker.produtos) {
          rows.push({ name: "Ar Split 12000 BTU (TESTE)", type: "piece", price: 2500, cost_price: 1800, qty: 10, user_id: userId, storage_location: "Câmara 1", min_stock: 2, image_url: 'https://images.unsplash.com/photo-1631545806609-cda3ecde29bc?w=400' });
          rows.push({ name: "Ar Split 9000 BTU (TESTE)",  type: "piece", price: 1900, cost_price: 1300, qty: 6,  user_id: userId, storage_location: "Câmara 1", min_stock: 2, image_url: 'https://images.unsplash.com/photo-1605374551406-b8c5d7c5e2c1?w=400' });
          rows.push({ name: "Suporte Inox (TESTE)",       type: "piece", price: 90,   cost_price: 35,   qty: 25, user_id: userId, storage_location: "Câmara 2", min_stock: 5, image_url: 'https://images.unsplash.com/photo-1581094271901-8022df4466f9?w=400' });
        }
        if (picker.servicos) {
          rows.push({ name: "Limpeza Completa (TESTE)",   type: "service", price: 250, cost_price: 50,  user_id: userId, service_duration: 90,  warranty_months: 6,  qty: 0, image_url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400' });
          rows.push({ name: "Instalação Padrão (TESTE)", type: "service", price: 650, cost_price: 200, user_id: userId, service_duration: 120, warranty_months: 12, qty: 0, image_url: 'https://images.unsplash.com/photo-1597149961419-cc6e095faf95?w=400' });
          rows.push({ name: "Manutenção Preventiva (TESTE)", type: "service", price: 320, cost_price: 80, user_id: userId, service_duration: 60, warranty_months: 3, qty: 0, image_url: 'https://images.unsplash.com/photo-1607400201515-c2c41c07d307?w=400' });
        }
        const { data, error } = await supabase.from('products').insert(rows).select();
        if (error) throw error;
        createdProducts = data || [];
      }

      // --- Configuração da Agenda Online (puxa horário da empresa) ---
      if (picker.agendas) {
        await supabase.from('online_booking_settings').upsert({
          user_id: userId,
          enabled: true,
          weekdays: { sun: false, mon: true, tue: true, wed: true, thu: true, fri: true, sat: true },
          start_time: '08:00',
          end_time: '18:00',
          slot_minutes: 30,
          lunch_start: '12:00',
          lunch_end: '13:00',
          min_advance_hours: 2,
          max_advance_days: 30,
          auto_confirm: false,
        } as any, { onConflict: 'user_id' });

        // Agendamentos online pendentes (vindos do PublicBooking)
        const onlineRows = Array.from({ length: 3 }).map(() => {
          const day = new Date(now); day.setDate(now.getDate() + 1 + Math.floor(Math.random()*5));
          const hour = 9 + Math.floor(Math.random()*8);
          return {
            user_id: userId,
            client_name: `${rand(FAKE_NAMES)} (ONLINE)`,
            client_phone: fakePhone(),
            client_email: null,
            service_name: rand(['Limpeza Completa','Instalação Padrão','Manutenção Preventiva']),
            preferred_date: day.toISOString().slice(0,10),
            preferred_time: `${String(hour).padStart(2,'0')}:00`,
            payment_method: rand(['pix','dinheiro','cartao_credito']),
            notes: '[DUMMY] Solicitação online de teste',
            status: 'pendente',
          };
        });
        await supabase.from('online_bookings').insert(onlineRows);
      }


      // --- Agendamentos (precisa de clientes + serviços) ---
      let createdAppts: any[] = [];
      if (picker.agendas && createdClients.length > 0) {
        const services = createdProducts.filter((p) => p.type === 'service');
        if (services.length === 0) {
          // Garante pelo menos um serviço para o agendamento concluído
          const { data: extra } = await supabase.from('products').insert([{
            name: "Serviço TESTE", type: "service", price: 300, cost_price: 80,
            user_id: userId, service_duration: 60, qty: 0,
          }]).select();
          if (extra) services.push(...extra);
        }
        const fakeAppts = createdClients.slice(0, 3).map((c, i) => {
          const apptDate = new Date(now);
          if (i === 0) apptDate.setHours(9, 0, 0, 0);
          else if (i === 1) apptDate.setHours(14, 30, 0, 0);
          else apptDate.setDate(now.getDate() - 2);
          const provider = picker.rotas ? providers[i % providers.length] : null;
          return {
            client_id: c.id,
            service_id: services[i % services.length]?.id,
            appointment_date: apptDate.toISOString(),
            status: i < 2 ? 'pendente' : 'concluido',
            notes: provider
              ? `[DUMMY] Rota TESTE. [PRESTADOR:${provider.name}]`
              : `[DUMMY] Agendamento TESTE`,
            user_id: userId,
          };
        });
        const { data, error } = await supabase.from('appointments').insert(fakeAppts).select();
        if (error) throw error;
        createdAppts = data || [];
      }

      // --- Financeiro: venda + entrada IDEMPOTENTES (appointment_id) ---
      if (picker.financeiro) {
        const concluded = createdAppts.find((a) => a.status === 'concluido');
        if (concluded) {
          const service = createdProducts.find((p) => p.id === concluded.service_id);
          const price = Number(service?.price || 300);
          const cost  = Number(service?.cost_price || 80);

          // Venda (dedup feita manualmente: só insere se não existir)
          const { data: existingSale } = await supabase
            .from('sales').select('id').eq('appointment_id', concluded.id).maybeSingle();
          if (!existingSale) {
            await (supabase.from('sales') as any).insert({
              user_id: userId,
              appointment_id: concluded.id,
              client_id: concluded.client_id,
              product_id: concluded.service_id,
              qty: 1,
              sale_price: price,
              total_profit: price - cost,
              payment_method: 'Crédito',
              sale_date: concluded.appointment_date,
            });
          }

          // Entrada (recordFinancialEntry já é idempotente em appointment_id+type)
          await recordFinancialEntry({
            userId,
            appointmentId: concluded.id,
            type: 'entrada',
            amount: price,
            description: `Recebimento: ${service?.name || 'Serviço'}`,
            category: 'Serviço',
            paymentMethod: 'PIX',
            recordDate: concluded.appointment_date,
          });
        }

        // --- Venda manual avulsa (PDV sem agendamento) — testa fluxo standalone ---
        const product = createdProducts.find((p) => p.type === 'piece');
        const cli = createdClients[1] || createdClients[0];
        if (product && cli) {
          const price = Number(product.price || 0);
          const cost = Number(product.cost_price || 0);
          const saleDate = new Date(now); saleDate.setHours(15, 0, 0, 0);
          const { data: manualSale } = await (supabase.from('sales') as any).insert({
            user_id: userId,
            appointment_id: null,
            client_id: cli.id,
            product_id: product.id,
            qty: 1,
            sale_price: price,
            total_profit: price - cost,
            payment_method: 'PIX',
            sale_date: saleDate.toISOString(),
          }).select().single();
          if (manualSale) {
            await recordFinancialEntry({
              userId,
              saleId: manualSale.id,
              type: 'entrada',
              amount: price,
              description: `[auto:sale#${manualSale.id}] Venda PDV: ${product.name}`,
              category: 'Produto',
              paymentMethod: 'PIX',
              recordDate: saleDate.toISOString(),
            } as any);
          }
        }
      }

      // --- Reconciliação do mês: garante recorrentes + remove duplicatas ---
      // Roda sempre que o usuário pediu funcionarios/prestadores/financeiro/agendas/impostos.
      if (picker.financeiro || picker.funcionarios || picker.prestadores || picker.agendas || picker.impostos) {
        await reconcileFinancialMonth(userId, monthYYYYMM, 'manual');
      }

      // --- Impostos do mês corrente ---
      if (picker.impostos) {
        const { data: existingTax } = await supabase
          .from('tax_records').select('id')
          .eq('user_id', userId).eq('month_year', monthYYYYMM).maybeSingle();

        const payroll = picker.funcionarios ? [{
          name: 'Funcionário TESTE', salary: 1800, vale: 200,
          inss: 1800 * 0.08, fgts: 1800 * 0.08, total: 1800 + 200,
        }] : [];
        const providerCosts = picker.prestadores ? providers.map((p) => ({
          id: p.id, name: p.name, monthly_cost: p.monthly_cost,
        })) : [];

        if (!existingTax) {
          await supabase.from('tax_records').insert({
            user_id: userId,
            month_year: monthYYYYMM,
            record_date: monthStart,
            total_revenue: picker.financeiro ? 300 : 0,
            revenue_from_services: picker.financeiro ? 300 : 0,
            revenue_from_products: 0,
            material_expenses: 0,
            total_expenses: payroll.reduce((s, p) => s + p.total, 0)
              + providerCosts.reduce((s, p) => s + Number(p.monthly_cost || 0), 0),
            payroll_data: payroll as any,
            provider_costs: providerCosts as any,
            xml_imports: [] as any,
            employee_fgts: payroll.reduce((s, p) => s + p.fgts, 0),
            employee_inss: payroll.reduce((s, p) => s + p.inss, 0),
            notes: 'Gerado pela simulação',
          });
        }
      }

      // --- Fornecedores ---
      if (picker.fornecedores) {
        const sups = ['Distribuidora Frio Norte','AC Parts Brasil','Refricenter SP'].map((n) => ({
          user_id: userId,
          name: `${n} (TESTE)`,
          contact: rand(FAKE_NAMES),
          email: `contato${Math.floor(Math.random()*999)}@${n.toLowerCase().replace(/\s+/g,'')}.com.br`,
          contact_person: rand(FAKE_NAMES),
          payment_terms: rand(['30 dias','15 dias','À vista']),
        }));
        await supabase.from('suppliers').insert(sups);
      }

      toast.success(`✅ Simulação aplicada (${preview.length} categoria(s)).`);
      queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error("Erro na simulação: " + (error.message || error));
    } finally {
      setLoading(false);
    }
  };

  const hardReset = async () => {
    if (!window.confirm("⚠️ Apaga TUDO da sua conta (clientes, agenda, financeiro, prestadores, agenda online, configurações). Continuar?")) return;
    if (!window.confirm("Confirmação final: ação irreversível.")) return;

    setLoading(true);
    setResetReport(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) return;
      const userId = session.user.id;

      // Marca um "freeze" curto para impedir que o auto-reconcile do Financeiro
      // recrie despesas recorrentes enquanto o reset está em andamento.
      try { sessionStorage.setItem('reset_in_progress_until', String(Date.now() + 15000)); } catch {}

      // Lista oficial — ORDEM IMPORTA: primeiro removemos as FONTES de
      // recorrência (team_members + service_providers) para que nenhum
      // re-sync consiga reinserir gastos fixos depois.
      const targets: Array<{ table: string; userCol?: string }> = [
        { table: 'team_members' },
        { table: 'team_online_status', userCol: 'owner_id' },
        { table: 'team_invites', userCol: 'created_by' },
        { table: 'maintenance_contracts' },
        { table: 'installments' }, { table: 'sales' },
        { table: 'financial_records' }, { table: 'financial_audit_log' },
        { table: 'financial_reconciliation_log' }, { table: 'financial_check_history' },
        { table: 'fixed_expenses' }, { table: 'scheduled_maintenance' },
        { table: 'service_orders' }, { table: 'quotes' },
        { table: 'appointments' }, { table: 'online_bookings' },
        { table: 'online_booking_settings' }, { table: 'client_equipment' },
        { table: 'products' },
        { table: 'clients' }, { table: 'suppliers' },
        { table: 'tax_records' },
        { table: 'support_requests', userCol: 'owner_id' },
      ];

      const report: Array<{ table: string; deleted: number; status: 'ok' | 'empty' | 'error'; message?: string }> = [];

      for (const t of targets) {
        const col = t.userCol || 'user_id';
        try {
          const { count: before } = await (supabase.from(t.table as any) as any)
            .select('*', { count: 'exact', head: true }).eq(col, userId);
          if (!before) {
            report.push({ table: t.table, deleted: 0, status: 'empty', message: 'sem dados' });
            continue;
          }
          const { error } = await (supabase.from(t.table as any) as any).delete().eq(col, userId);
          if (error) {
            report.push({ table: t.table, deleted: 0, status: 'error', message: error.message });
          } else {
            report.push({ table: t.table, deleted: before, status: 'ok' });
          }
        } catch (e: any) {
          report.push({ table: t.table, deleted: 0, status: 'error', message: e?.message || 'falhou' });
        }
      }

      // Prestadores ficam em admin_settings (JSON global). Limpa apenas a chave.
      const { error: provErr } = await supabase.from('admin_settings').delete().eq('key', 'service_providers');
      report.push({
        table: 'admin_settings/service_providers',
        deleted: provErr ? 0 : 1,
        status: provErr ? 'error' : 'ok',
        message: provErr?.message,
      });

      // Sweep final: garante que NENHUMA despesa fixa sobreviveu (caso algum
      // auto-sync tenha conseguido inserir entre o delete inicial e agora).
      try {
        const { count: leftover } = await (supabase.from('fixed_expenses' as any) as any)
          .select('*', { count: 'exact', head: true }).eq('user_id', userId);
        if (leftover && leftover > 0) {
          await (supabase.from('fixed_expenses' as any) as any).delete().eq('user_id', userId);
          report.push({ table: 'fixed_expenses (sweep)', deleted: leftover, status: 'ok' });
        }
      } catch {}


      // Força limpeza total: cache + localStorage (lixeira financeira inclusa)
      try {
        queryClient.clear();
        const { clearAllTrash } = await import('@/utils/financialTrash');
        clearAllTrash(userId);
        Object.keys(localStorage).forEach((k) => {
          if (/provider|prestador|agenda|appointment|financ|tax|client|product|trash|fin_open_trash/i.test(k)) {
            localStorage.removeItem(k);
          }
        });
      } catch {}

      const totalDeleted = report.reduce((s, r) => s + r.deleted, 0);
      const empties = report.filter((r) => r.status === 'empty').length;
      const errors = report.filter((r) => r.status === 'error').length;

      setResetReport(report);
      toast.success(`✅ Reset concluído — ${totalDeleted} registros apagados · ${empties} já vazias · ${errors} erros`);
    } catch (error: any) {
      toast.error("Erro ao resetar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-5 bg-zinc-950/50 dark:bg-zinc-950/80 border border-primary/20 rounded-2xl mb-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-bold text-base tracking-tight">
          <Database className="w-5 h-5 animate-pulse" />
          CENTRAL DE SIMULAÇÃO & RESET
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase text-[9px] font-black tracking-widest">
          Modo Administrador
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
        Marque o que deseja gerar. Apenas categorias com aba real estão listadas — sua seleção é salva automaticamente.
      </p>

      {/* Picker */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CATEGORIES.map(({ key, label, desc, icon: Icon, tab }) => (
          <label
            key={key}
            className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${
              picker[key] ? 'border-primary/60 bg-primary/5' : 'border-border bg-card/50 hover:border-primary/30'
            }`}
          >
            <Checkbox checked={picker[key]} onCheckedChange={() => toggle(key)} className="mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-xs font-semibold">
                <Icon className="w-3.5 h-3.5" />
                {label}
                <CheckCircle2 className="w-3 h-3 text-emerald-500" aria-label="Categoria validada" />
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">{desc}</div>
              <div className="text-[9px] text-primary/70 mt-0.5 font-medium truncate">{tab}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        <Button size="sm" variant="ghost" className="h-7" onClick={() => setAll(true)}>Marcar tudo</Button>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => setAll(false)}>Limpar</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
        <Button
          variant="outline"
          className="h-11 gap-2 font-bold border-primary/30"
          onClick={() => setPreviewOpen(true)}
          disabled={loading || !hasAny}
        >
          <Eye className="w-4 h-4" />
          Pré-simulação
        </Button>
        <Button
          variant="default"
          className="h-11 gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg shadow-blue-500/20 font-bold"
          onClick={seed}
          disabled={loading || !hasAny}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
          Gerar Simulação
        </Button>
        <Button
          variant="destructive"
          className="h-11 gap-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 font-bold"
          onClick={hardReset}
          disabled={loading}
        >
          <AlertTriangle className="w-4 h-4" />
          Reset Total
        </Button>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> Pré-simulação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              O sistema vai criar (sem afetar dados existentes além do necessário):
            </p>
            <ul className="space-y-1.5">
              {preview.map((p) => (
                <li key={p.label} className="flex items-start justify-between gap-2 border-b last:border-0 pb-1.5">
                  <div>
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.detail}</div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">+{p.count}</Badge>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground pt-2">
              Reconciliação do mês corrente roda em seguida — venda e entrada do agendamento concluído usam o mesmo <code>appointment_id</code>, então não duplicam.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button onClick={seed} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-2" />}
              Aplicar agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Report Dialog */}
      <Dialog open={!!resetReport} onOpenChange={(o) => !o && setResetReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Relatório de Reset
            </DialogTitle>
          </DialogHeader>
          {resetReport && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-md border p-2">
                  <div className="font-bold text-emerald-500">{resetReport.filter(r => r.status === 'ok').length}</div>
                  <div className="text-muted-foreground">limpas</div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="font-bold text-amber-500">{resetReport.filter(r => r.status === 'empty').length}</div>
                  <div className="text-muted-foreground">já vazias</div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="font-bold text-red-500">{resetReport.filter(r => r.status === 'error').length}</div>
                  <div className="text-muted-foreground">erros</div>
                </div>
              </div>
              <div className="max-h-72 overflow-auto rounded-md border divide-y">
                {resetReport.map((r) => (
                  <div key={r.table} className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <code className="text-[11px]">{r.table}</code>
                    {r.status === 'ok' && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">−{r.deleted}</Badge>}
                    {r.status === 'empty' && <Badge variant="outline" className="text-muted-foreground">ignorada (vazia)</Badge>}
                    {r.status === 'error' && <Badge variant="destructive" title={r.message}>erro</Badge>}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Categorias marcadas como <strong>ignoradas</strong> não tinham dados para apagar — não são inconsistência, apenas estavam vazias. Erros indicam tabelas que falharam (clique para ver o motivo no console).
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setResetReport(null)}>Fechar</Button>
            <Button onClick={() => { setResetReport(null); window.location.reload(); }}>
              Recarregar app
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DummyDataSeeder;
