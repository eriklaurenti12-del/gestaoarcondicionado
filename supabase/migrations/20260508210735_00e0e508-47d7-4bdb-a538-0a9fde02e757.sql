
-- 1) sale_id em financial_records
ALTER TABLE public.financial_records
  ADD COLUMN IF NOT EXISTS sale_id integer;

CREATE INDEX IF NOT EXISTS idx_financial_records_sale_id
  ON public.financial_records(sale_id) WHERE sale_id IS NOT NULL;

-- 2) Constraints anti-duplicidade
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fr_appointment_type
  ON public.financial_records(user_id, appointment_id, type)
  WHERE appointment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_fr_sale_type
  ON public.financial_records(user_id, sale_id, type)
  WHERE sale_id IS NOT NULL;

-- 3) Audit log
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  record_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_own" ON public.financial_audit_log;
CREATE POLICY "audit_select_own" ON public.financial_audit_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "audit_insert_own" ON public.financial_audit_log;
CREATE POLICY "audit_insert_own" ON public.financial_audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "audit_super_admin_all" ON public.financial_audit_log;
CREATE POLICY "audit_super_admin_all" ON public.financial_audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_audit_user_created
  ON public.financial_audit_log(user_id, created_at DESC);

-- 4) Trigger anti-duplicidade (janela 5 min, mesmo amount + type + description normalizada)
CREATE OR REPLACE FUNCTION public.prevent_financial_duplicate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
  norm_desc text;
BEGIN
  -- Normaliza descrição (lowercase, sem espaços extras)
  norm_desc := lower(trim(coalesce(NEW.description, '')));

  -- Procura duplicata exata em janela de 5 minutos
  SELECT id INTO existing_id
  FROM public.financial_records
  WHERE user_id = NEW.user_id
    AND type = NEW.type
    AND amount = NEW.amount
    AND lower(trim(coalesce(description, ''))) = norm_desc
    AND record_date >= (NEW.record_date - interval '5 minutes')
    AND record_date <= (NEW.record_date + interval '5 minutes')
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- Loga o bloqueio
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

-- 5) Configuração do Agendamento Online (por usuário)
CREATE TABLE IF NOT EXISTS public.online_booking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  weekdays jsonb NOT NULL DEFAULT '{"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":true,"sun":false}'::jsonb,
  start_time text NOT NULL DEFAULT '08:00',
  end_time text NOT NULL DEFAULT '18:00',
  slot_minutes integer NOT NULL DEFAULT 30,
  lunch_start text DEFAULT '12:00',
  lunch_end text DEFAULT '13:00',
  min_advance_hours integer NOT NULL DEFAULT 2,
  max_advance_days integer NOT NULL DEFAULT 30,
  auto_confirm boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.online_booking_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obs_owner_all" ON public.online_booking_settings;
CREATE POLICY "obs_owner_all" ON public.online_booking_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "obs_public_read" ON public.online_booking_settings;
CREATE POLICY "obs_public_read" ON public.online_booking_settings
  FOR SELECT TO anon, authenticated USING (enabled = true);

DROP TRIGGER IF EXISTS trg_obs_updated_at ON public.online_booking_settings;
CREATE TRIGGER trg_obs_updated_at
  BEFORE UPDATE ON public.online_booking_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6) View de auditoria financeira (totais por mês/categoria)
CREATE OR REPLACE VIEW public.financial_audit_view
WITH (security_invoker=on) AS
WITH frs AS (
  SELECT
    user_id,
    to_char(record_date, 'YYYY-MM') AS month_year,
    COALESCE(NULLIF(category, ''), 'sem-categoria') AS category,
    type,
    SUM(amount) AS total,
    COUNT(*) AS qtd
  FROM public.financial_records
  GROUP BY 1,2,3,4
),
sls AS (
  SELECT
    user_id,
    to_char(sale_date, 'YYYY-MM') AS month_year,
    SUM(sale_price * COALESCE(qty, 1)) AS total_sales,
    COUNT(*) AS qtd_sales
  FROM public.sales
  GROUP BY 1,2
)
SELECT
  COALESCE(frs.user_id, sls.user_id) AS user_id,
  COALESCE(frs.month_year, sls.month_year) AS month_year,
  frs.category,
  frs.type,
  frs.total AS total_financial_records,
  frs.qtd AS qtd_financial_records,
  sls.total_sales,
  sls.qtd_sales
FROM frs
FULL OUTER JOIN sls
  ON frs.user_id = sls.user_id AND frs.month_year = sls.month_year;
