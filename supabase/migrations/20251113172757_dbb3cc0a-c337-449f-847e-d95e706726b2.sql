-- Criar função para atualizar updated_at se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar tabela para dados da empresa
CREATE TABLE IF NOT EXISTS public.company_data (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  cnpj_cpf TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.company_data ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver seus próprios dados"
ON public.company_data
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios dados"
ON public.company_data
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios dados"
ON public.company_data
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Super admin pode ver todos os dados"
ON public.company_data
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_company_data_updated_at
BEFORE UPDATE ON public.company_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();