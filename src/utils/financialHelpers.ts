import { supabase } from '@/integrations/supabase/client';

/**
 * Record a financial entry in the `financial_records` table.
 * 
 * This helper is used by various parts of the system (appointments,
 * route allocations, PDV sales, manual entries) to ensure a single,
 * consistent way of persisting financial data.
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
}) {
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

  // Idempotency: if linked to an appointment, never insert twice
  if (appointmentId) {
    const { data: existing } = await supabase
      .from('financial_records')
      .select('id')
      .eq('user_id', userId)
      .eq('appointment_id', appointmentId)
      .eq('type', type)
      .maybeSingle();
    if (existing) {
      return { data: existing, error: null };
    }
  }

  const { data, error } = await supabase.from('financial_records').insert([
    {
      user_id: userId,
      type,
      amount,
      description: desc,
      payment_method: paymentMethod,
      category,
      installments: installments || 1,
      record_date: recordDate || new Date().toISOString(),
      appointment_id: appointmentId || null,
    },
  ]).select('id');

  if (error) {
    console.error('Failed to record financial entry:', error);
    return { data: null, error };
  }

  return { data: (data && data[0]) || null, error: null };
}
