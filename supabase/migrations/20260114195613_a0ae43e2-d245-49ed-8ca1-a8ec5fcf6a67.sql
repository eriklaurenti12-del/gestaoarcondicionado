-- Remover políticas antigas que causam erro
DROP POLICY IF EXISTS "Only super admin can read settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Only super admin can update settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Only super admin can insert settings" ON public.admin_settings;

-- Criar novas políticas usando auth.jwt() ao invés de auth.users
CREATE POLICY "Super admin can read all settings" 
ON public.admin_settings 
FOR SELECT 
USING (
  auth.jwt() ->> 'email' = 'eriklaurenti09@gmail.com'
);

CREATE POLICY "Super admin can update settings" 
ON public.admin_settings 
FOR UPDATE 
USING (
  auth.jwt() ->> 'email' = 'eriklaurenti09@gmail.com'
);

CREATE POLICY "Super admin can insert settings" 
ON public.admin_settings 
FOR INSERT 
WITH CHECK (
  auth.jwt() ->> 'email' = 'eriklaurenti09@gmail.com'
);

-- Inserir/atualizar os links de checkout
INSERT INTO public.admin_settings (key, value, description)
VALUES 
  ('checkout_mensal', 'https://www.ggcheckout.com/checkout/v2/mfP2GrQskkGZvJNT1mb1', 'Link do checkout mensal GGCheckout'),
  ('checkout_anual', 'https://www.ggcheckout.com/checkout/v2/BVbKs8nWCi5VZl2CYenX', 'Link do checkout anual GGCheckout')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;