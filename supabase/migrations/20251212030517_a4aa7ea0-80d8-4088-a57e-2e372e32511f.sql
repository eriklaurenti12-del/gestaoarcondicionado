-- Create trigger for new user registration if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix existing users that don't have subscriptions
INSERT INTO public.profiles (user_id, username)
SELECT id, COALESCE(raw_user_meta_data->>'username', SPLIT_PART(email, '@', 1))
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
  AND email != 'eriklaurenti09@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO public.subscriptions (user_id, plan, status, is_active, start_date)
SELECT id, 'mensal', 'pendente', true, COALESCE(created_at, now())
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.subscriptions)
  AND email != 'eriklaurenti09@gmail.com'
ON CONFLICT DO NOTHING;