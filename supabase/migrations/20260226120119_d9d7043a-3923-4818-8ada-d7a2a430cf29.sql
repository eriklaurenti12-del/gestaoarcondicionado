
-- Fix admin_settings INSERT policy to use has_role function instead of JWT email
DROP POLICY IF EXISTS "Super admin can insert settings" ON public.admin_settings;
CREATE POLICY "Super admin can insert settings"
  ON public.admin_settings FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Add team_role column to team_invites for role-based access
ALTER TABLE public.team_invites ADD COLUMN IF NOT EXISTS team_role text NOT NULL DEFAULT 'sistema';
-- team_role values: 'painel' (admin panel only), 'sistema' (full system), 'suporte' (support only)
