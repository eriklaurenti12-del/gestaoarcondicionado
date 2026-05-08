ALTER TABLE public.online_booking_settings 
ADD COLUMN IF NOT EXISTS vacations jsonb NOT NULL DEFAULT '[]'::jsonb;