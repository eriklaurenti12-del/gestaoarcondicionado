
-- 1) Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon, grant only what's needed
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.setup_super_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_team_pin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_team_member_pin(uuid, text) FROM PUBLIC, anon;

-- Trigger-only functions: no direct execute needed
REVOKE ALL ON FUNCTION public.prevent_financial_duplicate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Grant to authenticated for those used in RLS / app calls
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_team_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_team_member_pin(uuid, text) TO authenticated;

-- 2) Public buckets: remove broad SELECT policies that enable listing.
--    Files remain accessible via public object URLs (/storage/v1/object/public/...).
DROP POLICY IF EXISTS "Anyone can view landing media" ON storage.objects;
DROP POLICY IF EXISTS "Public can read company logos" ON storage.objects;
