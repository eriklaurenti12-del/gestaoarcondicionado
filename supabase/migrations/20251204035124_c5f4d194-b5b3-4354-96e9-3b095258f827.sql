-- Add preferences/notes field to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferences TEXT;

-- Add comment
COMMENT ON COLUMN public.clients.preferences IS 'Notas sobre preferências do cliente (tipo de corte, cor favorita, alergias, etc.)';