-- Importa Flow - Funções e triggers

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at nas tabelas que têm a coluna
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER importadoras_updated_at
  BEFORE UPDATE ON public.importadoras
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER transportadoras_updated_at
  BEFORE UPDATE ON public.transportadoras
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Criar perfil ao inscrever novo usuário (auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'representante'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger no auth.users (cria profile após signup)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Função auxiliar: total do pedido a partir de order_items (para consistência)
CREATE OR REPLACE FUNCTION public.order_total_from_items(p_order_id UUID)
RETURNS DECIMAL(12,2) AS $$
  SELECT COALESCE(SUM(product_price * quantity), 0)::DECIMAL(12,2)
  FROM public.order_items
  WHERE order_id = p_order_id;
$$ LANGUAGE sql STABLE;
