-- Remove duplicate financial_records created by [auto-reparo] when a non-repair record already covers the same service
DELETE FROM public.financial_records fr_dup
WHERE fr_dup.type = 'entrada'
  AND fr_dup.description ILIKE '[auto-reparo]%'
  AND EXISTS (
    SELECT 1 FROM public.financial_records fr_orig
    WHERE fr_orig.user_id = fr_dup.user_id
      AND fr_orig.type = 'entrada'
      AND fr_orig.id <> fr_dup.id
      AND fr_orig.amount = fr_dup.amount
      AND fr_orig.record_date = fr_dup.record_date
      AND fr_orig.description NOT ILIKE '[auto-reparo]%'
  );