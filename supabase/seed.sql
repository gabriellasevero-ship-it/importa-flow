-- Local development seed (runs on `supabase start` / `supabase db reset`).
--
-- Hosted Supabase pre-configures table privileges for the anon/authenticated/
-- service_role roles (RLS policies are the real access guard). The local stack
-- does not apply those grants to tables created by SQL migrations, which makes
-- authenticated REST calls fail with "permission denied for table ...".
--
-- These statements replicate the hosted defaults so the app works locally.
-- This file only affects the local dev database; it is never run on a hosted
-- project.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
