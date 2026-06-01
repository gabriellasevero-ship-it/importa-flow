/** UUID no path do catálogo (primeiro segmento após /catalogo/). Evita confundir com slug curto. */
export const CATALOG_PATH_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
