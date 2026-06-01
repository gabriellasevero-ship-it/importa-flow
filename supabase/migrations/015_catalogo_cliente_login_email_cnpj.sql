/*
  Catálogo do cliente:
  - login_cliente_catalogo: e-mail + CNPJ (14 dígitos) para autenticar.
  - register_cliente_catalogo: deduplica primeiro por CNPJ (mesmo representante + 14 dígitos);
    mantém fallback por telefone/e-mail quando CNPJ vazio ou incompleto (legado).
*/

DROP FUNCTION IF EXISTS public.login_cliente_catalogo(uuid, text, text);

CREATE OR REPLACE FUNCTION public.login_cliente_catalogo(
  p_representante_row_id uuid,
  p_email text,
  p_cnpj text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_row public.clientes%ROWTYPE;
  v_email text;
  v_cnpj_digits text;
BEGIN
  SELECT r.user_id INTO v_profile_id
  FROM public.representantes r
  WHERE r.id = p_representante_row_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'representante_invalid_or_unlinked';
  END IF;

  v_email := lower(btrim(coalesce(p_email, '')));
  v_cnpj_digits := regexp_replace(btrim(coalesce(p_cnpj, '')), '\D', '', 'g');

  IF v_email = '' OR length(v_cnpj_digits) < 14 THEN
    RAISE EXCEPTION 'email_and_cnpj_required';
  END IF;

  SELECT c.* INTO v_row
  FROM public.clientes c
  WHERE c.representante_id = v_profile_id
    AND c.email IS NOT NULL
    AND lower(btrim(c.email)) = v_email
    AND c.cnpj IS NOT NULL
    AND regexp_replace(c.cnpj, '\D', '', 'g') = v_cnpj_digits
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
  'Catálogo público: login com e-mail + CNPJ (14 dígitos). p_representante_row_id = representantes.id.';

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
  v_cnpj_digits text;
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
  v_cnpj_digits := regexp_replace(btrim(coalesce(p_cnpj, '')), '\D', '', 'g');

  IF length(v_cnpj_digits) >= 14 THEN
    SELECT c.* INTO v_row
    FROM public.clientes c
    WHERE c.representante_id = v_profile_id
      AND c.cnpj IS NOT NULL
      AND regexp_replace(c.cnpj, '\D', '', 'g') = v_cnpj_digits
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'cliente', to_jsonb(v_row),
        'is_new', false
      );
    END IF;
  END IF;

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
    RETURN jsonb_build_object(
      'cliente', to_jsonb(v_row),
      'is_new', false
    );
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

  RETURN jsonb_build_object(
    'cliente', to_jsonb(v_row),
    'is_new', true
  );
END;
$$;

COMMENT ON FUNCTION public.register_cliente_catalogo(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) IS
  'Catálogo público: { cliente, is_new }. Deduplica por CNPJ (14 dígitos) por representante; senão telefone/e-mail.';
