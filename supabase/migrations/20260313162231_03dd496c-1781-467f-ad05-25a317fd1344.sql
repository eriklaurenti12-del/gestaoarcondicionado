-- Add RLS policy for system branding settings (public read)
CREATE POLICY "Anyone can read system branding settings"
ON public.admin_settings
FOR SELECT
TO public
USING (key IN ('system_name', 'system_subtitle', 'system_logo_url', 'system_creator'));