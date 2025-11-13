-- Adicionar plano anual e garantir que super admin pode ver tudo
-- Atualizar enum de planos para incluir anual
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'anual';

-- Garantir que as políticas RLS permitam super admin ver todas as subscriptions
DROP POLICY IF EXISTS "Super admin pode ver todas assinaturas" ON subscriptions;
DROP POLICY IF EXISTS "Super admin pode gerenciar assinaturas" ON subscriptions;

CREATE POLICY "Super admin pode ver e gerenciar tudo" 
ON subscriptions 
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Garantir que o super admin pode ler profiles também
DROP POLICY IF EXISTS "Super admin pode ver todos perfis" ON profiles;

CREATE POLICY "Super admin pode ver todos perfis" 
ON profiles 
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));