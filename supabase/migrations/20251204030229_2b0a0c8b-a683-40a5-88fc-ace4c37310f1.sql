-- Tabela para controle financeiro
CREATE TABLE public.financial_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saque', 'reserva')),
  amount NUMERIC NOT NULL,
  description TEXT,
  payment_method TEXT CHECK (payment_method IN ('Dinheiro', 'PIX', 'Débito', 'Crédito')),
  installments INTEGER DEFAULT 1,
  category TEXT,
  record_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Usuários podem ver seus próprios registros financeiros"
ON public.financial_records FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios registros financeiros"
ON public.financial_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios registros financeiros"
ON public.financial_records FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios registros financeiros"
ON public.financial_records FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_financial_records_updated_at
BEFORE UPDATE ON public.financial_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();