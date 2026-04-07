-- Representantes cadastrados manualmente no backoffice podem existir antes de haver
-- usuário em auth/profiles. user_id fica NULL até o vínculo com uma conta.

ALTER TABLE public.representantes
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public.representantes.user_id IS
  'ID do perfil (auth). NULL quando o representante foi pré-cadastrado no backoffice e ainda não possui conta.';
