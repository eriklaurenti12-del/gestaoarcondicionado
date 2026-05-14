
-- 1) Remove public read on online_booking_settings; tenant user_id no longer leaked.
-- Public booking flow continues via the public-booking edge function (service role).
DROP POLICY IF EXISTS obs_public_read ON public.online_booking_settings;

-- 2) Add missing UPDATE policy for service-photos bucket (owner-scoped, mirrors INSERT/DELETE).
CREATE POLICY "service_photos_owner_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'service-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'service-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
