-- Add CPF/CNPJ field to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS is_company BOOLEAN DEFAULT false;

-- Create table for tax records (Impostos)
CREATE TABLE IF NOT EXISTS public.tax_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  month_year TEXT NOT NULL, -- Format: "2026-01" for filtering
  
  -- Faturamento
  total_revenue NUMERIC DEFAULT 0,
  revenue_from_services NUMERIC DEFAULT 0,
  revenue_from_products NUMERIC DEFAULT 0,
  
  -- Impostos e Guias
  das_value NUMERIC DEFAULT 0, -- Simples Nacional / DAS
  inss_value NUMERIC DEFAULT 0,
  fgts_value NUMERIC DEFAULT 0,
  irrf_value NUMERIC DEFAULT 0,
  iss_value NUMERIC DEFAULT 0,
  other_taxes NUMERIC DEFAULT 0,
  
  -- Funcionários
  employee_name TEXT,
  employee_salary NUMERIC DEFAULT 0,
  employee_is_registered BOOLEAN DEFAULT false,
  employee_inss NUMERIC DEFAULT 0,
  employee_fgts NUMERIC DEFAULT 0,
  
  -- Gastos gerais para contabilidade
  total_expenses NUMERIC DEFAULT 0,
  fuel_expenses NUMERIC DEFAULT 0,
  material_expenses NUMERIC DEFAULT 0,
  equipment_expenses NUMERIC DEFAULT 0,
  other_expenses NUMERIC DEFAULT 0,
  
  -- Notas e observações
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tax_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own tax records"
ON public.tax_records
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tax records"
ON public.tax_records
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tax records"
ON public.tax_records
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tax records"
ON public.tax_records
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tax_records_updated_at
BEFORE UPDATE ON public.tax_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();