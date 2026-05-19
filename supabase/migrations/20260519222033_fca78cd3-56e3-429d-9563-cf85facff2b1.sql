
-- 1) Remove team_members from realtime publication (protects pin_hash, salary, phone)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_members'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.team_members';
  END IF;
END$$;

-- 2) Tighten online_booking_settings policy to authenticated only
DROP POLICY IF EXISTS "obs_owner_all" ON public.online_booking_settings;
CREATE POLICY "obs_owner_all" ON public.online_booking_settings
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) Align service-photos storage DELETE policy to authenticated only
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='Usuários podem deletar suas fotos'
  ) THEN
    EXECUTE 'DROP POLICY "Usuários podem deletar suas fotos" ON storage.objects';
    EXECUTE $p$CREATE POLICY "Usuários podem deletar suas fotos" ON storage.objects
      AS PERMISSIVE FOR DELETE TO authenticated
      USING (bucket_id = 'service-photos' AND auth.uid()::text = (storage.foldername(name))[1])$p$;
  END IF;
END$$;
