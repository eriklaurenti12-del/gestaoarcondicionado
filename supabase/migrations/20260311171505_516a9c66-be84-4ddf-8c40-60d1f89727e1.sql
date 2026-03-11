
-- Fix product_plan_mapping: drop RESTRICTIVE policies, recreate as PERMISSIVE
DROP POLICY IF EXISTS "Service role can read mappings" ON public.product_plan_mapping;
DROP POLICY IF EXISTS "Super admin can manage product mappings" ON public.product_plan_mapping;

CREATE POLICY "Super admin can manage product mappings"
ON public.product_plan_mapping
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Anon can read mappings"
ON public.product_plan_mapping
FOR SELECT
TO anon
USING (true);

-- Fix webhook_logs: drop RESTRICTIVE policies, recreate as PERMISSIVE
DROP POLICY IF EXISTS "Super admin can read webhook logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "Super admin can delete webhook logs" ON public.webhook_logs;

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
