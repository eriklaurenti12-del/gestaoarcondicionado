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
  installments,
  recordDate,
}: {
  userId: string;
  type: 'entrada' | 'saque' | 'reserva';
  amount: number;
  description: string;
  paymentMethod: string;
  category: string;
  providerName?: string;
  installments?: number;
  recordDate?: string;
}) {
  const desc = providerName ? `${description} [Prestador: ${providerName}]` : description;

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
    },
  ]).select('id');

  if (error) {
    console.error('Failed to record financial entry:', error);
    return { data: null, error };
  }

  return { data: (data && data[0]) || null, error: null };
}
