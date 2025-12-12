-- Fix handle_new_user function to properly set start_date for trial calculation
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)));
  
  IF NEW.email = 'eriklaurenti09@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin');
    
    INSERT INTO public.subscriptions (user_id, plan, status, is_active, start_date)
    VALUES (NEW.id, 'vitalicio', 'aprovado', true, now());
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    
    -- New users get 1-day trial: start_date = now(), is_active = true during trial
    INSERT INTO public.subscriptions (user_id, plan, status, is_active, start_date)
    VALUES (NEW.id, 'mensal', 'pendente', true, now());
  END IF;
  
  RETURN NEW;
END;
$function$;