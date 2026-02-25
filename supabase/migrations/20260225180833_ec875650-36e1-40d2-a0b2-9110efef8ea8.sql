-- Allow public read of promo_end_date
DROP POLICY IF EXISTS "Anyone can read checkout links" ON admin_settings;
CREATE POLICY "Anyone can read checkout links" ON admin_settings
  FOR SELECT USING (key = ANY(ARRAY['checkout_mensal', 'checkout_anual', 'whatsapp_suporte', 'promo_end_date']));
