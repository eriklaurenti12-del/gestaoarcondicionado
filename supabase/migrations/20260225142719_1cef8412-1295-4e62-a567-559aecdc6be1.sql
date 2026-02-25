
-- Allow public read of landing page settings
DROP POLICY IF EXISTS "Anyone can read landing settings" ON admin_settings;
CREATE POLICY "Anyone can read landing settings"
  ON admin_settings
  FOR SELECT
  USING (key LIKE 'landing_%');
