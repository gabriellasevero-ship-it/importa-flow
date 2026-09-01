# AGENTS.md

## Cursor Cloud specific instructions

Importa Flow is a single Vite + React 18 (TypeScript) frontend (repo root) backed by
Supabase (Postgres + Auth + Storage). There is no separate backend server; `api/*`
and `supabase/functions/*` are optional serverless proxies/Edge Functions. Standard
commands live in `package.json`: `npm run dev` (Vite on `http://localhost:5173`),
`npm test` (Vitest), `npm run build`.

### Supabase backend (required for auth + any data flow)

- The Supabase project committed in `.env.example` (`kfazbwaxvbhpqnzuxsft.supabase.co`)
  is unreachable (NXDOMAIN). Do not rely on it. Use a local Supabase stack instead,
  or set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (via `.env`) to your own project.
- Start the local stack with `npx supabase start` (needs Docker; the CLI applies all
  `supabase/migrations/*` and then `supabase/seed.sql` automatically). It prints the
  local `API_URL` (`http://127.0.0.1:54321`) and `ANON_KEY`. It is NOT auto-started on
  VM boot — start it each session before running the app against real data.
- `.env` (gitignored) must point at the local stack. For a default local stack the
  values are stable:
  - `VITE_SUPABASE_URL=http://127.0.0.1:54321`
  - `VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
- Non-obvious gotcha: SQL migrations create tables owned by `postgres` without the
  table-level GRANTs that hosted Supabase auto-adds, so authenticated REST calls fail
  with `permission denied for table ...` (surfaces in the app as
  "Seu usuário não possui perfil no sistema"). `supabase/seed.sql` restores those grants
  (RLS policies remain the real access guard). If you ever apply migrations without the
  seed, re-run `supabase/seed.sql` against the DB.

### Logging in (no self-register UI on the login screen)

The login page only supports email/password. Create a confirmed user via the admin API,
then promote it in `profiles` (a trigger auto-creates the profile row with role
`representante`; `admin` unlocks the backoffice: Importadoras/Representantes). Example
using the local stack service-role key printed by `supabase start`:

```
curl -X POST http://127.0.0.1:54321/auth/v1/admin/users \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@importaflow.local","password":"Admin12345","email_confirm":true}'
# then, because service_role also lacks PostgREST grants, set role via psql:
docker exec -i supabase_db_workspace psql -U postgres -d postgres \
  -c "UPDATE public.profiles SET role='admin' WHERE email='admin@importaflow.local';"
```

### Notes

- Some browser-console errors (`/api/invite-representative`, `/api/extract-catalog-page`)
  are expected in dev: those Vite-proxied Edge Functions are optional and not served
  locally unless you run `supabase functions serve`. They do not block core flows.
