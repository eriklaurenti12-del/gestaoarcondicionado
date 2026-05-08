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
    .select('id, description, amount, helper_name')
    .eq('user_id', userId)
    .gte('expense_date', monthStart)
    .lte('expense_date', monthEnd)
    .or('description.ilike.auto:team:%,description.ilike.auto:provider:%');

  const existingTags = new Set(
    (existing || [])
      .map(r => (r.description || '').match(/^(auto:[a-z]+:[^|\s]+)(?:\s*\|\s*(salario|vale|monthly))?/i))
      .filter(Boolean)
      .map((m: any) => `${m[1]}|${(m[2] || '').toLowerCase()}`)
  );

  const rowsToInsert: any[] = [];

  for (const m of members || []) {
    const salary = Number(m.monthly_salary) || 0;
    const vale = Number(m.vale_amount) || 0;
    const category = m.expense_category || 'Salário';
    const baseTag = `auto:team:${m.id}`;
    if (salary > 0 && !existingTags.has(`${baseTag}|salario`)) {
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
    if (vale > 0 && !existingTags.has(`${baseTag}|vale`)) {
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
    if (!existingTags.has(`${baseTag}|monthly`) && !existingTags.has(`${baseTag}|`)) {
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

  return rowsToInsert.length;
}

/**
 * Full reconciliation for the given month:
 *  - Deletes orphan sales/financial_records (appointment_id pointing to a
 *    non-existing or non-concluido appointment in any month).
 *  - Removes duplicates by (appointment_id, type) keeping the oldest.
 *  - Re-runs ensureMonthlyRecurringExpenses for the month.
 */
export async function reconcileFinancialMonth(userId: string, monthYYYYMM: string) {
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
  const inserted = await ensureMonthlyRecurringExpenses(userId, monthYYYYMM);

  return {
    orphanSales: orphanSaleIds.length,
    orphanRecords: orphanRecordIds.length,
    dupRecords: dupRecordIds.length,
    dupSales: dupSaleIds.length,
    insertedRecurring: inserted,
  };
}
