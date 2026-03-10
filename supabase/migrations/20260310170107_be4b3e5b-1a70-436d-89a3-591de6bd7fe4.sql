
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pending_notif RECORD;
  detected_plan TEXT := 'mensal';
  detected_amount NUMERIC := 0;
  plan_duration_months INT := 1;
  is_lifetime BOOLEAN := false;
  end_dt TIMESTAMPTZ := NULL;
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)));
  
  IF NEW.email IN ('eriklaurenti09@gmail.com', 'leonardoleal372@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin');
    
    INSERT INTO public.subscriptions (user_id, plan, status, is_active, start_date)
    VALUES (NEW.id, 'vitalicio', 'aprovado', true, now());
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    
    -- Check if there's a pending payment notification for this email
    SELECT * INTO pending_notif 
    FROM public.admin_notifications 
    WHERE type = 'pending_activation' 
      AND user_email = NEW.email 
      AND created_at > now() - interval '48 hours'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF pending_notif.id IS NOT NULL THEN
      -- Extract plan info from metadata if available
      detected_amount := COALESCE((pending_notif.metadata->>'amount')::numeric, 0);
      
      -- Auto-activate with approved status
      INSERT INTO public.subscriptions (user_id, plan, status, is_active, start_date, payment_date)
      VALUES (NEW.id, 'mensal', 'aprovado', true, now(), now());
      
      -- Mark notification as processed
      UPDATE public.admin_notifications 
      SET is_read = true, 
          metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{auto_activated}', 'true')
      WHERE id = pending_notif.id;
      
      -- Create access granted notification
      INSERT INTO public.admin_notifications (type, title, message, user_email, metadata)
      VALUES (
        'access_granted',
        '✅ Auto-ativação! Pagamento pré-cadastro',
        '✅ Usuário ' || NEW.email || ' criou conta após pagamento pendente. Acesso liberado automaticamente.',
        NEW.email,
        jsonb_build_object('auto_activated', true, 'original_notification_id', pending_notif.id::text)
      );
    ELSE
      -- Normal signup: 1 day trial (pendente)
      INSERT INTO public.subscriptions (user_id, plan, status, is_active, start_date)
      VALUES (NEW.id, 'mensal', 'pendente', true, now());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
