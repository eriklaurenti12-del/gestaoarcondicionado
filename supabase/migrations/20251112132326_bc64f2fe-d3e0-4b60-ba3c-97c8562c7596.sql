-- Primeiro adicionar o novo valor ao enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';