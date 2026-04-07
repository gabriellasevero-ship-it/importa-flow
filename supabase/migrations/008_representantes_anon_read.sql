-- Catálogo público (/catalogo/...): visitantes anônimos precisam ver nome/e-mail/telefone da representante.
CREATE POLICY "representantes_anon_read" ON public.representantes
  FOR SELECT TO anon USING (true);
