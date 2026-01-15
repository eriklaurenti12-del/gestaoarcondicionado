-- Fix: Replace overly permissive INSERT policy on admin_notifications
-- The service_role (used by edge functions) bypasses RLS, so we can restrict this

DROP POLICY IF EXISTS "Service role pode inserir notificações" ON public.admin_notifications;

-- Create a more secure INSERT policy that only allows authenticated users
-- Edge functions use service_role which bypasses RLS anyway
-- This prevents anonymous inserts
CREATE POLICY "Apenas service_role pode inserir notificações"
ON public.admin_notifications
FOR INSERT
TO authenticated
WITH CHECK (false);  -- No regular users can insert, only service_role (which bypasses RLS)