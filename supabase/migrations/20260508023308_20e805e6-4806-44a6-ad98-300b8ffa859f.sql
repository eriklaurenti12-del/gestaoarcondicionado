CREATE OR REPLACE FUNCTION public.set_team_member_pin(_member_id uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _pin IS NULL OR length(_pin) <> 4 OR _pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Invalid PIN format';
  END IF;
  SELECT user_id INTO owner FROM public.team_members WHERE id = _member_id;
  IF owner IS NULL THEN RETURN false; END IF;
  IF owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.team_members
    SET pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf')), pin = NULL
    WHERE id = _member_id;
  RETURN true;
END;
$$;

-- Também corrigir verify_team_member_pin se existir com mesmo problema
DO $migration$
DECLARE
  src text;
BEGIN
  SELECT prosrc INTO src FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
    WHERE n.nspname='public' AND proname='verify_team_member_pin' LIMIT 1;
  IF src IS NOT NULL AND src ILIKE '%crypt(%' AND src NOT ILIKE '%extensions.crypt%' THEN
    EXECUTE 'ALTER FUNCTION public.verify_team_member_pin(uuid, text) SET search_path = public, extensions';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $migration$;