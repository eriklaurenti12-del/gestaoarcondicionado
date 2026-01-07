-- Criar sequência para número do contrato primeiro
CREATE SEQUENCE IF NOT EXISTS maintenance_contracts_contract_number_seq START 1;

-- Criar tabela de contratos de manutenção
CREATE TABLE public.maintenance_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id INTEGER NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_number INTEGER NOT NULL DEFAULT nextval('maintenance_contracts_contract_number_seq'::regclass),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  cleaning_interval_months INTEGER NOT NULL DEFAULT 6,
  monthly_value NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.maintenance_contracts ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Usuários podem ver seus próprios contratos" 
ON public.maintenance_contracts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios contratos" 
ON public.maintenance_contracts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios contratos" 
ON public.maintenance_contracts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios contratos" 
ON public.maintenance_contracts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_maintenance_contracts_updated_at
BEFORE UPDATE ON public.maintenance_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();