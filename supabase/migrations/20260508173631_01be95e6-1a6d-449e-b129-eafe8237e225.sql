CREATE TABLE public.financial_reconciliation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month_year text NOT NULL,
  triggered_by text NOT NULL DEFAULT 'manual',
  orphan_sales integer NOT NULL DEFAULT 0,
  orphan_records integer NOT NULL DEFAULT 0,
  dup_records integer NOT NULL DEFAULT 0,
  dup_sales integer NOT NULL DEFAULT 0,
  inserted_recurring integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reconciliation_log_user_month
  ON public.financial_reconciliation_log (user_id, month_year, created_at DESC);

ALTER TABLE public.financial_reconciliation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reconciliation log"
  ON public.financial_reconciliation_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reconciliation log"
  ON public.financial_reconciliation_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admin can view all reconciliation log"
  ON public.financial_reconciliation_log FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));
