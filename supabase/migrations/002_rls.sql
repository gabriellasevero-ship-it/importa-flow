-- Importa Flow - RLS: acesso total para usuários autenticados
-- Conforme solicitado: todos (autenticados) possuem acesso a todas as tabelas.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transportadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_link_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas: acesso total (SELECT, INSERT, UPDATE, DELETE) para authenticated

CREATE POLICY "profiles_full_access" ON public.profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "importadoras_full_access" ON public.importadoras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "categories_full_access" ON public.categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "products_full_access" ON public.products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "clientes_full_access" ON public.clientes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "transportadoras_full_access" ON public.transportadoras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "orders_full_access" ON public.orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "order_items_full_access" ON public.order_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "commissions_full_access" ON public.commissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "catalog_links_full_access" ON public.catalog_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "catalog_link_items_full_access" ON public.catalog_link_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "notifications_full_access" ON public.notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Leitura pública para catálogo do cliente (link compartilhado) - anon pode ler
-- produtos, importadoras e categorias para exibir o catálogo por link_id
CREATE POLICY "products_anon_read" ON public.products
  FOR SELECT TO anon USING (true);

CREATE POLICY "importadoras_anon_read" ON public.importadoras
  FOR SELECT TO anon USING (true);

CREATE POLICY "categories_anon_read" ON public.categories
  FOR SELECT TO anon USING (true);

CREATE POLICY "catalog_links_anon_read" ON public.catalog_links
  FOR SELECT TO anon USING (true);

CREATE POLICY "catalog_link_items_anon_read" ON public.catalog_link_items
  FOR SELECT TO anon USING (true);

CREATE POLICY "transportadoras_anon_read" ON public.transportadoras
  FOR SELECT TO anon USING (true);
