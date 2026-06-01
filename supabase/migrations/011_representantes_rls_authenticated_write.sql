-- INSERT/UPDATE/DELETE em representantes exige role "authenticated" com policy explícita.
-- Listagens podem funcionar como anon (representantes_anon_read); cadastro no backoffice não.
-- Idempotente: só cria se ainda não existir.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'representantes'
      AND policyname = 'representantes_authenticated_full'
  ) THEN
    CREATE POLICY "representantes_authenticated_full" ON public.representantes
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
