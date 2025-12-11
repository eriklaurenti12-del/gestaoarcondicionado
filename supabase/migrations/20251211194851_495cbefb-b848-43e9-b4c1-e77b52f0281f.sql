-- Add service_duration column to products table for time-based scheduling
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS service_duration integer DEFAULT 60;

-- Add comment for clarity
COMMENT ON COLUMN public.products.service_duration IS 'Service duration in minutes, default 60 minutes';