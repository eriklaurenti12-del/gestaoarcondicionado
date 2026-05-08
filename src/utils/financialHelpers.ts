import { supabase } from '@/integrations/supabase/client';

/**
 * Record a financial entry in the `financial_records` table.
 *
 * Idempotência em camadas:
 *  1. Se houver `appointmentId` ou `saleId`, faz pre-check buscando lançamento existente
 *     com o mesmo `type`. Se existir, retorna sem inserir.
 *  2. Banco tem índices únicos parciais e trigger que bloqueia duplicatas equivalentes
 *     em janela de 5 minutos. Se cair nessa proteção, devolvemos `{ skipped: true }`
 *     em vez de propagar erro fatal.
 */
export async function recordFinancialEntry({
  userId,
  type,
  amount,
  description,
  paymentMethod,
  category,
  providerName,
  memberName,
  installments,
  recordDate,
  appointmentId,
  saleId,
}: {
  userId: string;
  type: 'entrada' | 'saque' | 'reserva';
  amount: number;
  description: string;
  paymentMethod: string;
  category: string;
  providerName?: string;
  memberName?: string;
  installments?: number;
  recordDate?: string;
  appointmentId?: string;
  saleId?: number;
}): Promise<{ data: any; error: any; skipped?: boolean }> {
  let desc = providerName ? `${description} [Prestador: ${providerName}]` : description;

  if (!memberName) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      memberName = user.email?.split('@')[0] || 'admin';
    }
  }

  if (memberName) {
    desc = `${desc} (Por: ${memberName})`;
  }

  // Pre-check: appointment_id + type
  if (appointmentId) {
    const { data: existing } = await supabase
      .from('financial_records')
      .select('id')
      .eq('user_id', userId)
      .eq('appointment_id', appointmentId)
      .eq('type', type)
      .maybeSingle();
    if (existing) {
      return { data: existing, error: null, skipped: true };
    }
  }

  // Pre-check: sale_id + type
  if (saleId) {
    const { data: existing } = await supabase
      .from('financial_records')
      .select('id')
      .eq('user_id', userId)
      .eq('sale_id' as any, saleId)
      .eq('type', type)
      .maybeSingle();
    if (existing) {
      return { data: existing, error: null, skipped: true };
    }
  }

  const insertPayload: any = {
    user_id: userId,
    type,
    amount,
    description: desc,
    payment_method: paymentMethod,
    category,
    installments: installments || 1,
    record_date: recordDate || new Date().toISOString(),
    appointment_id: appointmentId || null,
  };
  if (saleId) insertPayload.sale_id = saleId;

  const { data, error } = await supabase
    .from('financial_records')
    .insert([insertPayload])
    .select('id');

  if (error) {
    // 23505 = unique_violation OU trigger anti-duplicidade
    const msg = (error.message || '').toLowerCase();
    const code = (error as any).code;
    if (
      code === '23505' ||
      msg.includes('duplicate_financial_record') ||
      msg.includes('duplicate key') ||
      msg.includes('unique')
    ) {
      console.warn('[financial] duplicata bloqueada pelo banco:', error.message);
      return { data: null, error: null, skipped: true };
    }
    console.error('Failed to record financial entry:', error);
    return { data: null, error };
  }

  return { data: (data && data[0]) || null, error: null };
}
