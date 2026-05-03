-- Cadastro de cliente pelo catálogo público (sessão anon). Retorno em jsonb (PostgREST serializa melhor que RETURNS clientes).
-- Se você já criou a versão antiga (RETURNS public.clientes), o DROP abaixo remove antes de recriar.

DROP FUNCTION IF EXISTS public.register_cliente_catalogo(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.register_cliente_catalogo(
  p_representante_row_id uuid,
  p_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_business_name text DEFAULT NULL,
  p_cnpj text DEFAULT NULL,
  p_cep text DEFAULT NULL,
  p_street text DEFAULT NULL,
  p_number text DEFAULT NULL,
  p_complement text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_row public.clientes%ROWTYPE;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' OR p_phone IS NULL OR btrim(p_phone) = '' THEN
    RAISE EXCEPTION 'name_and_phone_required';
  END IF;

  SELECT r.user_id INTO v_profile_id
  FROM public.representantes r
  WHERE r.id = p_representante_row_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'representante_invalid_or_unlinked';
  END IF;

  INSERT INTO public.clientes (
    representante_id,
    name,
    phone,
    email,
    business_name,
    cnpj,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state
  )
  VALUES (
    v_profile_id,
    btrim(p_name),
    btrim(p_phone),
    NULLIF(btrim(p_email), ''),
    NULLIF(btrim(p_business_name), ''),
    NULLIF(btrim(p_cnpj), ''),
    NULLIF(btrim(p_cep), ''),
    NULLIF(btrim(p_street), ''),
    NULLIF(btrim(p_number), ''),
    NULLIF(btrim(p_complement), ''),
    NULLIF(btrim(p_neighborhood), ''),
    NULLIF(btrim(p_city), ''),
    NULLIF(btrim(p_state), '')
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.register_cliente_catalogo(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_cliente_catalogo(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) TO anon;

GRANT EXECUTE ON FUNCTION public.register_cliente_catalogo(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) TO authenticated;

COMMENT ON FUNCTION public.register_cliente_catalogo IS
  'Insere cliente (jsonb da linha); p_representante_row_id = representantes.id; representante_id = representantes.user_id (profiles).';
