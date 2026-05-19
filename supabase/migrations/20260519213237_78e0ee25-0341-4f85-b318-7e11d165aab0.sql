
-- 1. Drop plain-text PIN column (only pin_hash remains)
ALTER TABLE public.team_members DROP COLUMN IF EXISTS pin;

-- 2. Restrict storage policies to authenticated only
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname IN (
        'Usuários podem fazer upload de fotos',
        'Usuários autenticados podem fazer upload de imagens de produtos',
        'Usuários autenticados podem atualizar imagens de produtos',
        'Usuários autenticados podem deletar imagens de produtos'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "service_photos_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'service-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "product_images_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "product_images_update_auth"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "product_images_delete_auth"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. Deny-all policy on team_login_attempts (managed via service role only)
CREATE POLICY "team_login_attempts_deny_all"
ON public.team_login_attempts FOR ALL TO authenticated, anon
USING (false) WITH CHECK (false);
