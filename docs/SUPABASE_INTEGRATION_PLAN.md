# Plano de Integração Supabase – Importa Flow

Este documento descreve o plano para remover todos os dados mock e conectar o sistema ao Supabase de forma real, usando **Supabase MCP** quando disponível.

---

## Visão geral

| Etapa | Descrição | Como executar |
|-------|-----------|----------------|
| 1 | Criar schema do banco (tabelas) | MCP ou SQL Editor |
| 2 | Habilitar RLS e políticas (acesso total) | MCP ou SQL Editor |
| 3 | Criar funções (triggers, helpers) | MCP ou SQL Editor |
| 4 | Criar Storage (avatars, produtos, vídeos) | MCP ou Dashboard |
| 5 | Configurar Auth (email/senha) | Dashboard Supabase |
| 6 | Trocar mock por serviços Supabase no app | Código TypeScript |

---

## Como executar via Supabase MCP

Com o **Supabase MCP** conectado no Cursor:

1. **Aplicar migrações SQL**: use a ferramenta do MCP que executa SQL (ex.: Execute SQL ou Apply migration). Execute na ordem: `001_initial_schema.sql` → `002_rls.sql` → `003_functions.sql` → `004_storage.sql`.
2. **Criar Storage buckets**: se o MCP tiver ação para criar bucket, crie `avatars`, `product-images`, `importadora-logos`, `media` (públicos). Se o INSERT em storage.buckets na 004 falhar, crie os buckets no Dashboard (Storage) e rode só os CREATE POLICY da 004.
3. **Verificar schema**: liste tabelas (MCP ou Table Editor) e confira: profiles, importadoras, categories, products, clientes, transportadoras, orders, order_items, commissions, catalog_links, catalog_link_items, notifications.

**Sem MCP:** no Dashboard → SQL Editor, cole cada arquivo de migração e clique Run, na ordem 001 a 004.

---

## 1. Schema do banco (tabelas)

Arquivo: `supabase/migrations/001_initial_schema.sql`

- **profiles** – extensão de auth.users (nome, role, phone, avatar_url)
- **importadoras** – importadoras
- **categories** – categorias e subcategorias (JSONB)
- **products** – produtos (FK importadora, categoria)
- **clientes** – clientes (FK representante = profiles.id)
- **transportadoras** – transportadoras
- **orders** – pedidos (FK representante, cliente, importadora, transportadora)
- **order_items** – itens do pedido (FK order, product; snapshots de preço/nome)
- **commissions** – comissões por representante/importadora
- **catalog_links** – links de catálogo (representante, link_id, views)
- **notifications** – notificações por usuário

UUID como PK em todas; `created_at`/`updated_at` onde fizer sentido.

---

## 2. RLS (acesso total)

Arquivo: `supabase/migrations/002_rls.sql`

- RLS habilitado em todas as tabelas.
- Uma política por tabela: **acesso total** (SELECT, INSERT, UPDATE, DELETE) para:
  - `authenticated`
  - e, onde necessário para o catálogo público, `anon` (apenas nas tabelas combinadas com o uso atual do app).

Conforme solicitado: *“Todos possuem acesso a todas as tabelas”* – políticas permissivas para usuários autenticados; anon apenas onde o fluxo do catálogo exigir.

---

## 3. Funções e triggers

Arquivo: `supabase/migrations/003_functions.sql`

- **updated_at**: trigger genérico para manter `updated_at` em `orders` (e outras tabelas que tiverem essa coluna).
- **create_profile_for_new_user**: ao criar usuário em auth.users, criar linha em `profiles` (nome, role padrão, etc.).
- Funções auxiliares opcionais: e.g. cálculo de total do pedido a partir de `order_items` (para consistência ou relatórios).

---

## 4. Storage

Arquivo: `supabase/migrations/004_storage.sql` (+ políticas)

Buckets:

- **avatars** – fotos de perfil (representantes/admin).
- **product-images** – imagens de produtos.
- **importadora-logos** – logos de importadoras.
- **media** – vídeos e outros arquivos gerais.

Políticas: leitura pública (ou para authenticated); upload/update/delete apenas para `authenticated` (e restringir por pasta/prefix se quiser depois).

---

## 5. Autenticação (Supabase Auth)

