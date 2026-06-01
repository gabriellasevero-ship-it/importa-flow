-- Projetos cuja tabela representantes foi criada antes de cpf/cnpj/company/etc.
-- alinham o schema ao esperado pelo app (evita erro PostgREST: column not in schema cache).

ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS total_sales DECIMAL(12,2);
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS importer_id UUID REFERENCES public.importadoras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_representantes_importer ON public.representantes(importer_id);

-- Atualiza o cache do PostgREST (mensagem "Could not find the 'cnpj' column ... schema cache")
NOTIFY pgrst, 'reload schema';
