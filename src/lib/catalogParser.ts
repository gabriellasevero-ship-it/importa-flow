/**
 * Resultado do parse de um item de catálogo (antes de enviar para createProduct).
 */
export interface ParsedCatalogItem {
  code: string;
  name: string;
  category: string;
  price: number;
  minOrder: number;
  material: string;
  dimensions: string;
  /** Linhas do bloco que não entram no título (specs, observações). */
  description?: string;
}

/** Linha na ordem de leitura do PDF + métricas para escolher o título (maior corpo / negrito). */
export type CatalogParseLineMeta = {
  text: string;
  fontHeight: number;
  isBold: boolean;
};

export const DEFAULT_CATEGORY = 'Catálogo';
const DEFAULT_MIN_ORDER = 1;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;

// Preço genérico (remoção de texto, legado)
const PRICE_REGEX = /R\$\s*[\d.,]+|\b\d{1,3}(?:\.\d{3})*(?:,\d{2})\b|\b\d+[.,]\d{2}\b/g;

/** Valores com símbolo R$ (ordem de leitura em matchAll). */
const RS_PRICE_REGEX = /R\$\s*[\d.,]+/gi;

// Código no início da linha (lista simples)
const CODE_PREFIX_REGEX = /^([A-Za-z0-9][A-Za-z0-9\-_.]{0,30})\s+/;

// Dimensões: 10x20 cm, 22,5x22,5x2,5 cm
const DIMENSIONS_REGEX = /\b(\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)+(?:\s*(?:cm|mm|m))?)\b/gi;

const DIM_LABEL_REGEX = /DIM\s*:?\s*([^\n]+?)(?=\n|$)/gi;

// Materiais comuns em catálogos (ordem: termos mais longos primeiro)
const MATERIAL_KEYWORDS = [
  'aço inox', 'aço inoxidável', 'alumínio', 'plástico', 'plástica', 'metal', 'metálica',
  'madeira', 'MDF', 'vidro', 'bambu', 'resina', 'poliestireno', 'melamina',
  'ferro', 'cristal', 'porcelana', 'cerâmica', 'tecido', 'acrílico',
];

const QUANTIDADE_CAIXA_REGEX = /Quantidade\s*\/\s*Caixa\s*:?\s*(\d+)/i;

/**
 * Normaliza string de preço para número.
 */
