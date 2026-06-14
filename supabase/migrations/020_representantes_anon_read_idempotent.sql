-- Garante a leitura anônima de representantes no catálogo público (/catalogo/...).
-- Sintoma sem esta policy: ao abrir o link no mobile (sessão anon), o nome da
-- representante não carrega e cai no texto padrão "Representante".
-- Idempotente: recria a policy apenas se a migration 008 não tiver sido aplicada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'representantes'
      AND policyname = 'representantes_anon_read'
  ) THEN
    CREATE POLICY "representantes_anon_read" ON public.representantes
      FOR SELECT TO anon USING (true);
  END IF;
END $$;
