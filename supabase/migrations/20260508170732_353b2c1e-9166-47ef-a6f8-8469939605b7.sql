
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT NULL;

COMMENT ON COLUMN public.team_members.permissions IS 'Lista de abas permitidas no portal. Quando NULL, usa permissões padrão da role.';
