DO $$
DECLARE
  v_admin uuid := (select id from auth.users where email='admin@gmail.com');
  v_company uuid := (select company_id from public.company_users where user_id = v_admin limit 1);
  r record; pass int; failures int; cnt bigint;
BEGIN
  IF v_admin IS NULL OR v_company IS NULL THEN RAISE EXCEPTION 'admin not found'; END IF;
  FOR pass IN 1..15 LOOP
    failures := 0;
    FOR r IN
      SELECT c.table_name, c.column_name FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
      WHERE c.table_schema='public' AND c.column_name IN ('company_id','user_id') AND c.data_type='uuid'
    LOOP
      BEGIN
        IF r.column_name='company_id' THEN
          EXECUTE format('DELETE FROM public.%I WHERE company_id IS NOT NULL AND company_id <> $1', r.table_name) USING v_company;
        ELSE
          EXECUTE format('DELETE FROM public.%I WHERE user_id IS NOT NULL AND user_id <> $1', r.table_name) USING v_admin;
        END IF;
      EXCEPTION WHEN foreign_key_violation THEN failures := failures + 1;
      END;
    END LOOP;
    BEGIN
      DELETE FROM public.companies WHERE id <> v_company;
      DELETE FROM public.profiles WHERE id <> v_admin;
      DELETE FROM auth.users WHERE id <> v_admin;
      IF failures = 0 THEN EXIT; END IF;
    EXCEPTION WHEN foreign_key_violation THEN failures := failures + 1;
    END;
  END LOOP;
  SELECT count(*) INTO cnt FROM auth.users;
  IF cnt <> 1 THEN RAISE EXCEPTION 'still % users remaining', cnt; END IF;
END $$;