- No **Dashboard**: Authentication → Providers → Email habilitado.
- Usuários: representantes e admin criados via Auth (email/senha) ou pelo MCP se disponível.
- **profiles**: preenchido por trigger ao se inscrever (ou por função chamada após signup no app).

Não usar mais login mock: passar a usar `supabase.auth.signInWithPassword` e `supabase.auth.signUp`, e ler role/dados em `profiles`.

### Definir usuário como admin (backoffice)

Por padrão, todo usuário criado recebe `role = 'representante'`. Para acessar o backoffice (Importadoras, Representantes, Dashboard admin), é preciso definir `role = 'admin'` na tabela `profiles`:

- **Opção A – Table Editor:** Supabase → Table Editor → **profiles** → localize a linha do usuário → edite a coluna **role** para `admin` → Save.
- **Opção B – SQL Editor:** Execute (troque o email pelo do usuário que será admin):
  ```sql
  UPDATE public.profiles SET role = 'admin' WHERE email = 'seu-email-admin@exemplo.com';
  ```

---

## 6. Integração no app (remover mock)

- **Remover** `src/data/mockData.ts` (ou manter só tipos/constantes vazias se necessário).
- **Criar** camada de serviços/hooks que usam o cliente Supabase:
  - `src/lib/supabase.ts` (já existe).
  - `src/services/` ou `src/hooks/`: `useImportadoras`, `useProducts`, `useOrders`, `useClientes`, `useTransportadoras`, `useCategories`, `useCommissions`, `useNotifications`, etc., cada um fazendo `from('...').select()` / insert / update / delete.
- **Substituir** em todos os componentes:
  - `mockImportadoras` → `useImportadoras()` ou `getImportadoras()`.
  - `mockProducts` → `useProducts()` (com filtros por importadora/categoria).
  - `mockOrders` → `useOrders()` e `OrdersContext` passando a usar Supabase.
  - `mockClientes` + `catalogClients` → `useClientes()` / clientes do catálogo via Supabase.
  - `mockTransportadoras` → `useTransportadoras()`.
  - `mockCategories` → `useCategories()`.
  - Notifications, Dashboard, Commissions, etc. → dados vindos de Supabase.
- **Auth**: trocar `AuthContext` para usar `supabase.auth.onAuthStateChange` e leitura de `profiles` (por `user.id`).
- **Clientes do catálogo**: cadastro de cliente (link do catálogo) → `insert` em `clientes`; lista de clientes da representante → `from('clientes').select()`.
- **Pedidos**: criar/atualizar em `orders` + `order_items`; listar com join ou select em `order_items` para montar `items` no tipo `Order`.
- **Storage**: upload de imagem de produto/avatar/logo → `supabase.storage.from('bucket').upload()` e salvar URL na tabela correspondente.

---

## Ordem de execução recomendada

1. Executar **001_initial_schema.sql** (criar tabelas).
2. Executar **002_rls.sql** (RLS + políticas).
3. Executar **003_functions.sql** (triggers e funções).
4. Executar **004_storage.sql** (buckets e políticas de storage).
5. No Dashboard: configurar Auth (Email) e criar primeiro usuário admin/representante se necessário.
6. No código: implementar serviços/hooks e trocar todos os mocks pelos dados reais do Supabase.

---

## Checklist pós-integração

- [ ] Todas as tabelas criadas e visíveis no Table Editor.
- [ ] RLS ativo; políticas permitem o acesso desejado (testar com usuário logado e, se aplicável, anon).
- [ ] Trigger de profile ao signup funcionando.
- [ ] Storage buckets criados; upload e leitura funcionando.
- [ ] Login/logout pelo Supabase Auth; role e dados lidos de `profiles`.
- [ ] Catálogo (representante e link do cliente) carregando produtos/importadoras/categorias do Supabase.
- [ ] Pedidos sendo criados/atualizados em `orders` + `order_items`; lista e detalhe funcionando.
- [ ] Clientes (lista e cadastro pelo link) usando tabela `clientes`.
- [ ] Comissões, notificações e transportadoras usando Supabase.
- [ ] Nenhum import de `mockData` restante no projeto (exceto se mantido só para tipos).

Depois de aplicar as migrações (via MCP ou SQL Editor), use este plano como guia para substituir o mock pelo Supabase no código.
