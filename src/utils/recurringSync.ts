import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures that, for the given month (YYYY-MM), there is a fixed_expense
 * row for every active team_member (salary + vale) and every provider
 * with monthly_cost > 0 (tagged auto:team:<id> / auto:provider:<id>).
 *
 * - Won't duplicate: matches by description prefix tag.
 * - Won't override user-edited amount: only inserts when missing.
 * - Doesn't remove rows; deletion only happens when the user excludes
 *   the row manually or excludes the team member / provider.
 */
export async function ensureMonthlyRecurringExpenses(
  userId: string,
  monthYYYYMM: string
) {
  const monthStart = `${monthYYYYMM}-01`;
  const [yr, mo] = monthYYYYMM.split('-').map(Number);
  const monthEnd = new Date(yr, mo, 0).toISOString().slice(0, 10);

  // 1) Active team members
  const { data: members } = await supabase
    .from('team_members')
    .select('id, name, monthly_salary, vale_amount, expense_category, is_active')
    .eq('user_id', userId)
    .eq('is_active', true);

  // 2) Providers (stored in admin_settings JSON)
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'service_providers')
    .maybeSingle();
  let providers: any[] = [];
  if (settings?.value) {
    try { providers = JSON.parse(settings.value); } catch { providers = []; }
  }
  const activeProviders = providers.filter(
    (p: any) => p.active !== false && p.is_recurring_expenses && Number(p.monthly_cost) > 0
  );

  // 3) Fetch existing auto rows for the month so we can skip them
  const { data: existing } = await supabase
    .from('fixed_expenses')
    .select('id, description, category, helper_name')
    .eq('user_id', userId)
    .gte('expense_date', monthStart)
    .lte('expense_date', monthEnd)
    .or('description.ilike.auto:team:%,description.ilike.auto:provider:%');

  // Index existing rows per base tag, segregating salary vs vale for team rows.
  const existingTeamSalary = new Set<string>();
  const existingTeamVale = new Set<string>();
  const existingProvider = new Set<string>();
  for (const r of existing || []) {
    const m = (r.description || '').match(/^(auto:(team|provider):[^|\s]+)/i);
    if (!m) continue;
    const tag = m[1];
    const kind = m[2].toLowerCase();
    if (kind === 'team') {
      const isVale = (r.category || '').toLowerCase() === 'vale' ||
        /\bvale\b/i.test(r.description || '');
      if (isVale) existingTeamVale.add(tag);
      else existingTeamSalary.add(tag);
    } else {
      existingProvider.add(tag);
    }
  }

  const rowsToInsert: any[] = [];

  for (const m of members || []) {
    const salary = Number(m.monthly_salary) || 0;
    const vale = Number(m.vale_amount) || 0;
    const category = m.expense_category || 'Salário';
    const baseTag = `auto:team:${m.id}`;
    if (salary > 0 && !existingTeamSalary.has(baseTag)) {
      rowsToInsert.push({
        user_id: userId,
        category,
        helper_name: m.name,
        amount: salary,
        description: `${baseTag} | salario | ${category} mensal de ${m.name}`,
        expense_date: monthStart,
        is_recurring: true,
      });
    }
    if (vale > 0 && !existingTeamVale.has(baseTag)) {
      rowsToInsert.push({
        user_id: userId,
        category: 'Vale',
        helper_name: m.name,
        amount: vale,
        description: `${baseTag} | vale | Vale (adiantamento) de ${m.name}`,
        expense_date: monthStart,
        is_recurring: true,
      });
    }
  }

  for (const p of activeProviders) {
    const baseTag = `auto:provider:${p.id}`;
    if (!existingProvider.has(baseTag)) {
      rowsToInsert.push({
        user_id: userId,
        category: 'pro-labore',
        helper_name: p.name,
        amount: Number(p.monthly_cost) || 0,
        description: `${baseTag} | monthly | Custo mensal fixo de ${p.name}`,
        expense_date: monthStart,
        is_recurring: true,
      });
    }
  }

  if (rowsToInsert.length > 0) {
    await supabase.from('fixed_expenses').insert(rowsToInsert);
  }

  // 4) Recurring revenue from active maintenance_contracts (monthly_value > 0)
  // Idempotent via description tag `auto:contract:<id>` in financial_records.
  const { data: contracts } = await supabase
    .from('maintenance_contracts')
    .select('id, title, monthly_value, status, client_id, clients:client_id(name)')
    .eq('user_id', userId)
    .eq('status', 'ativo');

  const activeContracts = (contracts || []).filter((c: any) => Number(c.monthly_value) > 0);
  let insertedContracts = 0;
  const insertedContractRows: Array<{ category: string; helper_name: string | null; amount: number; description: string }> = [];

  if (activeContracts.length > 0) {
    const { data: existingContractRecs } = await supabase
      .from('financial_records')
      .select('id, description')
      .eq('user_id', userId)
      .eq('type', 'entrada')
      .gte('record_date', monthStart)
      .lte('record_date', monthEnd + 'T23:59:59.999Z')
      .ilike('description', 'auto:contract:%');

    const existingTags = new Set<string>();
    for (const r of existingContractRecs || []) {
      const m = (r.description || '').match(/^(auto:contract:[^|\s]+)/i);
      if (m) existingTags.add(m[1]);
    }

    const contractRecords: any[] = [];
    for (const c of activeContracts) {
      const tag = `auto:contract:${c.id}`;
      if (existingTags.has(tag)) continue;
      const clientName = (c as any).clients?.name || 'Cliente';
      const desc = `${tag} | mensal | Contrato mensal: ${c.title} - ${clientName}`;
      contractRecords.push({
        user_id: userId,
        type: 'entrada',
        amount: Number(c.monthly_value) || 0,
        description: desc,
        payment_method: 'PIX',
        category: 'Contrato',
        record_date: `${monthStart}T12:00:00Z`,
      });
      insertedContractRows.push({
        category: 'Contrato',
        helper_name: clientName,
        amount: Number(c.monthly_value) || 0,
        description: desc,
      });
    }
    if (contractRecords.length > 0) {
      await supabase.from('financial_records').insert(contractRecords);
      insertedContracts = contractRecords.length;
    }
  }

  return {
    count: rowsToInsert.length + insertedContracts,
    rows: [
      ...rowsToInsert.map((r) => ({
        category: r.category as string,
        helper_name: (r.helper_name as string) ?? null,
        amount: Number(r.amount) || 0,
        description: r.description as string,
      })),
      ...insertedContractRows,
    ],
  };
}

