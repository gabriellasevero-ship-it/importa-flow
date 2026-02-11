# Conferir e corrigir perfis (profiles) no Supabase

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
