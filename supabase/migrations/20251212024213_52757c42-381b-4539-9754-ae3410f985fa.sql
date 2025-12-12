-- Create table for client equipment (AC units)
CREATE TABLE public.client_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  brand TEXT NOT NULL,
  model TEXT,
  btus INTEGER,
  serial_number TEXT,
  installation_date DATE,
  warranty_end_date DATE,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_equipment ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Usuários podem ver seus próprios equipamentos"
ON public.client_equipment FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios equipamentos"
ON public.client_equipment FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios equipamentos"
ON public.client_equipment FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios equipamentos"
ON public.client_equipment FOR DELETE
USING (auth.uid() = user_id);

-- Create table for scheduled preventive maintenance
CREATE TABLE public.scheduled_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES public.client_equipment(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  maintenance_type TEXT NOT NULL DEFAULT 'preventiva',
  scheduled_date DATE NOT NULL,
  interval_months INTEGER NOT NULL DEFAULT 6,
  is_completed BOOLEAN DEFAULT false,
  completed_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_maintenance ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Usuários podem ver suas próprias manutenções"
ON public.scheduled_maintenance FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias manutenções"
ON public.scheduled_maintenance FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias manutenções"
ON public.scheduled_maintenance FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias manutenções"
ON public.scheduled_maintenance FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for service photos
INSERT INTO storage.buckets (id, name, public) VALUES ('service-photos', 'service-photos', true);

-- Storage policies for photos
CREATE POLICY "Usuários podem ver fotos de serviço"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-photos');

CREATE POLICY "Usuários podem fazer upload de fotos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'service-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem deletar suas fotos"
ON storage.objects FOR DELETE
USING (bucket_id = 'service-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add photos field to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- Trigger for updated_at
CREATE TRIGGER update_client_equipment_updated_at
BEFORE UPDATE ON public.client_equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scheduled_maintenance_updated_at
BEFORE UPDATE ON public.scheduled_maintenance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();