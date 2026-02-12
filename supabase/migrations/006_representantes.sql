-- Tabela representantes: diretório de representantes no backoffice (vinculado a profiles)
-- Permite status (ativa/pendente/suspensa), CPF, CNPJ, empresa e importadora associada.

CREATE TYPE representative_status AS ENUM ('active', 'pending', 'suspended');

CREATE TABLE public.representantes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  cpf TEXT,
  cnpj TEXT,
  company TEXT,
  importer_id UUID REFERENCES public.importadoras(id) ON DELETE SET NULL,
  status representative_status NOT NULL DEFAULT 'pending',
  total_sales DECIMAL(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_representantes_user ON public.representantes(user_id);
CREATE INDEX idx_representantes_status ON public.representantes(status);
CREATE INDEX idx_representantes_importer ON public.representantes(importer_id);

ALTER TABLE public.representantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "representantes_full_access" ON public.representantes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.representantes IS 'Diretório de representantes no backoffice; vinculado a profiles por user_id.';

-- Inserir na tabela representantes todos os perfis que já são representantes
-- (para quem se cadastrou antes desta migration aparecer na tela do backoffice)
INSERT INTO public.representantes (user_id, name, email, phone, status)
SELECT id, name, email, COALESCE(phone, ''), 'pending'::representative_status
FROM public.profiles
WHERE role = 'representante'
ON CONFLICT (user_id) DO NOTHING;
