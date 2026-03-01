
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS storage_location text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS storage_shelf text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS storage_section text DEFAULT NULL;
