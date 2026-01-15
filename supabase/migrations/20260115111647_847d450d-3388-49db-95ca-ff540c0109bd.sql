-- Remove the remaining overly permissive INSERT policy
DROP POLICY IF EXISTS "Service pode inserir notificações" ON public.admin_notifications;