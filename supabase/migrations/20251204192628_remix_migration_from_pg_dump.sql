CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user',
    'super_admin'
);


--
-- Name: payment_method_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method_enum AS ENUM (
    'Dinheiro',
    'PIX',
    'Débito',
    'Crédito'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pendente',
    'aprovado',
    'vencido',
    'cancelado'
);


--
-- Name: subscription_plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_plan AS ENUM (
    'vitalicio',
    'mensal',
    'trimestral',
    'anual'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)));
  
  IF NEW.email = 'eriklaurenti09@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin');
    
    INSERT INTO public.subscriptions (user_id, plan, status, is_active, start_date)
    VALUES (NEW.id, 'vitalicio', 'aprovado', true, now());
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    
    INSERT INTO public.subscriptions (user_id, plan, status, is_active)
    VALUES (NEW.id, 'mensal', 'pendente', false);
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: has_active_subscription(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_active_subscription(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id 
    AND is_active = true
    AND status = 'aprovado'
  );
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: setup_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.setup_super_admin() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'eriklaurenti09@gmail.com'
  LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles 
    WHERE user_id = admin_user_id AND role = 'admin';
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    INSERT INTO public.subscriptions (user_id, plan, status, is_active, start_date)
    VALUES (admin_user_id, 'vitalicio', 'aprovado', true, now())
    ON CONFLICT (user_id) DO UPDATE
    SET plan = 'vitalicio', status = 'aprovado', is_active = true, start_date = now();
  END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    client_id integer,
    service_id integer,
    appointment_date timestamp with time zone NOT NULL,
    status text DEFAULT 'agendado'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT appointments_status_check CHECK ((status = ANY (ARRAY['agendado'::text, 'confirmado'::text, 'concluido'::text, 'cancelado'::text])))
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    name text NOT NULL,
    telefone text,
    aniversario date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    preferences text
);


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: company_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_data (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    company_name text NOT NULL,
    cnpj_cpf text NOT NULL,
    email text,
    whatsapp text,
    address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: company_data_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.company_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: company_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.company_data_id_seq OWNED BY public.company_data.id;


--
-- Name: financial_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    amount numeric NOT NULL,
    description text,
    payment_method text,
    installments integer DEFAULT 1,
    category text,
    record_date timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_records_payment_method_check CHECK ((payment_method = ANY (ARRAY['Dinheiro'::text, 'PIX'::text, 'Débito'::text, 'Crédito'::text]))),
    CONSTRAINT financial_records_type_check CHECK ((type = ANY (ARRAY['entrada'::text, 'saque'::text, 'reserva'::text])))
);


