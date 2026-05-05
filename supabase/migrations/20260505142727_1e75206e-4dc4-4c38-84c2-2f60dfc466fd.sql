
-- Tighten RLS policies to require authentication (TO authenticated)
-- profiles
DROP POLICY IF EXISTS "Super admin pode ver todos perfis" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- clients
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios clientes" ON public.clients;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios clientes" ON public.clients;
DROP POLICY IF EXISTS "Usuários podem inserir seus próprios clientes" ON public.clients;
DROP POLICY IF EXISTS "Usuários veem apenas seus próprios clientes" ON public.clients;

CREATE POLICY "clients_select_own" ON public.clients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "clients_insert_own" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_update_own" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "clients_delete_own" ON public.clients FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- quotes
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios orçamentos" ON public.quotes;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios orçamentos" ON public.quotes;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios orçamentos" ON public.quotes;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios orçamentos" ON public.quotes;

CREATE POLICY "quotes_select_own" ON public.quotes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "quotes_insert_own" ON public.quotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quotes_update_own" ON public.quotes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "quotes_delete_own" ON public.quotes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- subscriptions
DROP POLICY IF EXISTS "Super admin pode ver e gerenciar tudo" ON public.subscriptions;
DROP POLICY IF EXISTS "Usuários podem ver sua própria assinatura" ON public.subscriptions;

CREATE POLICY "subscriptions_select_own_or_admin" ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "subscriptions_admin_all" ON public.subscriptions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Storage: make buckets private and restrict reads
UPDATE storage.buckets SET public = false WHERE id IN ('service-photos', 'product-images');

DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem ver fotos de serviço" ON storage.objects;

CREATE POLICY "Authenticated can view product images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');
CREATE POLICY "Users view own service photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'service-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
