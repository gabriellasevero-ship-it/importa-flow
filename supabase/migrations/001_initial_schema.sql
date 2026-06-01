-- Importa Flow - Schema inicial
-- Execute via Supabase MCP (apply migration) ou SQL Editor no Dashboard

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Role para usuários (representante ou admin)
CREATE TYPE app_user_role AS ENUM ('representante', 'admin');

-- Status do pedido
CREATE TYPE order_status AS ENUM ('rascunho', 'aberto', 'faturado', 'cancelado');

-- Origem do pedido
CREATE TYPE order_origin AS ENUM ('representante', 'cliente');

-- Perfis (extensão de auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  role app_user_role NOT NULL DEFAULT 'representante',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Importadoras
CREATE TABLE public.importadoras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  logo TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categorias (subcategorias em JSONB)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subcategories JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Produtos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  importadora_id UUID NOT NULL REFERENCES public.importadoras(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  min_order INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL,
  subcategory TEXT,
  image TEXT,
  observations TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  material TEXT,
  detalhe1 TEXT,
  detalhe2 TEXT,
  detalhe3 TEXT,
  dimensions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(importadora_id, code)
);

-- Clientes (por representante)
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  representante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  business_name TEXT,
  cnpj TEXT,
  state_registration TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  cep TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transportadoras
CREATE TABLE public.transportadoras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  phone TEXT NOT NULL,
  cep TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pedidos
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  representante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  importadora_id UUID NOT NULL REFERENCES public.importadoras(id) ON DELETE CASCADE,
  status order_status NOT NULL DEFAULT 'rascunho',
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  observations TEXT,
  nota_fiscal TEXT,
  payment_term TEXT,
  transportadora_id UUID REFERENCES public.transportadoras(id) ON DELETE SET NULL,
  link_id TEXT,
  origin order_origin NOT NULL DEFAULT 'representante',
  is_read BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens do pedido (snapshot de preço/nome/código)
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_price DECIMAL(12,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comissões (representante x importadora)
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  representante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  importadora_id UUID NOT NULL REFERENCES public.importadoras(id) ON DELETE CASCADE,
  percentage DECIMAL(5,2) NOT NULL,
  is_exclusive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(representante_id, importadora_id)
);

-- Links de catálogo (SalesLink)
CREATE TABLE public.catalog_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  representante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  importadora_id UUID NOT NULL REFERENCES public.importadoras(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  views INTEGER NOT NULL DEFAULT 0
);

-- Itens do link de catálogo
CREATE TABLE public.catalog_link_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  catalog_link_id UUID NOT NULL REFERENCES public.catalog_links(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notificações
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas comuns
CREATE INDEX idx_products_importadora ON public.products(importadora_id);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_active ON public.products(active);
CREATE INDEX idx_clientes_representante ON public.clientes(representante_id);
CREATE INDEX idx_orders_representante ON public.orders(representante_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_commissions_representante ON public.commissions(representante_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);

COMMENT ON TABLE public.profiles IS 'Perfis de usuário (representante/admin) vinculados a auth.users';
COMMENT ON TABLE public.order_items IS 'Itens do pedido com snapshot de preço e nome do produto';
