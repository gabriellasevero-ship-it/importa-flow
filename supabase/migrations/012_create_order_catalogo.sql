-- Pedido feito pelo catálogo público (sessão anon). Igual à ideia de register_cliente_catalogo:
-- valida representante vinculado (user_id), cliente do representante e produtos da importadora.

DROP FUNCTION IF EXISTS public.create_order_catalogo(uuid, uuid, uuid, jsonb, text, text, uuid);

CREATE OR REPLACE FUNCTION public.create_order_catalogo(
  p_representante_row_id uuid,
  p_cliente_id uuid,
  p_importadora_id uuid,
  p_items jsonb,
  p_link_id text DEFAULT NULL,
  p_observations text DEFAULT NULL,
  p_transportadora_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_order_id uuid;
  v_total numeric(12, 2) := 0;
  i int;
  rec jsonb;
  v_pid uuid;
  v_qty int;
  v_obs text;
  v_price numeric(12, 2);
  v_code text;
  v_name text;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'items_required';
  END IF;

  SELECT r.user_id INTO v_profile_id
  FROM public.representantes r
  WHERE r.id = p_representante_row_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'representante_invalid_or_unlinked';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = p_cliente_id
      AND c.representante_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'cliente_invalid';
  END IF;

  FOR i IN 0 .. jsonb_array_length(p_items) - 1 LOOP
    rec := p_items -> i;
    v_pid := (rec ->> 'product_id')::uuid;
    v_qty := COALESCE((rec ->> 'quantity')::int, 0);

    IF v_qty < 1 THEN
      RAISE EXCEPTION 'invalid_quantity';
    END IF;

    SELECT p.price, p.code, p.name INTO v_price, v_code, v_name
    FROM public.products p
    WHERE p.id = v_pid
      AND p.importadora_id = p_importadora_id
      AND p.active = true;

    IF v_price IS NULL THEN
      RAISE EXCEPTION 'product_invalid';
    END IF;

    v_total := v_total + (v_price * v_qty);
  END LOOP;

  INSERT INTO public.orders (
    representante_id,
    cliente_id,
    importadora_id,
    status,
    total,
    observations,
    transportadora_id,
    link_id,
    origin,
    is_read,
    notes
  )
  VALUES (
    v_profile_id,
    p_cliente_id,
    p_importadora_id,
    'aberto',
    v_total,
    NULLIF(btrim(p_observations), ''),
    p_transportadora_id,
    NULLIF(btrim(p_link_id), ''),
    'cliente',
    false,
    NULLIF(btrim(p_observations), '')
  )
  RETURNING id INTO v_order_id;

  FOR i IN 0 .. jsonb_array_length(p_items) - 1 LOOP
    rec := p_items -> i;
    v_pid := (rec ->> 'product_id')::uuid;
    v_qty := (rec ->> 'quantity')::int;
    v_obs := NULLIF(btrim(rec ->> 'observations'), '');

    SELECT p.price, p.code, p.name INTO v_price, v_code, v_name
    FROM public.products p
    WHERE p.id = v_pid
      AND p.importadora_id = p_importadora_id;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_code,
      product_name,
      product_price,
      quantity,
      observations
    )
    VALUES (
      v_order_id,
      v_pid,
      v_code,
      v_name,
      v_price,
      v_qty,
      v_obs
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_catalogo(uuid, uuid, uuid, jsonb, text, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_catalogo(uuid, uuid, uuid, jsonb, text, text, uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.create_order_catalogo(uuid, uuid, uuid, jsonb, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.create_order_catalogo IS
  'Cria pedido+itens a partir do catálogo (anon). p_representante_row_id = public.representantes.id; representante no pedido = representantes.user_id (profiles).';
