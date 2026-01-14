-- Create table for admin checkout settings
CREATE TABLE public.admin_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only super admin can read/update
CREATE POLICY "Only super admin can read settings" 
ON public.admin_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.uid() = id 
    AND email = 'eriklaurenti09@gmail.com'
  )
);

CREATE POLICY "Only super admin can update settings" 
ON public.admin_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.uid() = id 
    AND email = 'eriklaurenti09@gmail.com'
  )
);

CREATE POLICY "Only super admin can insert settings" 
ON public.admin_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.uid() = id 
    AND email = 'eriklaurenti09@gmail.com'
  )
);

-- Public can read checkout links (for landing page)
CREATE POLICY "Anyone can read checkout links" 
ON public.admin_settings 
FOR SELECT 
USING (key IN ('checkout_mensal', 'checkout_anual', 'whatsapp_suporte'));

-- Insert default values
INSERT INTO public.admin_settings (key, value, description) VALUES
  ('checkout_mensal', '', 'Link de checkout GGCheckout para plano mensal R$ 39,90'),
  ('checkout_anual', '', 'Link de checkout GGCheckout para plano anual R$ 370'),
  ('whatsapp_suporte', 'https://wa.me/5511999999999', 'Link do WhatsApp de suporte'),
  ('promo_end_date', '', 'Data de término da promoção (formato: YYYY-MM-DD HH:mm)');

-- Trigger for updated_at
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();