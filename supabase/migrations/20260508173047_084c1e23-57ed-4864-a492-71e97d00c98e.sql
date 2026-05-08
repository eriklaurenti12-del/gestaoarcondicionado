ALTER TABLE public.tax_records
  ADD COLUMN IF NOT EXISTS payroll_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS xml_imports jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS provider_costs jsonb NOT NULL DEFAULT '[]'::jsonb;