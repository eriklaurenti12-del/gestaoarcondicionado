
-- Public bucket for company logos (per-user folder isolation)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone can read logos (they are shown in PDFs / public docs)
CREATE POLICY "Public can read company logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- Only the owner (folder = user_id) can upload/update/delete their own logo
CREATE POLICY "Users can upload own logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
