-- Permite excluir produtos mesmo que já tenham sido usados em pedidos.
-- order_items guarda um snapshot (product_code/name/price), então o histórico
-- do pedido continua íntegro mesmo sem a referência ao produto original.
-- Troca o ON DELETE RESTRICT por SET NULL (e torna product_id anulável).

ALTER TABLE public.order_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
