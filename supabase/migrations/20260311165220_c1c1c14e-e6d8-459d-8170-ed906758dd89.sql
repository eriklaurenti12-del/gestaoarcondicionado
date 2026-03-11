
-- Table to map external product IDs/names to internal plans
CREATE TABLE public.product_plan_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'cakto',
  product_id text NULL,
  product_name text NULL,
  plan_name text NOT NULL DEFAULT 'mensal',
  duration_months integer NOT NULL DEFAULT 1,
  is_lifetime boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.product_plan_mapping ENABLE ROW LEVEL SECURITY;

-- Super admin full access
CREATE POLICY "Super admin can manage product mappings"
ON public.product_plan_mapping
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Service role can read (for webhook)
CREATE POLICY "Service role can read mappings"
ON public.product_plan_mapping
FOR SELECT
TO anon
USING (true);

-- Add webhook_logs table for debugging
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  event_type text NULL,
  email text NULL,
  amount numeric NULL,
  plan_detected text NULL,
  product_id text NULL,
  product_name text NULL,
  payload jsonb NULL,
  success boolean NOT NULL DEFAULT false,
  error_message text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can read webhook logs"
ON public.webhook_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin can delete webhook logs"
ON public.webhook_logs
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
