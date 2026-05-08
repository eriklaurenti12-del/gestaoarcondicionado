
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS appointment_id uuid;
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS appointment_id uuid;

CREATE INDEX IF NOT EXISTS idx_sales_appointment_id ON public.sales(appointment_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_appointment_id ON public.financial_records(appointment_id);

-- Cleanup: deduplicate auto-generated financial_records (Serviço concluído)
DELETE FROM public.financial_records f
USING public.financial_records f2
WHERE f.id > f2.id
  AND f.user_id = f2.user_id
  AND f.amount = f2.amount
  AND date_trunc('day', f.record_date) = date_trunc('day', f2.record_date)
  AND f.description LIKE 'Serviço concluído:%'
  AND f2.description LIKE 'Serviço concluído:%'
  AND split_part(f.description, ' (Por:', 1) = split_part(f2.description, ' (Por:', 1);

-- Cleanup: deduplicate sales by (client, date, price)
DELETE FROM public.sales s
USING public.sales s2
WHERE s.id > s2.id
  AND s.user_id = s2.user_id
  AND s.client_id = s2.client_id
  AND s.sale_price = s2.sale_price
  AND date_trunc('day', s.sale_date) = date_trunc('day', s2.sale_date);

-- Cleanup: dedup auto-generated team fixed_expenses by tag (auto:team:<id>) for current month
DELETE FROM public.fixed_expenses fe
USING public.fixed_expenses fe2
WHERE fe.id > fe2.id
  AND fe.user_id = fe2.user_id
  AND fe.description LIKE 'auto:%'
  AND fe2.description LIKE 'auto:%'
  AND fe.description = fe2.description
  AND fe.expense_date = fe2.expense_date;
