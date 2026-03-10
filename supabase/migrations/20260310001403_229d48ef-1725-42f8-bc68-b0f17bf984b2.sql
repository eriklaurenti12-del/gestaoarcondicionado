CREATE OR REPLACE FUNCTION public.setup_super_admin()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_user_id UUID;
  admin_emails TEXT[] := ARRAY['eriklaurenti09@gmail.com', 'leonardoleal372@gmail.com'];
  admin_email TEXT;
BEGIN
  FOREACH admin_email IN ARRAY admin_emails
  LOOP
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = admin_email
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
  END LOOP;
END;
$function$;

DROP POLICY IF EXISTS "Super admin can read all settings" ON public.admin_settings;
CREATE POLICY "Super admin can read all settings" ON public.admin_settings FOR SELECT TO public USING (
  (auth.jwt() ->> 'email') IN ('eriklaurenti09@gmail.com', 'leonardoleal372@gmail.com')
);

DROP POLICY IF EXISTS "Super admin can update settings" ON public.admin_settings;
CREATE POLICY "Super admin can update settings" ON public.admin_settings FOR UPDATE TO public USING (
  (auth.jwt() ->> 'email') IN ('eriklaurenti09@gmail.com', 'leonardoleal372@gmail.com')
)