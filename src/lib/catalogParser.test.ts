import { describe, expect, it } from 'vitest';
import {
  extractCatalogPriceFromChunk,
  inferCategoryFromCatalog,
  parseCatalogText,
  type CatalogParseLineMeta,
} from './catalogParser';

describe('extractCatalogPriceFromChunk', () => {
  it('usa o menor R$ quando há indicação de promoção', () => {
    const t = `CRS-2591
R$ 10,00
R$ 4,49 PROMOÇÃO
Processador`;
    expect(extractCatalogPriceFromChunk(t)).toBeCloseTo(4.49, 2);
  });

  it('usa o primeiro R$ em ordem quando não há label de promoção', () => {
    expect(extractCatalogPriceFromChunk('À vista R$ 12,34')).toBeCloseTo(12.34, 2);
  });

  it('ignora trechos de DIM e quantidade antes de escanear preços', () => {
    const t = `Quantidade/Caixa: 100
DIM: 9x7x9 cm
R$ 4,49`;
    expect(extractCatalogPriceFromChunk(t)).toBeCloseTo(4.49, 2);
  });
});

describe('inferCategoryFromCatalog', () => {
  it('mapeia processador para nome de categoria existente', () => {
    expect(inferCategoryFromCatalog('Processador manual', '', ['Cozinha', 'Decoração'])).toBe('Cozinha');
  });

  it('retorna Catálogo quando não há categorias cadastradas', () => {
    expect(inferCategoryFromCatalog('Processador', '', [])).toBe('Catálogo');
  });
});

describe('parseCatalogText (layout tipo catálogo)', () => {
  it('extrai SKU, preço promocional e título por heurística', () => {
    const text = `R$ 4,49 PROMOÇÃO
CRS-2591
Processador de Alimentos 170 ml
Quantidade/Caixa: 100
DIM: 9x7x9 cm`;
    const items = parseCatalogText(text);
    expect(items).toHaveLength(1);
    expect(items[0].code).toMatch(/^CRS-2591$/i);
    expect(items[0].price).toBeCloseTo(4.49, 2);
    expect(items[0].name.toLowerCase()).toContain('processador');
    expect(items[0].dimensions.toLowerCase()).toContain('9');
  });

  it('prioriza linha com maior fontHeight quando lineMeta está disponível', () => {
    const lineMeta: CatalogParseLineMeta[] = [
      { text: 'CRS-2591', fontHeight: 9, isBold: false },
      { text: 'Processador de Alimentos 170 ml', fontHeight: 18, isBold: true },
      { text: 'De plástico e aço inox', fontHeight: 10, isBold: false },
      { text: 'Quantidade/Caixa: 100', fontHeight: 8, isBold: false },
    ];
    const text = `CRS-2591
Processador de Alimentos 170 ml
De plástico e aço inox
Quantidade/Caixa: 100
R$ 4,49 PROMOÇÃO`;
    const items = parseCatalogText(text, {
      lineMeta,
      categoryNames: ['Cozinha'],
    });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Processador de Alimentos 170 ml');
    expect(items[0].category).toBe('Cozinha');
    expect(items[0].description?.toLowerCase()).toContain('plástico');
  });
});
