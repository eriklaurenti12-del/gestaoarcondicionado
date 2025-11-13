-- Primeiro, adicionar coluna user_id nas tabelas que não têm
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Atualizar dados existentes para associar ao usuário atual (super admin)
UPDATE public.products SET user_id = (SELECT id FROM auth.users WHERE email = 'eriklaurenti09@gmail.com' LIMIT 1) WHERE user_id IS NULL;
UPDATE public.clients SET user_id = (SELECT id FROM auth.users WHERE email = 'eriklaurenti09@gmail.com' LIMIT 1) WHERE user_id IS NULL;
UPDATE public.suppliers SET user_id = (SELECT id FROM auth.users WHERE email = 'eriklaurenti09@gmail.com' LIMIT 1) WHERE user_id IS NULL;
UPDATE public.sales SET user_id = (SELECT id FROM auth.users WHERE email = 'eriklaurenti09@gmail.com' LIMIT 1) WHERE user_id IS NULL;

-- Tornar user_id obrigatório
ALTER TABLE public.products ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.clients ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.suppliers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN user_id SET NOT NULL;

-- PRODUTOS: Remover políticas antigas e criar novas isoladas por usuário
DROP POLICY IF EXISTS "Apenas admins podem gerenciar produtos" ON public.products;

CREATE POLICY "Usuários veem apenas seus próprios produtos"
ON public.products
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios produtos"
ON public.products
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios produtos"
ON public.products
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios produtos"
ON public.products
FOR DELETE
USING (auth.uid() = user_id);

-- CLIENTES: Remover políticas antigas e criar novas isoladas por usuário
DROP POLICY IF EXISTS "Apenas admins podem gerenciar clientes" ON public.clients;

CREATE POLICY "Usuários veem apenas seus próprios clientes"
ON public.clients
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios clientes"
ON public.clients
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios clientes"
ON public.clients
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios clientes"
ON public.clients
FOR DELETE
USING (auth.uid() = user_id);

-- FORNECEDORES: Remover políticas antigas e criar novas isoladas por usuário
DROP POLICY IF EXISTS "Apenas admins podem gerenciar fornecedores" ON public.suppliers;

CREATE POLICY "Usuários veem apenas seus próprios fornecedores"
ON public.suppliers
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios fornecedores"
ON public.suppliers
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios fornecedores"
ON public.suppliers
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios fornecedores"
ON public.suppliers
FOR DELETE
USING (auth.uid() = user_id);

-- VENDAS: Remover políticas antigas e criar novas isoladas por usuário
DROP POLICY IF EXISTS "Apenas admins podem gerenciar vendas" ON public.sales;

CREATE POLICY "Usuários veem apenas suas próprias vendas"
ON public.sales
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias vendas"
ON public.sales
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias vendas"
ON public.sales
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias vendas"
ON public.sales
FOR DELETE
USING (auth.uid() = user_id);