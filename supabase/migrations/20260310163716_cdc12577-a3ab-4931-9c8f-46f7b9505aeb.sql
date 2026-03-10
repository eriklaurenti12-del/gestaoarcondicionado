
-- Fix support_requests: restrict SELECT and UPDATE to owner only (authenticated)
DROP POLICY IF EXISTS "Owner can read own support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Owner can update support requests" ON public.support_requests;

CREATE POLICY "Owner can read own support requests"
  ON public.support_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owner can update support requests"
  ON public.support_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Super admin can also read/update all support requests
CREATE POLICY "Super admin can read all support requests"
  ON public.support_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can update all support requests"
  ON public.support_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Fix team_online_status: restrict SELECT to team owner only
DROP POLICY IF EXISTS "Anyone can read online status" ON public.team_online_status;

CREATE POLICY "Owner can read team online status"
  ON public.team_online_status FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Super admin can also read all
CREATE POLICY "Super admin can read all team online status"
  ON public.team_online_status FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Fix online_bookings: INSERT should not use WITH CHECK (true) for anon
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.online_bookings;

CREATE POLICY "Anyone can create bookings"
  ON public.online_bookings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
