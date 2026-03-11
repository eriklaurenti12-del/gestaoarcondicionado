
-- Allow reading support channel settings publicly
DROP POLICY IF EXISTS "Anyone can read checkout links" ON public.admin_settings;

CREATE POLICY "Anyone can read checkout and support settings"
ON public.admin_settings
FOR SELECT
TO public
USING (key = ANY (ARRAY[
  'checkout_mensal', 'checkout_trimestral', 'checkout_semestral', 'checkout_anual', 'checkout_vitalicio',
  'preco_mensal', 'preco_trimestral', 'preco_semestral', 'preco_anual', 'preco_vitalicio',
  'planos_visiveis_landing', 'whatsapp_suporte', 'promo_end_date',
  'notificar_vendas', 'notificar_erros',
  'email_suporte', 'telefone_suporte', 'instagram_suporte'
]));
