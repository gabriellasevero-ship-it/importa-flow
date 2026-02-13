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

// Código no início: alfanumérico, pode ter - _ . (ex: ABC123, REF-001, 001)
const CODE_REGEX = /^([A-Za-z0-9][A-Za-z0-9\-_.]{0,30})\s+/;

// Dimensões: 10x20 cm, 10 x 20cm, 27x8 cm, 100x50mm
const DIMENSIONS_REGEX = /\b(\d+(?:\s*[x×]\s*\d+)(?:\s*(?:cm|mm|m))?)\b/gi;

// Materiais comuns em catálogos (ordem: termos mais longos primeiro)
const MATERIAL_KEYWORDS = [
  'aço inox', 'aço inoxidável', 'alumínio', 'plástico', 'plástica', 'metal', 'metálica',
  'madeira', 'MDF', 'vidro', 'bambu', 'resina', 'poliestireno', 'melamina',
  'ferro', 'cristal', 'porcelana', 'cerâmica', 'tecido', 'acrílico',
];

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
 * Extrai o primeiro valor que pareça preço em uma string.
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

/**
 * Extrai dimensões (ex: "27x8 cm") do texto e remove do texto.
 */
function extractDimensions(text: string): { dimensions: string; rest: string } {
  const match = text.match(DIMENSIONS_REGEX);
  if (!match || match.length === 0) return { dimensions: '', rest: text };
  const dimensions = match[0].trim();
  const rest = text.replace(DIMENSIONS_REGEX, ' ').replace(/\s+/g, ' ').trim();
  return { dimensions, rest };
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

/**
 * Dado um texto de uma linha/bloco (já sem preço), extrai código, nome, material e dimensões.
 */
function parseProductFields(text: string): { code: string; name: string; material: string; dimensions: string } {
  let rest = text.trim();

  const { dimensions, rest: restAfterDim } = extractDimensions(rest);
  rest = restAfterDim;

  const { material, rest: restAfterMat } = extractMaterial(rest);
  rest = restAfterMat;

  let code = '';
  const codeMatch = rest.match(CODE_REGEX);
  if (codeMatch) {
    code = codeMatch[1].trim();
    rest = rest.slice(codeMatch[0].length).trim();
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
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const products: ParsedCatalogItem[] = [];
  let currentBlock: string[] = [];
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const price = extractPriceFromText(line);

    if (price !== null && price >= 0) {
      if (currentBlock.length > 0) {
        const blockText = currentBlock.join(' ');
        const blockPrice = extractPriceFromText(blockText) ?? 0;
        const withoutPrice = removePricesFromText(blockText);
        const { code, name, material, dimensions } = parseProductFields(withoutPrice);
        products.push({
          code: code || `CAT-${++index}`,
          name,
          category: DEFAULT_CATEGORY,
          price: blockPrice,
          minOrder: DEFAULT_MIN_ORDER,
          material,
          dimensions,
        });
        currentBlock = [];
      }

      const withoutPrice = removePricesFromText(line);
      const { code, name, material, dimensions } = parseProductFields(withoutPrice);
      products.push({
        code: code || `CAT-${++index}`,
        name,
        category: DEFAULT_CATEGORY,
        price,
        minOrder: DEFAULT_MIN_ORDER,
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
    products.push({
      code: code || `CAT-${++index}`,
      name,
      category: DEFAULT_CATEGORY,
      price: 0,
      minOrder: DEFAULT_MIN_ORDER,
      material,
      dimensions,
    });
  }

  if (products.length === 0 && lines.length > 0) {
    return lines.slice(0, 500).map((line, i) => {
      const withoutPrice = removePricesFromText(line);
      const { code, name, material, dimensions } = parseProductFields(withoutPrice);
      return {
        code: code || `CAT-${i + 1}`,
        name: name || line.slice(0, MAX_NAME_LENGTH),
        category: DEFAULT_CATEGORY,
        price: 0,
        minOrder: DEFAULT_MIN_ORDER,
        material,
        dimensions,
      };
    });
  }

  return products;
}
