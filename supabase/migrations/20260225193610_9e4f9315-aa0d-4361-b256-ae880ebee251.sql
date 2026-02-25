
-- Team invites table for co-administration
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  accepted_by uuid DEFAULT NULL,
  accepted_email text DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone DEFAULT NULL
);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage invites
CREATE POLICY "Super admin full access on team_invites" ON public.team_invites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Team members can see their own invite
CREATE POLICY "Team members can see own invite" ON public.team_invites
  FOR SELECT TO authenticated
  USING (accepted_by = auth.uid());
