-- Create installments table to track payment installments
CREATE TABLE public.installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sale_id INTEGER REFERENCES public.sales(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  total_installments INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  is_paid BOOLEAN DEFAULT false,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuários podem ver suas próprias parcelas"
ON public.installments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias parcelas"
ON public.installments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias parcelas"
ON public.installments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias parcelas"
ON public.installments FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_installments_updated_at
BEFORE UPDATE ON public.installments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();