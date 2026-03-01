
-- Allow all authenticated users to read sidebar config
DROP POLICY IF EXISTS "Anyone can read sidebar config" ON public.admin_settings;
CREATE POLICY "Anyone can read sidebar config"
  ON public.admin_settings
  FOR SELECT
  USING (key = 'sidebar_config');
