
CREATE POLICY "Anyone can read domain settings"
ON public.admin_settings
FOR SELECT
USING (key IN ('custom_domain', 'use_custom_domain'));
