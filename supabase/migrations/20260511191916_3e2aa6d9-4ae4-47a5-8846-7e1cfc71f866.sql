CREATE TABLE IF NOT EXISTS public.financial_check_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,
  matched BOOLEAN NOT NULL DEFAULT false,
  saldo NUMERIC NOT NULL DEFAULT 0,
  total_entradas NUMERIC NOT NULL DEFAULT 0,
  total_despesas NUMERIC NOT NULL DEFAULT 0,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE public.financial_check_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own check history"
ON public.financial_check_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "users insert own check history"
ON public.financial_check_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own check history"
ON public.financial_check_history FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "users delete own check history"
ON public.financial_check_history FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fch_user_month ON public.financial_check_history(user_id, month DESC);