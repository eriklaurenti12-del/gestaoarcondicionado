-- 1) Índices únicos parciais: garantia física no banco
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fr_entrada_appointment
  ON public.financial_records (user_id, appointment_id)
  WHERE type = 'entrada' AND appointment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_fr_entrada_sale
  ON public.financial_records (user_id, sale_id)
  WHERE type = 'entrada' AND sale_id IS NOT NULL;

-- 2) Trigger reforçado: bloqueia também duplicatas cruzadas
--    (entrada com appointment_id ↔ outra entrada com sale_id de uma sale daquele apt)
CREATE OR REPLACE FUNCTION public.prevent_financial_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_id uuid;
  norm_desc text;
  related_sale_id integer;
  related_apt_id uuid;
BEGIN
  norm_desc := lower(trim(coalesce(NEW.description, '')));

  IF NEW.appointment_id IS NOT NULL THEN
    SELECT id INTO existing_id
    FROM public.financial_records
    WHERE user_id = NEW.user_id
      AND appointment_id = NEW.appointment_id
      AND type = NEW.type
    LIMIT 1;

    -- Cross-check: já existe entrada para uma sale ligada a este agendamento?
    IF existing_id IS NULL AND NEW.type = 'entrada' THEN
      SELECT fr.id INTO existing_id
      FROM public.financial_records fr
      JOIN public.sales s ON s.id = fr.sale_id
      WHERE fr.user_id = NEW.user_id
        AND fr.type = 'entrada'
        AND s.appointment_id = NEW.appointment_id
      LIMIT 1;
    END IF;
  END IF;

  IF existing_id IS NULL AND NEW.sale_id IS NOT NULL THEN
    SELECT id INTO existing_id
    FROM public.financial_records
    WHERE user_id = NEW.user_id
      AND sale_id = NEW.sale_id
      AND type = NEW.type
    LIMIT 1;

    -- Cross-check: já existe entrada para o agendamento desta sale?
    IF existing_id IS NULL AND NEW.type = 'entrada' THEN
      SELECT s.appointment_id INTO related_apt_id
      FROM public.sales s
      WHERE s.id = NEW.sale_id;

      IF related_apt_id IS NOT NULL THEN
        SELECT id INTO existing_id
        FROM public.financial_records
        WHERE user_id = NEW.user_id
          AND type = 'entrada'
          AND appointment_id = related_apt_id
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  -- Janela de 5 min por (valor + descrição) — pega manuais sem vínculo
  IF existing_id IS NULL THEN
    SELECT id INTO existing_id
    FROM public.financial_records
    WHERE user_id = NEW.user_id
      AND type = NEW.type
      AND amount = NEW.amount
      AND lower(trim(coalesce(description, ''))) = norm_desc
      AND record_date >= (NEW.record_date - interval '5 minutes')
      AND record_date <= (NEW.record_date + interval '5 minutes')
    LIMIT 1;
  END IF;

  IF existing_id IS NOT NULL THEN
    INSERT INTO public.financial_audit_log (user_id, event_type, record_id, details)
    VALUES (
      NEW.user_id,
      'duplicate_blocked',
      existing_id,
      jsonb_build_object(
        'attempted_amount', NEW.amount,
        'attempted_type', NEW.type,
        'attempted_description', NEW.description,
        'attempted_category', NEW.category,
        'attempted_appointment_id', NEW.appointment_id,
        'attempted_sale_id', NEW.sale_id,
        'existing_id', existing_id
      )
    );
    RAISE EXCEPTION 'duplicate_financial_record: já existe lançamento equivalente (id=%)', existing_id
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Garante que o trigger esteja ativo (caso tenha sido removido)
DROP TRIGGER IF EXISTS trg_prevent_financial_duplicate ON public.financial_records;
CREATE TRIGGER trg_prevent_financial_duplicate
  BEFORE INSERT ON public.financial_records
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_financial_duplicate();