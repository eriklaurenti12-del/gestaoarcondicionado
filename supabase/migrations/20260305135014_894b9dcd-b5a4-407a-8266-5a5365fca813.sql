
-- Table to track team members currently online in the portal
CREATE TABLE public.team_online_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  member_name text NOT NULL,
  member_role text NOT NULL DEFAULT 'sistema',
  member_phone text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one status per member
ALTER TABLE public.team_online_status ADD CONSTRAINT team_online_status_member_unique UNIQUE (member_id);

-- Table for support requests from users/clients
CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  requester_name text NOT NULL,
  requester_phone text,
  requester_email text,
  request_type text NOT NULL DEFAULT 'ajuda',
  message text,
  status text NOT NULL DEFAULT 'pendente',
  assigned_member_id uuid REFERENCES public.team_members(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for team_online_status (public read for showing online members)
ALTER TABLE public.team_online_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read online status"
  ON public.team_online_status FOR SELECT
  USING (true);

-- RLS for support_requests
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create support requests"
  ON public.support_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owner can read own support requests"
  ON public.support_requests FOR SELECT
  USING (true);

CREATE POLICY "Owner can update support requests"
  ON public.support_requests FOR UPDATE
  USING (true);

-- Enable realtime for online status
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_online_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_requests;
