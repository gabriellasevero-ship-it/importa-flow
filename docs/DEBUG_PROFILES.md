# Conferir e corrigir perfis (profiles) no Supabase

Para o **login funcionar**, cada usuário do Auth precisa ter uma linha na tabela **`public.profiles`** (mesmo `id`, `name`, `email`, `role`). Quem se cadastra como representante passa a ter o perfil criado pelo app após o signup; se não existir trigger ou a política abaixo, use o passo 2 para criar manualmente.

**Política RLS para o app criar perfil no cadastro** (rode no SQL Editor se novos cadastros não conseguirem fazer login):

```sql
-- Permite que o usuário crie/atualize o próprio perfil (usado no cadastro de representante)
CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

---

## 1. Ver o que está no banco

No **SQL Editor** do Supabase, rode:

```sql
-- Listar usuários do Auth e se têm perfil
SELECT 
  u.id AS user_id,
  u.email,
  p.id AS profile_id,
  p.role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.email;
```

- Se aparecer **profile_id** preenchido para seu email → o perfil existe; o problema pode ser outro (veja passo 3).
- Se aparecer **profile_id** vazio (null) para seu email → falta criar o perfil (passo 2).

---

## 2. Criar perfil manualmente (quando o INSERT em lote não funcionou)

1. No Supabase: **Authentication** → **Users** → clique no seu usuário.
2. Copie o **User UID** (ex.: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).
3. Copie o **Email** do usuário.
4. No **SQL Editor**, rode o comando abaixo trocando **SEU_UUID** e **seu@email.com** pelos valores reais:

```sql
INSERT INTO public.profiles (id, name, email, role)
VALUES (
  'SEU_UUID'::uuid,
  'Seu Nome',
  'seu@email.com',
  'representante'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = COALESCE(public.profiles.role, EXCLUDED.role);
```

Exemplo (só ilustrativo):

```sql
INSERT INTO public.profiles (id, name, email, role)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'Gabriella',
  'gabriella.severo@gmail.com',
  'representante'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = COALESCE(public.profiles.role, EXCLUDED.role);
```

5. Para esse usuário ser admin (backoffice), depois rode:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'seu@email.com';
```

---

## 3. Se o perfil já existe e o login ainda falha

- Abra o app, tente logar e veja a **mensagem em vermelho** na tela.
- Abra o **Console** do navegador (F12 → Console) e veja se aparece algum erro em vermelho ao clicar em Entrar.
- Confira na Vercel se as variáveis **VITE_SUPABASE_URL** e **VITE_SUPABASE_ANON_KEY** estão corretas (mesmo projeto do Supabase em que você rodou o SQL).

---

## 4. Perfil existe mas não aparece na lista de Representantes (backoffice)

Se a linha está em **profiles** (e o login funciona) mas **não** em **representantes**, a pessoa não aparece na tela Representantes do backoffice. Inclua ela em **representantes** com o SQL abaixo.

**Se der erro de "null value in column importer_id"**, rode primeiro (uma vez):

```sql
ALTER TABLE public.representantes
ALTER COLUMN importer_id DROP NOT NULL;
```

Depois:

1. Pegue o **id** (UUID) e o **nome** e **email** da linha em **profiles** (ou em **Authentication → Users**).
2. No **SQL Editor**, rode trocando **USER_UUID**, **Nome** e **email@exemplo.com**:

```sql
INSERT INTO public.representantes (user_id, name, email, phone, status)
VALUES (
  'USER_UUID'::uuid,
  'Nome',
  'email@exemplo.com',
  '',
  'active'
);
```

Exemplo (só ilustrativo):

```sql
INSERT INTO public.representantes (user_id, name, email, phone, status)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'Gabriella',
  'gabriella.severo@gmail.com',
  '',
  'active'
);
```

- Use `'pending'` em vez de `'active'` se quiser que apareça como “Pendente” para o admin aprovar.
- Depois de rodar, a pessoa deve aparecer na lista **Representantes** do backoffice.

---

## 5. Login não funciona em produção (com nenhum perfil)

Se o login funciona em desenvolvimento mas **em produção nenhum perfil consegue entrar**, confira na ordem:

### 5.1 Variáveis de ambiente no deploy

No **Vercel** (ou outro host): **Settings** → **Environment Variables**.

- Defina **VITE_SUPABASE_URL** e **VITE_SUPABASE_ANON_KEY** com os valores do **mesmo** projeto Supabase que você usa (Dashboard → Settings → API).
- Importante: no Vite, variáveis `VITE_*` são embutidas no build. Depois de alterar as variáveis, faça um **novo deploy** (Redeploy) para o build passar a usá-las.

Se essas variáveis não estiverem definidas no ambiente de produção no momento do build, o app pode estar usando URL/chave de fallback e o login real não funciona.

### 5.2 URL do site no Supabase

No **Supabase** → **Authentication** → **URL Configuration**:

- **Site URL**: deve ser a URL do app em produção (ex.: `https://seu-app.vercel.app`).
- **Redirect URLs**: inclua a mesma URL de produção (e, se quiser, a de desenvolvimento).

### 5.3 Perfis no banco de produção

Se o projeto Supabase em produção for **diferente** do de desenvolvimento:

- Os usuários que existem em **Auth** precisam ter linha correspondente em **profiles** (veja passos 1 e 2 acima).
- Confirme que as migrations (schema, RLS, trigger `on_auth_user_created`) foram aplicadas nesse projeto, para novos cadastros ganharem perfil automaticamente.

### 5.4 Mensagem de erro na tela

Ao tentar login em produção, anote a **mensagem em vermelho** que aparece:

- **"E-mail ou senha incorretos"** → Auth ok; credenciais erradas ou usuário não existe nesse projeto Supabase.
- **"Perfil não encontrado" / "Seu usuário não possui perfil no sistema"** → Login no Auth funcionou, mas não existe linha em `profiles` para esse usuário (rode o SQL do passo 2 para o projeto de produção).
- **"Erro de conexão"** → App não está conseguindo falar com o Supabase (URL errada, CORS ou rede).
- **"Confirme seu e-mail"** → Ative o usuário no Supabase (Authentication → Users) ou desative "Confirm email" no provider.

Com isso é possível identificar se o problema é ambiente (variáveis/URL), Auth ou falta de perfil.
