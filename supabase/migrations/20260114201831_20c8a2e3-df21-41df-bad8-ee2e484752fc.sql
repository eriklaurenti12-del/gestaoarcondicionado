-- Fix function search_path for security
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id 
    AND is_active = true
    AND status = 'aprovado'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.setup_super_admin()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'eriklaurenti09@gmail.com'
  LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles 
    WHERE user_id = admin_user_id AND role = 'admin';
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    INSERT INTO public.subscriptions (user_id, plan, status, is_active, start_date)
    VALUES (admin_user_id, 'vitalicio', 'aprovado', true, now())
    ON CONFLICT (user_id) DO UPDATE
    SET plan = 'vitalicio', status = 'aprovado', is_active = true, start_date = now();
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Create admin notifications table
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'payment_success', 'payment_error', 'pending_activation', 'blocked'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  user_email TEXT,
  user_phone TEXT,
  user_id UUID,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only super admin can see notifications
CREATE POLICY "Super admin pode ver notificações" 
ON public.admin_notifications 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin pode atualizar notificações" 
ON public.admin_notifications 
FOR UPDATE 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin pode deletar notificações" 
ON public.admin_notifications 
FOR DELETE 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Service role can insert (for webhooks)
CREATE POLICY "Service pode inserir notificações" 
ON public.admin_notifications 
FOR INSERT 
WITH CHECK (true);