--
-- Name: installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    sale_id integer,
    appointment_id uuid,
    installment_number integer NOT NULL,
    total_installments integer NOT NULL,
    amount numeric NOT NULL,
    due_date date NOT NULL,
    paid_date date,
    is_paid boolean DEFAULT false,
    payment_method text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name text NOT NULL,
    barcode text,
    qty integer DEFAULT 0 NOT NULL,
    price numeric NOT NULL,
    cost_price numeric NOT NULL,
    supplier_id integer,
    warranty_months integer,
    min_stock integer,
    date_added date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    username text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id integer NOT NULL,
    product_id integer NOT NULL,
    client_id integer NOT NULL,
    qty integer NOT NULL,
    sale_price numeric NOT NULL,
    total_profit numeric NOT NULL,
    payment_method public.payment_method_enum NOT NULL,
    payment_fee_percentage numeric,
    sale_date timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: sales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_id_seq OWNED BY public.sales.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan text DEFAULT 'mensal'::text NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    payment_date timestamp with time zone,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name text NOT NULL,
    contact text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: company_data id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_data ALTER COLUMN id SET DEFAULT nextval('public.company_data_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: sales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales ALTER COLUMN id SET DEFAULT nextval('public.sales_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: company_data company_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_data
    ADD CONSTRAINT company_data_pkey PRIMARY KEY (id);


--
-- Name: company_data company_data_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_data
    ADD CONSTRAINT company_data_user_id_key UNIQUE (user_id);


--
-- Name: financial_records financial_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_records
    ADD CONSTRAINT financial_records_pkey PRIMARY KEY (id);


--
-- Name: installments installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: appointments update_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: company_data update_company_data_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_company_data_updated_at BEFORE UPDATE ON public.company_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: financial_records update_financial_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_financial_records_updated_at BEFORE UPDATE ON public.financial_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: installments update_installments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_installments_updated_at BEFORE UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: appointments appointments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: clients clients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: company_data company_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_data
    ADD CONSTRAINT company_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: installments installments_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;


--
-- Name: installments installments_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: products products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sales sales_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: sales sales_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: sales sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: suppliers suppliers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Apenas admins podem gerenciar roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Apenas admins podem gerenciar roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: subscriptions Super admin pode ver e gerenciar tudo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin pode ver e gerenciar tudo" ON public.subscriptions USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: company_data Super admin pode ver todos os dados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin pode ver todos os dados" ON public.company_data FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: profiles Super admin pode ver todos perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admin pode ver todos perfis" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Usuários podem atualizar seu próprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: appointments Usuários podem atualizar seus próprios agendamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar seus próprios agendamentos" ON public.appointments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: clients Usuários podem atualizar seus próprios clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar seus próprios clientes" ON public.clients FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: company_data Usuários podem atualizar seus próprios dados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar seus próprios dados" ON public.company_data FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: suppliers Usuários podem atualizar seus próprios fornecedores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar seus próprios fornecedores" ON public.suppliers FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: products Usuários podem atualizar seus próprios produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar seus próprios produtos" ON public.products FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: financial_records Usuários podem atualizar seus próprios registros financeiros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar seus próprios registros financeiros" ON public.financial_records FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: installments Usuários podem atualizar suas próprias parcelas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar suas próprias parcelas" ON public.installments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: sales Usuários podem atualizar suas próprias vendas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem atualizar suas próprias vendas" ON public.sales FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: appointments Usuários podem criar seus próprios agendamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar seus próprios agendamentos" ON public.appointments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: financial_records Usuários podem criar seus próprios registros financeiros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar seus próprios registros financeiros" ON public.financial_records FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: installments Usuários podem criar suas próprias parcelas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem criar suas próprias parcelas" ON public.installments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: appointments Usuários podem deletar seus próprios agendamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar seus próprios agendamentos" ON public.appointments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: clients Usuários podem deletar seus próprios clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar seus próprios clientes" ON public.clients FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: suppliers Usuários podem deletar seus próprios fornecedores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar seus próprios fornecedores" ON public.suppliers FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: products Usuários podem deletar seus próprios produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar seus próprios produtos" ON public.products FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: financial_records Usuários podem deletar seus próprios registros financeiros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar seus próprios registros financeiros" ON public.financial_records FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: installments Usuários podem deletar suas próprias parcelas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar suas próprias parcelas" ON public.installments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: sales Usuários podem deletar suas próprias vendas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem deletar suas próprias vendas" ON public.sales FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: clients Usuários podem inserir seus próprios clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem inserir seus próprios clientes" ON public.clients FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: company_data Usuários podem inserir seus próprios dados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem inserir seus próprios dados" ON public.company_data FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: suppliers Usuários podem inserir seus próprios fornecedores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem inserir seus próprios fornecedores" ON public.suppliers FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: products Usuários podem inserir seus próprios produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem inserir seus próprios produtos" ON public.products FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: sales Usuários podem inserir suas próprias vendas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem inserir suas próprias vendas" ON public.sales FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Usuários podem ver seu próprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: appointments Usuários podem ver seus próprios agendamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver seus próprios agendamentos" ON public.appointments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: company_data Usuários podem ver seus próprios dados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver seus próprios dados" ON public.company_data FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: financial_records Usuários podem ver seus próprios registros financeiros; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver seus próprios registros financeiros" ON public.financial_records FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: subscriptions Usuários podem ver sua própria assinatura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver sua própria assinatura" ON public.subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: installments Usuários podem ver suas próprias parcelas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver suas próprias parcelas" ON public.installments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Usuários podem ver suas próprias roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários podem ver suas próprias roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: clients Usuários veem apenas seus próprios clientes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários veem apenas seus próprios clientes" ON public.clients FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: suppliers Usuários veem apenas seus próprios fornecedores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários veem apenas seus próprios fornecedores" ON public.suppliers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: products Usuários veem apenas seus próprios produtos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários veem apenas seus próprios produtos" ON public.products FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: sales Usuários veem apenas suas próprias vendas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários veem apenas suas próprias vendas" ON public.sales FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: company_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_data ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;

--
-- Name: installments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


