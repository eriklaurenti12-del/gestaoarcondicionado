
-- 1. user_roles: only super_admin can mutate roles
DROP POLICY IF EXISTS "Apenas admins podem gerenciar roles" ON public.user_roles;
CREATE POLICY "Only super admins can manage roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 2. team_online_status INSERT/UPDATE/DELETE policies
CREATE POLICY "Owner can insert team online status"
  ON public.team_online_status
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update team online status"
  ON public.team_online_status
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can delete team online status"
  ON public.team_online_status
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- 3. online_bookings: remove anonymous insert; only via edge function (service role bypasses RLS)
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.online_bookings;
CREATE POLICY "Authenticated owners can create bookings"
  ON public.online_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4. Hash team member PINs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS pin_hash text;

UPDATE public.team_members
SET pin_hash = crypt(pin, gen_salt('bf'))
WHERE pin IS NOT NULL AND pin_hash IS NULL;

ALTER TABLE public.team_members ALTER COLUMN pin DROP NOT NULL;
UPDATE public.team_members SET pin = NULL WHERE pin IS NOT NULL;

-- Server-side PIN verification (uses service role caller)
CREATE OR REPLACE FUNCTION public.verify_team_pin(_member_id uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored text;
BEGIN
  SELECT pin_hash INTO stored FROM public.team_members WHERE id = _member_id AND is_active = true;
  IF stored IS NULL THEN RETURN false; END IF;
  RETURN stored = crypt(_pin, stored);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_team_pin(uuid, text) FROM PUBLIC, anon, authenticated;

-- 5. Login attempts table for brute-force protection
CREATE TABLE IF NOT EXISTS public.team_login_attempts (
  member_id uuid PRIMARY KEY,
  fail_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (edge functions) may access this table.
