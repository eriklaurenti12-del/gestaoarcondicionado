-- Create service_orders table
CREATE TABLE public.service_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_number SERIAL,
  client_id INTEGER REFERENCES public.clients(id),
  title TEXT NOT NULL,
  description TEXT,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  services_total NUMERIC NOT NULL DEFAULT 0,
  parts_total NUMERIC NOT NULL DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0,
  discount_value NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  signature_data TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  quote_id UUID REFERENCES public.quotes(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Usuários podem ver suas próprias O.S."
ON public.service_orders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias O.S."
ON public.service_orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias O.S."
ON public.service_orders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias O.S."
ON public.service_orders FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_service_orders_updated_at
BEFORE UPDATE ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();