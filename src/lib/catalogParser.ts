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
}

const DEFAULT_CATEGORY = 'Catálogo';
const DEFAULT_MIN_ORDER = 1;
const MAX_NAME_LENGTH = 200;

// Preço: R$ 1.234,56 ou R$ 12,34 ou 12,34 ou 10.50
const PRICE_REGEX = /R\$\s*[\d.,]+|\b\d{1,3}(?:\.\d{3})*(?:,\d{2})\b|\b\d+[.,]\d{2}\b/g;

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
 * Extrai o maior valor que pareça preço em uma string (evita pegar ano ou número pequeno errado).
 */
function extractBestPriceFromText(text: string): number {
  const matches = text.match(PRICE_REGEX);
  if (!matches || matches.length === 0) return 0;
  let best = 0;
  for (const m of matches) {
    const n = parsePrice(m.trim());
    if (n > best) best = n;
  }
  return best;
}

/**
 * Extrai o primeiro valor que pareça preço em uma string (compatível com fluxo por linha).
 */
function extractPriceFromText(text: string): number | null {
  const match = text.match(PRICE_REGEX);
  if (!match || match.length === 0) return null;
  return parsePrice(match[0].trim());
}

/**
 * Remove do texto todas as ocorrências de padrão de preço.
 */
function removePricesFromText(text: string): string {
  return text.replace(PRICE_REGEX, ' ').replace(/\s+/g, ' ').trim();
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
  stripped = stripped.replace(/\s+/g, ' ').trim();
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
      const rest = [before, after].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
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
  return text.replace(new RegExp(flexible, 'gi'), ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Interpreta um trecho de texto já associado a um SKU (uma fatia da página ou a página inteira).
 */
function parseProductChunkWithKnownSku(rawChunk: string, sku: string): ParsedCatalogItem {
  const chunk = rawChunk.replace(/\r/g, '').trim();
  const price = extractBestPriceFromText(chunk);
  const minOrder = extractMinOrderFromText(chunk);
  const { dimensions, stripped: afterDim } = extractDimensionsFromText(chunk);
  const { material, rest: afterMat } = extractMaterial(afterDim);
  let nameSource = stripSkuFromText(afterMat, sku);
  nameSource = removePricesFromText(nameSource);
  nameSource = nameSource.replace(QUANTIDADE_CAIXA_REGEX, ' ');
  nameSource = nameSource.replace(/De\s+pl[aá]stico\s*\|\s*Na\s+caixa/gi, ' ');
  nameSource = nameSource.replace(/\s+/g, ' ').trim();

  const lines = nameSource
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !/^\d{1,4}$/.test(l));

  const junk = /^(mercado|amazon|shopee|www\.|http|com\s+[\d.]+)|toy\s*king/i;
  const titleCandidates = lines.filter((l) => !junk.test(l));
  const name =
    (titleCandidates.sort((a, b) => b.length - a.length)[0] || 'Produto importado').slice(0, MAX_NAME_LENGTH);

  return {
    code: sku,
    name: name || 'Produto importado',
    category: DEFAULT_CATEGORY,
    price,
    minOrder,
    material,
    dimensions,
  };
}

/**
 * Vários produtos na mesma página: fatia do início até o próximo SKU (nome costuma vir antes do código).
 */
function tryParseMultiSkuPage(text: string, positions: { sku: string; index: number }[]): ParsedCatalogItem[] | null {
  if (positions.length < 2) return null;

  const items: ParsedCatalogItem[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = i === 0 ? 0 : positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
    const chunk = text.slice(start, end).trim();
    if (!chunk) continue;
    items.push(parseProductChunkWithKnownSku(chunk, positions[i].sku));
  }
  return items.length >= 2 ? items : null;
}

/**
 * Dado um texto de uma linha/bloco (já sem preço), extrai código, nome, material e dimensões.
 */
function parseProductFields(text: string): { code: string; name: string; material: string; dimensions: string } {
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

  return {
    code: code || '',
    name: name || 'Produto importado',
    material,
    dimensions,
  };
}

/**
 * Parseia texto extraído de um PDF de catálogo e retorna uma lista de itens
 * com campos separados (código, nome, preço, material, dimensões).
 */
export function parseCatalogText(text: string): ParsedCatalogItem[] {
  const normalized = text.replace(/\r/g, '').trim();
  if (!normalized.length) return [];

  const skuPositions = findOrderedUniqueSkuMatches(normalized);
  if (skuPositions.length >= 2) {
    const multi = tryParseMultiSkuPage(
      normalized,
      skuPositions.map(({ sku, index }) => ({ sku, index }))
    );
    if (multi) return multi;
  }
  if (skuPositions.length === 1) {
    return [parseProductChunkWithKnownSku(normalized, skuPositions[0].sku)];
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
        const blockPrice = extractPriceFromText(blockText) ?? extractBestPriceFromText(blockText);
        const withoutPrice = removePricesFromText(blockText);
        const { code, name, material, dimensions } = parseProductFields(withoutPrice);
        products.push({
          code,
          name,
          category: DEFAULT_CATEGORY,
          price: blockPrice,
          minOrder: extractMinOrderFromText(blockText),
          material,
          dimensions,
        });
        currentBlock = [];
      }

      const withoutPrice = removePricesFromText(line);
      const { code, name, material, dimensions } = parseProductFields(withoutPrice);
      products.push({
        code,
        name,
        category: DEFAULT_CATEGORY,
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
    const { code, name, material, dimensions } = parseProductFields(withoutPrice);
    const p = extractPriceFromText(blockText);
    products.push({
      code,
      name,
      category: DEFAULT_CATEGORY,
      price: p ?? 0,
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
        const { code, name, material, dimensions } = parseProductFields(withoutPrice);
        return {
          code,
          name: name || line.slice(0, MAX_NAME_LENGTH),
          category: DEFAULT_CATEGORY,
          price: extractBestPriceFromText(line),
          minOrder: extractMinOrderFromText(line),
          material,
          dimensions,
        };
      });
  }

  return products;
}
