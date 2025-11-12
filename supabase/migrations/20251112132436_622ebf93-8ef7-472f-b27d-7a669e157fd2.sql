-- Criar enum para tipos de plano
CREATE TYPE public.subscription_plan AS ENUM ('vitalicio', 'mensal', 'trimestral');

-- Criar enum para status de pagamento
CREATE TYPE public.payment_status AS ENUM ('pendente', 'aprovado', 'vencido', 'cancelado');

-- Atualizar enum de roles para incluir super_admin
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';