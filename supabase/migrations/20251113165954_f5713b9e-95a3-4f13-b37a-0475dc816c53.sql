-- Allow super_admins to manage products as well as admins
ALTER POLICY "Apenas admins podem gerenciar produtos" ON public.products
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
);
