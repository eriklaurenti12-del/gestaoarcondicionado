-- Add email column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email text;

-- Add is_recurring column to fixed_expenses for monthly recurring expenses
ALTER TABLE public.fixed_expenses ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;