/*
  Login de cliente no catálogo público (anon): busca por e-mail ou telefone do mesmo representante do link.
  Cadastro no catálogo: se já existir cliente da representante com mesmo telefone (dígitos) ou mesmo e-mail, retorna o existente (sem duplicar).
*/

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
  v_phone_digits text;
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

  v_phone_digits := regexp_replace(btrim(p_phone), '\D', '', 'g');

  SELECT c.* INTO v_row
  FROM public.clientes c
  WHERE c.representante_id = v_profile_id
    AND (
      regexp_replace(c.phone, '\D', '', 'g') = v_phone_digits
      OR (
        NULLIF(btrim(p_email), '') IS NOT NULL
        AND c.email IS NOT NULL
        AND lower(btrim(c.email)) = lower(btrim(p_email))
      )
    )
  ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN to_jsonb(v_row);
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

COMMENT ON FUNCTION public.register_cliente_catalogo(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) IS
  'Catálogo público: insere cliente ou retorna existente (mesmo representante + telefone dígitos ou e-mail).';

CREATE OR REPLACE FUNCTION public.login_cliente_catalogo(
  p_representante_row_id uuid,
  p_identifier text,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_row public.clientes%ROWTYPE;
  v_id text;
  v_id_digits text;
  v_phone_digits text;
BEGIN
  SELECT r.user_id INTO v_profile_id
  FROM public.representantes r
  WHERE r.id = p_representante_row_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'representante_invalid_or_unlinked';
  END IF;

  v_id := btrim(coalesce(p_identifier, ''));
  v_phone_digits := regexp_replace(btrim(coalesce(p_phone, '')), '\D', '', 'g');

  IF v_id = '' AND (v_phone_digits = '' OR length(v_phone_digits) < 8) THEN
    RAISE EXCEPTION 'identifier_required';
  END IF;

  v_id_digits := regexp_replace(v_id, '\D', '', 'g');

  SELECT c.* INTO v_row
  FROM public.clientes c
  WHERE c.representante_id = v_profile_id
    AND (
      (
        position('@' IN v_id) > 0
        AND c.email IS NOT NULL
        AND lower(btrim(c.email)) = lower(v_id)
      )
      OR (
        position('@' IN v_id) = 0
        AND length(v_id_digits) >= 8
        AND regexp_replace(c.phone, '\D', '', 'g') = v_id_digits
      )
      OR (
        length(v_phone_digits) >= 8
        AND regexp_replace(c.phone, '\D', '', 'g') = v_phone_digits
      )
    )
  ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cliente_not_found';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.login_cliente_catalogo(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.login_cliente_catalogo(uuid, text, text) TO anon;

GRANT EXECUTE ON FUNCTION public.login_cliente_catalogo(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.login_cliente_catalogo(uuid, text, text) IS
  'Catálogo público: retorna jsonb do cliente (representantes.id no path); p_identifier = e-mail ou telefone; p_phone = telefone adicional.';