function parsePrice(value: string): number {
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/R\$/i, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Preço de catálogo: prioriza R$; em faixa PROMO/PROMOÇÃO usa o menor entre os R$ do trecho;
 * senão o primeiro R$ em ordem de leitura. Só cai em número sem R$ se não houver símbolo.
 */
export function extractCatalogPriceFromChunk(text: string): number {
  let work = text.replace(/\r/g, '');
  work = work.replace(/DIM\s*:?\s*[^\n]+/gi, ' ');
  work = work.replace(/Quantidade\s*\/\s*Caixa\s*:?\s*\d+/gi, ' ');
  const promo = /PROMO[CÇ][AÃO]\s*|PROMOÇÃO/i.test(text);
  RS_PRICE_REGEX.lastIndex = 0;
  const rsMatches = [...work.matchAll(RS_PRICE_REGEX)];
  if (rsMatches.length > 0) {
    const vals = rsMatches
      .map((m) => parsePrice(m[0]))
      .filter((n) => Number.isFinite(n) && n > 0 && n < 10_000_000);
    if (vals.length === 0) return 0;
    if (promo) return Math.min(...vals);
    return vals[0];
  }
  const other = work.match(/\b\d{1,3}(?:\.\d{3})*(?:,\d{2})\b|\b\d+[.,]\d{2}\b/g);
  if (!other?.length) return 0;
  return parsePrice(other[0]);
}

/**
 * Extrai o maior valor que pareça preço em uma string (evita pegar ano ou número pequeno errado).
 */
function extractBestPriceFromText(text: string): number {
  return extractCatalogPriceFromChunk(text);
}

/**
 * Extrai o primeiro valor que pareça preço em uma string (compatível com fluxo por linha).
 */
function extractPriceFromText(text: string): number | null {
  const n = extractCatalogPriceFromChunk(text);
  return n > 0 ? n : null;
}

/**
 * Remove do texto todas as ocorrências de padrão de preço.
 */
function removePricesFromText(text: string): string {
  return text
    .replace(PRICE_REGEX, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

function extractMinOrderFromText(text: string): number {
  const m = text.match(QUANTIDADE_CAIXA_REGEX);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_MIN_ORDER;
}

const SKU_IN_TEXT_REGEX =
  /\b([A-Za-z]{2,})\s*[-_]\s*([A-Za-z0-9]{2,}(?:\s*[-_]\s*[A-Za-z0-9]+)*)\b/gi;

function skuKeyFromMatch(m: RegExpExecArray): string {
  return `${m[1]}-${m[2].replace(/\s+/g, '')}`;
}

/** SKUs distintos na ordem em que aparecem no texto (inclui comprimento do match bruto no PDF). */
export function findOrderedUniqueSkuMatches(text: string): { sku: string; index: number; length: number }[] {
  const re = new RegExp(SKU_IN_TEXT_REGEX.source, 'gi');
  const seen = new Set<string>();
  const out: { sku: string; index: number; length: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const sku = skuKeyFromMatch(m);
    if (seen.has(sku)) continue;
    seen.add(sku);
    out.push({ sku, index: m.index, length: m[0].length });
  }
  return out;
}

export function findOrderedUniqueSkuPositions(text: string): { sku: string; index: number }[] {
  return findOrderedUniqueSkuMatches(text).map(({ sku, index }) => ({ sku, index }));
}

function extractDimensionsFromText(text: string): { dimensions: string; stripped: string } {
  let stripped = text;
  let found = '';
  DIM_LABEL_REGEX.lastIndex = 0;
  const dimLabel = DIM_LABEL_REGEX.exec(text);
  if (dimLabel) {
    found = dimLabel[1].trim();
    stripped = stripped.replace(dimLabel[0], ' ');
  }
  const geo = stripped.match(DIMENSIONS_REGEX);
  if (geo && geo[0]) {
    const g = geo[0].trim();
    if (!found || g.length > found.length) found = g;
    stripped = stripped.replace(DIMENSIONS_REGEX, ' ');
  }
  stripped = stripped
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
  return { dimensions: found, stripped };
}

/**
 * Extrai material (palavra-chave conhecida) do texto e remove do texto.
 */
function extractMaterial(text: string): { material: string; rest: string } {
  const lower = text.toLowerCase();
  for (const kw of MATERIAL_KEYWORDS) {
    const idx = lower.indexOf(kw);
    if (idx !== -1) {
      const before = text.slice(0, idx).trim();
      const after = text.slice(idx + kw.length).trim();
      const rest = [before, after]
        .filter(Boolean)
        .join('\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n[ \t]+/g, '\n')
        .trim();
      return { material: kw, rest };
    }
  }
  return { material: '', rest: text };
}

function extractSkuFromText(text: string): string {
  const m = text.match(/\b([A-Za-z]{2,})\s*[-_]\s*([A-Za-z0-9]{2,}(?:\s*[-_]\s*[A-Za-z0-9]+)*)\b/);
  if (!m) return '';
  return `${m[1]}-${m[2].replace(/\s+/g, '')}`;
}

function stripSkuFromText(text: string, sku: string): string {
  if (!sku) return text;
  const [prefix, ...restParts] = sku.split('-');
  const suffix = restParts.join('-');
  const flexible = `${prefix}\\s*[-_]\\s*${suffix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`;
  return text
    .replace(new RegExp(flexible, 'gi'), ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\u0300-\u036f/g, '');
}

const CATEGORY_KEYWORD_HINTS: { re: RegExp; hints: string[] }[] = [
  {
    re: /processador|ralador|mixer|liquidificador|cafeteira|chaleira|panela|frigideira|faqueiro|copos?|pratos?|bowl|tigela|talheres?|utens[ií]lios?|potes?|organizador|descascador|ralo/i,
    hints: ['Cozinha', 'Utensílios', 'Mesa', 'Utilidades', 'Houseware', 'Utilidades Domésticas'],
  },
  {
    re: /toalhas?|tapetes?|cortinas?|almofadas?|decora/i,
    hints: ['Decoração', 'Cama', 'Casa', 'Têxtil'],
  },
  {
    re: /ferramenta|parafuso|furadeira|serra|martelo|chave\b/i,
    hints: ['Ferramentas', 'Construção', 'Jardim'],
  },
];

/**
 * Escolhe uma categoria existente no sistema com base no nome/material (heurística).
 */
export function inferCategoryFromCatalog(
  name: string,
  material: string,
  categoryNames: readonly string[]
): string {
  if (!categoryNames.length) return DEFAULT_CATEGORY;
  const pool = stripDiacritics(`${name} ${material}`).toLowerCase();
  const normCat = (s: string) => stripDiacritics(s).trim().toLowerCase();

  for (const row of CATEGORY_KEYWORD_HINTS) {
    if (!row.re.test(pool)) continue;
    for (const hint of row.hints) {
      const nh = normCat(hint);
      const exact = categoryNames.find((c) => normCat(c) === nh);
      if (exact) return exact;
      const partial = categoryNames.find(
        (c) => normCat(c).includes(nh) || nh.includes(normCat(c))
      );
      if (partial) return partial;
    }
  }
  for (const c of categoryNames) {
    const nc = normCat(c);
    if (nc.length > 2 && pool.includes(nc)) return c;
  }
  return DEFAULT_CATEGORY;
}

function isMetaCatalogLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2) return true;
  if (/^(quantidade|dim\s|atualizado em|www\.|https?:)/i.test(t)) return true;
  if (/^\d{1,4}$/.test(t)) return true;
  if (/^R\$\s*[\d.,]+\s*$/i.test(t)) return true;
  if (/quantidade\s*\/\s*caixa/i.test(t)) return true;
  if (/^DIM\s*:/i.test(t)) return true;
  if (/^promo(c?|ç)/i.test(t)) return true;
  return false;
}

function lineOverlapsChunk(lineText: string, chunk: string): boolean {
  const a = stripDiacritics(lineText)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const b = stripDiacritics(chunk)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (a.length < 4) return false;
  if (b.includes(a)) return true;
  const words = a.split(' ').filter((w) => w.length > 2);
  if (words.length === 0) return false;
  return words.every((w) => b.includes(w));
}

function pickTitleAndDescription(
  chunk: string,
  sku: string,
  cleanedMultiline: string,
  lineMeta?: CatalogParseLineMeta[]
): { name: string; description: string } {
  const junk = /^(mercado|amazon|shopee|www\.|http|com\s+[\d.]+)|toy\s*king/i;

  if (lineMeta?.length && sku) {
    const [prefix, ...restParts] = sku.split('-');
    const suffix = restParts.join('-');
    const skuOnly = new RegExp(
      `^${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*[-_]\\s*${suffix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*$`,
      'i'
    );
    const rows = lineMeta.filter((row) => {
      const t = row.text.replace(/\r/g, '').trim();
      if (!t || junk.test(t) || isMetaCatalogLine(t)) return false;
      if (skuOnly.test(t)) return false;
      return lineOverlapsChunk(t, chunk);
    });
    if (rows.length > 0) {
      const sorted = [...rows].sort(
        (a, b) =>
          b.fontHeight - a.fontHeight ||
          Number(b.isBold) - Number(a.isBold) ||
          b.text.length - a.text.length
      );
      const best = sorted[0];
      const name = best.text.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
      const otherTexts: string[] = [];
      for (const r of sorted.slice(1)) {
        const tx = r.text.replace(/\s+/g, ' ').trim();
        if (tx && tx !== name) otherTexts.push(tx);
      }
      const description = otherTexts.join('\n').slice(0, MAX_DESCRIPTION_LENGTH);
      return { name: name || 'Produto importado', description };
    }
  }

  const lines = cleanedMultiline
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !/^\d{1,4}$/.test(l));
  const nonMeta = lines.filter((l) => !junk.test(l) && !isMetaCatalogLine(l));
  const titleLine =
    nonMeta.find((l) => l.length >= 8) ||
    [...nonMeta].sort((a, b) => b.length - a.length)[0] ||
    'Produto importado';
  const rest = nonMeta.filter((l) => l !== titleLine);
  return {
    name: titleLine.slice(0, MAX_NAME_LENGTH),
    description: rest.join('\n').slice(0, MAX_DESCRIPTION_LENGTH),
  };
}

export type ParseCatalogTextOptions = {
  lineMeta?: CatalogParseLineMeta[];
  categoryNames?: readonly string[];
};

/**
 * Interpreta um trecho de texto já associado a um SKU (uma fatia da página ou a página inteira).
 */
function parseProductChunkWithKnownSku(
  rawChunk: string,
  sku: string,
  options?: ParseCatalogTextOptions
): ParsedCatalogItem {
  const chunk = rawChunk.replace(/\r/g, '').trim();
  const price = extractCatalogPriceFromChunk(chunk);
  const minOrder = extractMinOrderFromText(chunk);
  const { dimensions, stripped: afterDim } = extractDimensionsFromText(chunk);
  const { material, rest: afterMat } = extractMaterial(afterDim);
  let nameSource = stripSkuFromText(afterMat, sku);
  nameSource = removePricesFromText(nameSource);
  nameSource = nameSource.replace(QUANTIDADE_CAIXA_REGEX, ' ');
  nameSource = nameSource.replace(/De\s+pl[aá]stico\s*\|\s*Na\s+caixa/gi, ' ');
  const cleanedMultiline = nameSource.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

  const { name, description } = pickTitleAndDescription(
    chunk,
    sku,
    cleanedMultiline,
    options?.lineMeta
  );
  const category = inferCategoryFromCatalog(
    name,
    material,
    options?.categoryNames ?? []
  );

  return {
    code: sku,
    name: name || 'Produto importado',
    category,
    price,
    minOrder,
    material,
    dimensions,
    ...(description.trim() ? { description: description.trim() } : {}),
  };
}

/**
 * Vários produtos na mesma página: fatia do início até o próximo SKU (nome costuma vir antes do código).
 */
function tryParseMultiSkuPage(
  text: string,
  positions: { sku: string; index: number }[],
  options?: ParseCatalogTextOptions
): ParsedCatalogItem[] | null {
  if (positions.length < 2) return null;

  const items: ParsedCatalogItem[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = i === 0 ? 0 : positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
    const chunk = text.slice(start, end).trim();
    if (!chunk) continue;
    items.push(parseProductChunkWithKnownSku(chunk, positions[i].sku, options));
  }
  return items.length >= 2 ? items : null;
}

/**
 * Dado um texto de uma linha/bloco (já sem preço), extrai código, nome, material e dimensões.
 */
function parseProductFields(
  text: string,
  categoryNames?: readonly string[]
): { code: string; name: string; material: string; dimensions: string; category: string } {
  let { dimensions, stripped: rest } = extractDimensionsFromText(text.trim());

  const { material, rest: restAfterMat } = extractMaterial(rest);
  rest = restAfterMat;

  let code = '';
  const codeMatch = rest.match(CODE_PREFIX_REGEX);
  if (codeMatch) {
    code = codeMatch[1].trim();
    rest = rest.slice(codeMatch[0].length).trim();
  }

  if (!code) {
    code = extractSkuFromText(rest);
    rest = stripSkuFromText(rest, code);
  }

  const name = rest
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);

  const category = inferCategoryFromCatalog(
    name || 'Produto importado',
    material,
    categoryNames ?? []
  );

  return {
    code: code || '',
    name: name || 'Produto importado',
    material,
    dimensions,
    category,
  };
}

