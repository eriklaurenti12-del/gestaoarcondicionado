
-- Table for online booking requests from clients
CREATE TABLE public.online_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  client_email text,
  service_name text NOT NULL,
  preferred_date date NOT NULL,
  preferred_time text NOT NULL,
  payment_method text,
  notes text,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.online_bookings ENABLE ROW LEVEL SECURITY;

-- Owner can manage their bookings
CREATE POLICY "Users can view own bookings"
  ON public.online_bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings"
  ON public.online_bookings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookings"
  ON public.online_bookings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Anyone can insert (public booking form)
CREATE POLICY "Anyone can create bookings"
  ON public.online_bookings FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Enable realtime for instant notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.online_bookings;
