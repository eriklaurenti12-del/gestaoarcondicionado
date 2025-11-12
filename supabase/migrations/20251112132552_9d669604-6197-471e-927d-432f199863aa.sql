-- Criar tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'mensal',
  status TEXT NOT NULL DEFAULT 'pendente',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  payment_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies para subscriptions
CREATE POLICY "Usuários podem ver sua própria assinatura"
ON public.subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Super admin pode ver todas assinaturas"
ON public.subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin pode gerenciar assinaturas"
ON public.subscriptions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Criar função para dar super_admin ao email específico
CREATE OR REPLACE FUNCTION public.setup_super_admin()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar a função
SELECT public.setup_super_admin();

-- Atualizar função handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
    
    INSERT INTO public.subscriptions (user_id, plan, status, is_active)
    VALUES (NEW.id, 'mensal', 'pendente', false);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para verificar assinatura ativa
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id 
    AND is_active = true
    AND status = 'aprovado'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;