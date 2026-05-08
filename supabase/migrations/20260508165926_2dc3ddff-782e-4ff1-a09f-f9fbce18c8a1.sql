-- Fix verify_team_pin: crypt() lives in the extensions schema, not public
CREATE OR REPLACE FUNCTION public.verify_team_pin(_member_id uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  stored text;
BEGIN
  SELECT pin_hash INTO stored FROM public.team_members WHERE id = _member_id AND is_active = true;
  IF stored IS NULL THEN RETURN false; END IF;
  RETURN stored = extensions.crypt(_pin, stored);
END;
$function$;

-- Add salary fields for auto-recurring expenses
ALTER TABLE public.team_members 
  ADD COLUMN IF NOT EXISTS monthly_salary numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vale_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expense_category text DEFAULT 'Salário';