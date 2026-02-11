# RLS (Row Level Security) – tabela `representantes`

Se o cadastro de representante funciona mas o registro **não aparece na lista do backoffice**, ou se ao se cadastrar aparece erro de permissão, é provável que as políticas RLS da tabela `representantes` estejam bloqueando.

No **Supabase** → **Table Editor** → tabela **representantes** → aba **RLS** (ou **Policies**):

1. **Ative RLS** na tabela (se ainda não estiver ativo).
2. Crie as políticas abaixo no **SQL Editor** (ou pela interface de políticas).

---

## Políticas recomendadas

Execute no **SQL Editor** do Supabase (ajuste o nome da tabela se for diferente):

```sql
-- Permite que um usuário autenticado insira UM registro em representantes
-- com user_id = seu próprio id (cadastro ao se registrar).
CREATE POLICY "representantes_insert_own"
ON public.representantes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Permite que qualquer usuário autenticado leia todos os representantes
-- (admin vê a lista no backoffice; representante pode ver a própria linha se precisar).
CREATE POLICY "representantes_select_authenticated"
ON public.representantes
FOR SELECT
TO authenticated
USING (true);

-- Permite que usuários autenticados atualizem registros (admin altera status, etc.).
CREATE POLICY "representantes_update_authenticated"
ON public.representantes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Permite que usuários autenticados deletem (admin pode remover da lista).
CREATE POLICY "representantes_delete_authenticated"
ON public.representantes
FOR DELETE
TO authenticated
USING (true);
```

---

## Se a tabela ainda não tem RLS

Se RLS **não** estiver habilitado, o problema pode ser outro (ex.: coluna com nome diferente, constraint). Confira:

- Nome da tabela: `representantes`
- Coluna do usuário: `user_id` (tipo `uuid`, compatível com `auth.uid()`)
- Após criar as políticas, **tente se cadastrar de novo** e confira a lista no backoffice.

---

## Confirmação de e-mail (Auth)

Se em **Authentication** → **Providers** → **Email** estiver ativa a opção **Confirm email**, o usuário só recebe sessão depois de clicar no link. Nesse caso o INSERT em `representantes` roda **sem sessão** (anon) e a política `representantes_insert_own` bloqueia.

Soluções:
- **Desativar** "Confirm email" para representantes poderem se cadastrar e aparecer na lista na hora; ou
- Criar um **trigger** no banco que, ao inserir em `auth.users`, insere em `representantes` (assim o insert não depende do cliente).

---

## Teste rápido

1. No Supabase → **Table Editor** → **representantes**, veja se existe alguma linha com o e-mail que você usou no cadastro.
2. Se **não** existir: o INSERT foi bloqueado (RLS ou erro de coluna). Aplique as políticas acima e tente cadastrar novamente.
3. Se **existir**: o SELECT no backoffice está sendo bloqueado. A política `representantes_select_authenticated` resolve.