export interface RepairResult {
  appointmentsRepaired: number;
  salesRepaired: number;
  skipped: number;
  errors: number;
  details: {
    appointmentRows: Array<{ appointment_id: string; amount: number; description: string }>;
    saleRows: Array<{ sale_id: number; amount: number; description: string }>;
  };
}

/**
 * Repara dados antigos criando os `financial_records` que faltam para:
 *  - Appointments com status 'concluido' sem lançamento de entrada;
 *  - Sales sem lançamento financeiro correspondente.
 *
 * Idempotente: o trigger `prevent_financial_duplicate` bloqueia inserts
 * que já existem (por appointment_id / sale_id / janela de 5min).
 *
 * Por padrão varre os últimos 12 meses; passe `sinceISO` para limitar.
 */
export async function repairMissingFinancialRecords(
  userId: string,
  sinceISO?: string
): Promise<RepairResult> {
  const since = sinceISO || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const result: RepairResult = {
    appointmentsRepaired: 0,
    salesRepaired: 0,
    skipped: 0,
    errors: 0,
    details: { appointmentRows: [], saleRows: [] },
  };

  // 1) Appointments concluídos sem financial_record (type='entrada')
  const { data: concluded } = await supabase
    .from('appointments')
    .select('id, appointment_date, service_id, client_id, notes, products:service_id(name, price), clients:client_id(name)')
    .eq('user_id', userId)
    .eq('status', 'concluido')
    .gte('appointment_date', since);

  if (concluded && concluded.length > 0) {
    const aptIds = concluded.map((a: any) => a.id);
    const { data: existingRecs } = await supabase
      .from('financial_records')
      .select('appointment_id')
      .eq('user_id', userId)
      .eq('type', 'entrada')
      .in('appointment_id', aptIds);
    const have = new Set((existingRecs || []).map((r: any) => r.appointment_id));

    for (const apt of concluded) {
      if (have.has(apt.id)) continue;
      let price = Number((apt as any).products?.price) || 0;
      let serviceName = (apt as any).products?.name || 'Serviço';
      const clientName = (apt as any).clients?.name || 'Cliente';
      const notes: string = (apt as any).notes || '';

      // Fallback: agendamentos vindos de Orçamento (sem service_id)
      // — tenta resolver preço/título a partir de quotes #N nas notas.
      if (price <= 0) {
        const m = notes.match(/Or[çc]amento\s*#\s*(\d+)/i);
        if (m) {
          const quoteNumber = parseInt(m[1], 10);
          const { data: q } = await supabase
            .from('quotes')
            .select('total, title')
            .eq('user_id', userId)
            .eq('quote_number', quoteNumber)
            .maybeSingle();
          if (q && Number(q.total) > 0) {
            price = Number(q.total);
            if (q.title) serviceName = q.title;
          }
        }
      }

      if (price <= 0) { result.skipped++; continue; }

      // ANTI-DUPLICATA: procura lançamento manual já existente
      // (mesmo user, mesmo valor, ±2 dias da data, sem appointment_id/sale_id)
      // — se achar, apenas vincula o appointment_id em vez de criar novo.
      try {
        const aptDate = new Date(apt.appointment_date);
        const dStart = new Date(aptDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const dEnd = new Date(aptDate.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
        const { data: candidates } = await supabase
          .from('financial_records')
          .select('id, description')
          .eq('user_id', userId)
          .eq('type', 'entrada')
          .eq('amount', price)
          .is('appointment_id', null)
          .is('sale_id', null)
          .gte('record_date', dStart)
          .lte('record_date', dEnd)
          .limit(5);

        const matched = (candidates || []).find((c: any) => {
          const d = String(c.description || '').toLowerCase();
          return d.includes(String(clientName).toLowerCase()) ||
                 d.includes(String(serviceName).toLowerCase().slice(0, 12));
        }) || (candidates && candidates.length === 1 ? candidates[0] : null);

        if (matched) {
          const { error: upErr } = await supabase
            .from('financial_records')
            .update({ appointment_id: apt.id })
            .eq('id', matched.id);
          if (!upErr) {
            result.appointmentsRepaired++;
            result.details.appointmentRows.push({
              appointment_id: apt.id,
              amount: price,
              description: `[vinculado a manual] ${serviceName} - ${clientName}`,
            });
            continue;
          }
        }

        const { error } = await supabase.from('financial_records').insert({
          user_id: userId,
          type: 'entrada',
          amount: price,
          description: `[auto-reparo] ${serviceName} - ${clientName}`,
          payment_method: 'PIX',
          category: 'Serviço',
          record_date: apt.appointment_date,
          appointment_id: apt.id,
        });
        if (error) {
          if ((error as any).code === '23505' || /duplicate/i.test(error.message)) {
            result.skipped++;
          } else {
            result.errors++;
            console.warn('repair appointment failed', apt.id, error);
          }
        } else {
          result.appointmentsRepaired++;
          result.details.appointmentRows.push({
            appointment_id: apt.id,
            amount: price,
            description: `${serviceName} - ${clientName}`,
          });
        }
      } catch (e) {
        result.errors++;
        console.warn('repair appointment exception', apt.id, e);
      }
    }
  }

  // 2) Sales sem financial_record correspondente
  const { data: monthSales } = await supabase
    .from('sales')
    .select('id, sale_price, qty, sale_date, payment_method, product_id, products:product_id(name)')
    .eq('user_id', userId)
    .gte('sale_date', since);

  if (monthSales && monthSales.length > 0) {
    const saleIds = monthSales.map((s: any) => s.id);
    const { data: linkedRecs } = await supabase
      .from('financial_records')
      .select('sale_id')
      .eq('user_id', userId)
      .eq('type', 'entrada')
      .in('sale_id', saleIds);
    const haveSales = new Set((linkedRecs || []).map((r: any) => r.sale_id));

    for (const s of monthSales as any[]) {
      if (haveSales.has(s.id)) continue;
      const amount = Number(s.sale_price) * Number(s.qty || 1);
      if (amount <= 0) { result.skipped++; continue; }
      const productName = s.products?.name || 'Item';
      try {
        const { error } = await supabase.from('financial_records').insert({
          user_id: userId,
          type: 'entrada',
          amount,
          description: `[auto-reparo] Venda PDV: ${productName} (${s.qty}x)`,
          payment_method: s.payment_method || 'Dinheiro',
          category: 'Produto',
          record_date: s.sale_date,
          sale_id: s.id,
        });
        if (error) {
          if ((error as any).code === '23505' || /duplicate/i.test(error.message)) {
            result.skipped++;
          } else {
            result.errors++;
            console.warn('repair sale failed', s.id, error);
          }
        } else {
          result.salesRepaired++;
          result.details.saleRows.push({
            sale_id: s.id,
            amount,
            description: `${productName} (${s.qty}x)`,
          });
        }
      } catch (e) {
        result.errors++;
        console.warn('repair sale exception', s.id, e);
      }
    }
  }

  return result;
}

export interface ReconcileResult {
  orphanSales: number;
  orphanRecords: number;
  dupRecords: number;
  dupSales: number;
  insertedRecurring: number;
  details: {
    orphanSaleIds: number[];
    orphanRecordIds: string[];
    dupRecordIds: string[];
    dupSaleIds: number[];
    insertedRecurringRows: Array<{ category: string; helper_name: string | null; amount: number; description: string }>;
  };
}

/**
 * Full reconciliation for the given month:
 *  - Deletes orphan sales/financial_records (appointment_id pointing to a
 *    non-existing or non-concluido appointment in any month).
 *  - Removes duplicates by (appointment_id, type) keeping the oldest.
 *  - Re-runs ensureMonthlyRecurringExpenses for the month.
 *  - Writes an audit row in financial_reconciliation_log.
 *
 * `triggeredBy` is stored in the audit log ('manual' | 'auto' | etc.).
 */
export async function reconcileFinancialMonth(
  userId: string,
  monthYYYYMM: string,
  triggeredBy: 'manual' | 'auto' = 'manual'
): Promise<ReconcileResult> {
  const monthStart = `${monthYYYYMM}-01`;
  const [yr, mo] = monthYYYYMM.split('-').map(Number);
  const monthEnd = new Date(yr, mo, 0);
  const monthEndIso = `${monthEnd.toISOString().slice(0, 10)}T23:59:59.999Z`;

  // a) Pull current month sales and records linked to appointments
  const [{ data: monthSales }, { data: monthRecords }] = await Promise.all([
    supabase.from('sales').select('id, appointment_id, sale_date, sale_price')
      .eq('user_id', userId)
      .gte('sale_date', monthStart).lte('sale_date', monthEndIso)
      .not('appointment_id', 'is', null),
    supabase.from('financial_records').select('id, appointment_id, record_date, type, amount, created_at')
      .eq('user_id', userId)
      .gte('record_date', monthStart).lte('record_date', monthEndIso)
      .not('appointment_id', 'is', null),
  ]);

  const aptIds = Array.from(new Set([
    ...(monthSales || []).map((s: any) => s.appointment_id),
    ...(monthRecords || []).map((r: any) => r.appointment_id),
  ])).filter(Boolean);

  let validIds = new Set<string>();
  if (aptIds.length > 0) {
    const { data: apts } = await supabase
      .from('appointments')
      .select('id, status')
      .in('id', aptIds as string[]);
    validIds = new Set((apts || []).filter((a: any) => a.status === 'concluido').map((a: any) => a.id));
  }

  // b) Remove orphans (appointment missing or not concluido)
  const orphanSaleIds: number[] = (monthSales || [])
    .filter((s: any) => !validIds.has(s.appointment_id))
    .map((s: any) => s.id);
  const orphanRecordIds = (monthRecords || [])
    .filter((r: any) => !validIds.has(r.appointment_id))
    .map((r: any) => r.id);

  if (orphanSaleIds.length > 0) {
    await supabase.from('sales').delete().in('id', orphanSaleIds);
  }
  if (orphanRecordIds.length > 0) {
    await supabase.from('financial_records').delete().in('id', orphanRecordIds);
  }

  // c) Dedupe records by (appointment_id, type) keeping oldest
  const grouped = new Map<string, any[]>();
  for (const r of monthRecords || []) {
    if (orphanRecordIds.includes(r.id)) continue;
    const k = `${r.appointment_id}|${r.type}`;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(r);
  }
  const dupRecordIds: string[] = [];
  for (const arr of grouped.values()) {
    if (arr.length > 1) {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      dupRecordIds.push(...arr.slice(1).map((x) => x.id));
    }
  }
  if (dupRecordIds.length > 0) {
    await supabase.from('financial_records').delete().in('id', dupRecordIds);
  }

  // d) Dedupe sales by appointment_id
  const salesGroup = new Map<string, any[]>();
  for (const s of monthSales || []) {
    if (orphanSaleIds.includes(s.id)) continue;
    if (!salesGroup.has(s.appointment_id)) salesGroup.set(s.appointment_id, []);
    salesGroup.get(s.appointment_id)!.push(s);
  }
  const dupSaleIds: number[] = [];
  for (const arr of salesGroup.values()) {
    if (arr.length > 1) {
      dupSaleIds.push(...arr.slice(1).map((x) => x.id));
    }
  }
  if (dupSaleIds.length > 0) {
    await supabase.from('sales').delete().in('id', dupSaleIds);
  }

  // e) Ensure recurring expenses for the month
  const ensured = await ensureMonthlyRecurringExpenses(userId, monthYYYYMM);

  const result: ReconcileResult = {
    orphanSales: orphanSaleIds.length,
    orphanRecords: orphanRecordIds.length,
    dupRecords: dupRecordIds.length,
    dupSales: dupSaleIds.length,
    insertedRecurring: ensured.count,
    details: {
      orphanSaleIds,
      orphanRecordIds,
      dupRecordIds,
      dupSaleIds,
      insertedRecurringRows: ensured.rows,
    },
  };

  // f) Audit log (best-effort; never blocks the result)
  try {
    await supabase.from('financial_reconciliation_log').insert({
      user_id: userId,
      month_year: monthYYYYMM,
      triggered_by: triggeredBy,
      orphan_sales: result.orphanSales,
      orphan_records: result.orphanRecords,
      dup_records: result.dupRecords,
      dup_sales: result.dupSales,
      inserted_recurring: result.insertedRecurring,
      details: result.details as any,
    });
  } catch (e) {
    console.warn('reconciliation_log insert failed', e);
  }

  return result;
}