/**
 * Parseia texto extraído de um PDF de catálogo e retorna uma lista de itens
 * com campos separados (código, nome, preço, material, dimensões).
 */
export function parseCatalogText(text: string, options?: ParseCatalogTextOptions): ParsedCatalogItem[] {
  const normalized = text.replace(/\r/g, '').trim();
  if (!normalized.length) return [];

  const cats = options?.categoryNames ?? [];

  const skuPositions = findOrderedUniqueSkuMatches(normalized);
  if (skuPositions.length >= 2) {
    const multi = tryParseMultiSkuPage(
      normalized,
      skuPositions.map(({ sku, index }) => ({ sku, index })),
      options
    );
    if (multi) return multi;
  }
  if (skuPositions.length === 1) {
    return [parseProductChunkWithKnownSku(normalized, skuPositions[0].sku, options)];
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const products: ParsedCatalogItem[] = [];
  let currentBlock: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const price = extractPriceFromText(line);

    if (price !== null && price >= 0) {
      if (currentBlock.length > 0) {
        const blockText = currentBlock.join(' ');
        const blockPrice = extractCatalogPriceFromChunk(blockText);
        const withoutPrice = removePricesFromText(blockText);
        const { code, name, material, dimensions, category } = parseProductFields(withoutPrice, cats);
        products.push({
          code,
          name,
          category,
          price: blockPrice,
          minOrder: extractMinOrderFromText(blockText),
          material,
          dimensions,
        });
        currentBlock = [];
      }

      const withoutPrice = removePricesFromText(line);
      const { code, name, material, dimensions, category } = parseProductFields(withoutPrice, cats);
      products.push({
        code,
        name,
        category,
        price,
        minOrder: extractMinOrderFromText(line),
        material,
        dimensions,
      });
      continue;
    }

    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    const blockText = currentBlock.join(' ');
    const withoutPrice = removePricesFromText(blockText);
    const { code, name, material, dimensions, category } = parseProductFields(withoutPrice, cats);
    const p = extractCatalogPriceFromChunk(blockText);
    products.push({
      code,
      name,
      category,
      price: p,
      minOrder: extractMinOrderFromText(blockText),
      material,
      dimensions,
    });
  }

  if (products.length === 0 && lines.length > 0) {
    return lines
      .filter((line) => !/^\d{1,4}$/.test(line.trim()) && line.trim().length > 2)
      .slice(0, 500)
      .map((line) => {
        const withoutPrice = removePricesFromText(line);
        const { code, name, material, dimensions, category } = parseProductFields(withoutPrice, cats);
        return {
          code,
          name: name || line.slice(0, MAX_NAME_LENGTH),
          category,
          price: extractCatalogPriceFromChunk(line),
          minOrder: extractMinOrderFromText(line),
          material,
          dimensions,
        };
      });
  }

  return products;
}
