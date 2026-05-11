-- Reforça a função de bloqueio de duplicidade financeira
CREATE OR REPLACE FUNCTION public.prevent_financial_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
  norm_desc text;
BEGIN
  norm_desc := lower(trim(coalesce(NEW.description, '')));

  IF NEW.appointment_id IS NOT NULL THEN
    SELECT id INTO existing_id
    FROM public.financial_records
    WHERE user_id = NEW.user_id
      AND appointment_id = NEW.appointment_id
      AND type = NEW.type
    LIMIT 1;
  END IF;

  IF existing_id IS NULL AND NEW.sale_id IS NOT NULL THEN
    SELECT id INTO existing_id
    FROM public.financial_records
    WHERE user_id = NEW.user_id
      AND sale_id = NEW.sale_id
      AND type = NEW.type
    LIMIT 1;
  END IF;

  IF existing_id IS NULL THEN
    SELECT id INTO existing_id
    FROM public.financial_records
    WHERE user_id = NEW.user_id
      AND type = NEW.type
      AND amount = NEW.amount
      AND lower(trim(coalesce(description, ''))) = norm_desc
      AND record_date >= (NEW.record_date - interval '5 minutes')
      AND record_date <= (NEW.record_date + interval '5 minutes')
    LIMIT 1;
  END IF;

  IF existing_id IS NOT NULL THEN
    INSERT INTO public.financial_audit_log (user_id, event_type, record_id, details)
    VALUES (
      NEW.user_id,
      'duplicate_blocked',
      existing_id,
      jsonb_build_object(
        'attempted_amount', NEW.amount,
        'attempted_type', NEW.type,
        'attempted_description', NEW.description,
        'attempted_category', NEW.category,
        'attempted_appointment_id', NEW.appointment_id,
        'attempted_sale_id', NEW.sale_id,
        'existing_id', existing_id
      )
    );
    RAISE EXCEPTION 'duplicate_financial_record: já existe lançamento equivalente (id=%)', existing_id
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_financial_duplicate ON public.financial_records;
CREATE TRIGGER trg_prevent_financial_duplicate
  BEFORE INSERT ON public.financial_records
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_financial_duplicate();

-- Remove vendas duplicadas do mesmo agendamento, mantendo a mais antiga
WITH ranked_sales AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id, appointment_id ORDER BY sale_date ASC, id ASC) AS rn
  FROM public.sales
  WHERE appointment_id IS NOT NULL
)
DELETE FROM public.sales s
USING ranked_sales r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sales_appointment
  ON public.sales(user_id, appointment_id)
  WHERE appointment_id IS NOT NULL;

-- Garante que lançamentos de agendamento também carreguem o sale_id da venda gerada
UPDATE public.financial_records fr
SET sale_id = s.id
FROM public.sales s
WHERE fr.user_id = s.user_id
  AND fr.appointment_id IS NOT NULL
  AND s.appointment_id = fr.appointment_id
  AND fr.sale_id IS NULL
  AND fr.type = 'entrada';

-- Vincula lançamentos antigos às vendas antigas quando o casamento é inequívoco
WITH candidates AS (
  SELECT
    fr.id AS fr_id,
    s.id AS sale_id,
    row_number() OVER (
      PARTITION BY fr.id
      ORDER BY abs(extract(epoch FROM (fr.record_date - s.sale_date))) ASC, s.id ASC
    ) AS rn_fr,
    count(*) OVER (PARTITION BY fr.id) AS cnt_fr,
    count(*) OVER (PARTITION BY s.id) AS cnt_sale
  FROM public.financial_records fr
  JOIN public.sales s ON s.user_id = fr.user_id
  JOIN public.products p ON p.id = s.product_id
  JOIN public.clients c ON c.id = s.client_id
  WHERE fr.sale_id IS NULL
    AND fr.appointment_id IS NULL
    AND s.appointment_id IS NULL
    AND fr.type = 'entrada'
    AND abs(fr.amount - (s.sale_price * COALESCE(s.qty, 1))) < 0.01
    AND fr.record_date::date = s.sale_date::date
    AND (
      lower(coalesce(fr.description, '')) LIKE '%' || lower(p.name) || '%'
      OR lower(coalesce(fr.description, '')) LIKE '%' || lower(c.name) || '%'
    )
)
UPDATE public.financial_records fr
SET sale_id = c.sale_id
FROM candidates c
WHERE fr.id = c.fr_id
  AND c.rn_fr = 1
  AND c.cnt_fr = 1
  AND c.cnt_sale = 1;

-- Índices úteis para conferência e relatórios mensais
CREATE INDEX IF NOT EXISTS idx_sales_user_month
  ON public.sales(user_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_records_user_month
  ON public.financial_records(user_id, record_date DESC);