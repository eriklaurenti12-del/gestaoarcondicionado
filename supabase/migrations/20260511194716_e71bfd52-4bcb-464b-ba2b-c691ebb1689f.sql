DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'appointments','clients','products','sales','financial_records','fixed_expenses',
    'installments','maintenance_contracts','scheduled_maintenance','quotes','service_orders',
    'company_data','team_members','client_equipment','suppliers','tax_records'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;