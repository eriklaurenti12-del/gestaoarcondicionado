-- Add address to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address TEXT;

-- Add type (service or piece) to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'service' CHECK (type IN ('service', 'piece'));

-- Create fixed expenses table
CREATE TABLE public.fixed_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL, -- combustivel, alimentacao, ajudante, outros
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  helper_name TEXT, -- for ajudante category
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Usuários podem ver seus próprios gastos" ON public.fixed_expenses
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios gastos" ON public.fixed_expenses
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios gastos" ON public.fixed_expenses
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios gastos" ON public.fixed_expenses
FOR DELETE USING (auth.uid() = user_id);