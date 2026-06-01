-- Percentual padrão que a importadora paga às representantes (sobre vendas faturadas).
-- Usado quando não existir linha em public.commissions para o par (representante, importadora).

ALTER TABLE public.importadoras
  ADD COLUMN IF NOT EXISTS representante_commission_pct DECIMAL(5, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.importadoras.representante_commission_pct IS
  'Percentual (0–100) pago às representantes sobre vendas; padrão se não houver registro em commissions.';
