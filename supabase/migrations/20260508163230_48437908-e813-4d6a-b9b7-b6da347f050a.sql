
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
UPDATE public.appointments SET status = 'pendente' WHERE status IN ('agendado','futura','agendada');
UPDATE public.appointments SET status = 'confirmado' WHERE status = 'enviado_prestador';
UPDATE public.appointments SET status = 'concluido' WHERE status IN ('concluído','concluida','concluída');
UPDATE public.appointments SET status = 'cancelado' WHERE status IN ('cancelada');
UPDATE public.appointments SET status = 'pendente' WHERE status NOT IN ('pendente','confirmado','concluido','cancelado');
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ('pendente','confirmado','concluido','cancelado'));
