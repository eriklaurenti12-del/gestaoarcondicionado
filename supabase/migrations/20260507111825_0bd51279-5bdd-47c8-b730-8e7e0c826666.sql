
CREATE OR REPLACE FUNCTION public.set_team_member_pin(_member_id uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SET pin_hash = crypt(_pin, gen_salt('bf')), pin = NULL
    WHERE id = _member_id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_team_member_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_team_member_pin(uuid, text) TO authenticated;
