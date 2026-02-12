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

// Preço: R$ 1.234,56 ou R$ 12,34 ou 12,34 ou 10.50 (formato US)
const PRICE_REGEX = /R\$\s*[\d.,]+|[\d]+[.,]\d{2}(?:\s|$)/g;

// Código típico: alfanumérico no início de linha, ex: "ABC123", "REF-001", "001"
const CODE_REGEX = /^([A-Za-z0-9][A-Za-z0-9\-_.]*)\s+/;

/**
 * Normaliza string de preço brasileiro ou com ponto para número.
 * Ex: "R$ 10,50" -> 10.5, "10.50" -> 10.5
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
 * Extrai o primeiro valor que pareça preço de uma linha.
 */
function extractPriceFromLine(line: string): number | null {
  const match = line.match(PRICE_REGEX);
  if (!match || match.length === 0) return null;
  const first = match[0];
  return parsePrice(first);
}

/**
 * Tenta extrair um código de produto do início da linha.
 */
function extractCodeFromLine(line: string): string | null {
  const match = line.match(CODE_REGEX);
  return match ? match[1].trim() : null;
}

/**
 * Parseia texto extraído de um PDF de catálogo e retorna uma lista de itens
 * para criação de produtos. Usa heurísticas para detectar preços (R$ ou decimais)
 * e códigos; formatos de catálogo variam, então os resultados podem precisar
 * de revisão manual.
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
    const price = extractPriceFromLine(line);
    const code = extractCodeFromLine(line);

    // Linha que parece ter preço → provável item de produto
    if (price !== null && price >= 0) {
      // Se tínhamos um bloco acumulado, vira um produto
      if (currentBlock.length > 0) {
        const blockText = currentBlock.join(' ');
        const blockPrice = extractPriceFromLine(blockText) ?? 0;
        const blockCode = extractCodeFromLine(currentBlock[0]) ?? `CAT-${++index}`;
        const name = currentBlock.slice(0, 3).join(' ').trim() || blockText.slice(0, 80);
        products.push({
          code: blockCode,
          name: name.length > 200 ? name.slice(0, 200) : name,
          category: DEFAULT_CATEGORY,
          price: blockPrice,
          minOrder: DEFAULT_MIN_ORDER,
          material: '',
          dimensions: '',
        });
        currentBlock = [];
      }
      const name = line.replace(PRICE_REGEX, '').trim() || line.slice(0, 80);
      products.push({
        code: code ?? `CAT-${++index}`,
        name: name.length > 200 ? name.slice(0, 200) : name,
        category: DEFAULT_CATEGORY,
        price,
        minOrder: DEFAULT_MIN_ORDER,
        material: '',
        dimensions: '',
      });
      continue;
    }

    // Linha sem preço: acumular para possível produto multi-linha
    currentBlock.push(line);
  }

  // Último bloco sem preço: tratar como um produto com nome do bloco
  if (currentBlock.length > 0) {
    const blockText = currentBlock.join(' ');
    const code = extractCodeFromLine(currentBlock[0]) ?? `CAT-${++index}`;
    const name = blockText.slice(0, 200);
    products.push({
      code,
      name,
      category: DEFAULT_CATEGORY,
      price: 0,
      minOrder: DEFAULT_MIN_ORDER,
      material: '',
      dimensions: '',
    });
  }

  // Se não encontrou nenhum item com preço, criar um item por linha (ou por bloco) para não perder conteúdo
  if (products.length === 0 && lines.length > 0) {
    return lines.slice(0, 500).map((line, i) => ({
      code: `CAT-${i + 1}`,
      name: line.length > 200 ? line.slice(0, 200) : line,
      category: DEFAULT_CATEGORY,
      price: 0,
      minOrder: DEFAULT_MIN_ORDER,
      material: '',
      dimensions: '',
    }));
  }

  return products;
}
