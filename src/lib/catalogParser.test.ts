import { describe, expect, it } from 'vitest';
import {
  detectCatalogTextLayout,
  extractCatalogPriceFromChunk,
  inferCategoryFromCatalog,
  isCatalogContentPage,
  isMetaCatalogLine,
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

describe('isMetaCatalogLine', () => {
  it('trata linha de estoque como meta', () => {
    expect(isMetaCatalogLine('Estoque: 18 caixas')).toBe(true);
  });
});

describe('detectCatalogTextLayout', () => {
  const akashMeta: CatalogParseLineMeta[] = [
    { text: 'CRS-2168', fontHeight: 9, isBold: false, y: 400 },
    { text: 'R$ 5,75', fontHeight: 10, isBold: false, y: 380 },
    { text: 'Bóia Fundo do Mar', fontHeight: 14, isBold: true, y: 360 },
    { text: 'Quantidade/Caixa: 100', fontHeight: 8, isBold: false, y: 340 },
  ];

  const toyKingMeta: CatalogParseLineMeta[] = [
    { text: 'Jogo Xadrez Magnético', fontHeight: 16, isBold: false, y: 500 },
    { text: 'TK-AB0476', fontHeight: 10, isBold: false, y: 480 },
    { text: 'R$ 18,00', fontHeight: 10, isBold: false, y: 478 },
    { text: 'Quantidade/Caixa: 96', fontHeight: 8, isBold: false, y: 460 },
  ];

  it('detecta layout Akash (código antes do título)', () => {
    const chunk = akashMeta.map((m) => m.text).join('\n');
    expect(detectCatalogTextLayout(chunk, 'CRS-2168', akashMeta)).toBe('codeBeforeTitle');
  });

  it('detecta layout Toy King (título antes do código)', () => {
    const chunk = toyKingMeta.map((m) => m.text).join('\n');
    expect(detectCatalogTextLayout(chunk, 'TK-AB0476', toyKingMeta)).toBe('titleBeforeCode');
  });
});

describe('parseCatalogText (layout Akash)', () => {
  it('extrai código, preço, título em negrito e descrição com Na caixa', () => {
    const lineMeta: CatalogParseLineMeta[] = [
      { text: 'CRS-2168', fontHeight: 9, isBold: false, y: 400 },
      { text: 'R$ 5,75', fontHeight: 10, isBold: false, y: 380 },
      { text: 'Bóia Fundo do Mar', fontHeight: 14, isBold: true, y: 360 },
      { text: 'Quantidade/Caixa: 100', fontHeight: 8, isBold: false, y: 340 },
      { text: 'De plástico', fontHeight: 9, isBold: false, y: 320 },
      { text: 'DIM: 61 cm', fontHeight: 8, isBold: false, y: 300 },
      { text: 'Na caixa', fontHeight: 8, isBold: false, y: 280 },
      { text: 'Estoque: 18 caixas', fontHeight: 8, isBold: false, y: 260 },
    ];
    const text = lineMeta.map((m) => m.text).join('\n');
    const items = parseCatalogText(text, { lineMeta, categoryNames: ['Verão'] });
    expect(items).toHaveLength(1);
    expect(items[0].code).toMatch(/^CRS-2168$/i);
    expect(items[0].price).toBeCloseTo(5.75, 2);
    expect(items[0].name).toBe('Bóia Fundo do Mar');
    expect(items[0].minOrder).toBe(100);
    expect(items[0].material).toContain('plástico');
    expect(items[0].dimensions.toLowerCase()).toContain('61');
    expect(items[0].description?.toLowerCase()).toContain('na caixa');
    expect(items[0].description?.toLowerCase() ?? '').not.toContain('estoque');
  });
});

describe('parseCatalogText (layout Toy King)', () => {
  it('usa título antes do SKU e mantém linhas extras na descrição', () => {
    const lineMeta: CatalogParseLineMeta[] = [
      { text: 'Jogo Xadrez Magnético', fontHeight: 16, isBold: false, y: 500 },
      { text: 'TK-AB0476 R$ 18,00', fontHeight: 10, isBold: false, y: 480 },
      { text: 'Quantidade/Caixa: 96', fontHeight: 8, isBold: false, y: 460 },
      { text: 'De plástico', fontHeight: 9, isBold: false, y: 440 },
      { text: 'Dim: 27,5x22,5x3,5 cm', fontHeight: 8, isBold: false, y: 420 },
      { text: 'Na caixa', fontHeight: 8, isBold: false, y: 400 },
      { text: 'Com roleta de micos', fontHeight: 8, isBold: false, y: 380 },
    ];
    const text = lineMeta.map((m) => m.text).join('\n');
    const items = parseCatalogText(text, { lineMeta });
    expect(items).toHaveLength(1);
    expect(items[0].code).toMatch(/^TK-AB0476$/i);
    expect(items[0].price).toBeCloseTo(18, 2);
    expect(items[0].name).toBe('Jogo Xadrez Magnético');
    expect(items[0].description?.toLowerCase()).toContain('roleta');
    expect(items[0].description?.toLowerCase()).toContain('na caixa');
  });
});

describe('parseCatalogText (layout tipo catálogo legado)', () => {
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
      { text: 'CRS-2591', fontHeight: 9, isBold: false, y: 400 },
      { text: 'Processador de Alimentos 170 ml', fontHeight: 18, isBold: true, y: 360 },
      { text: 'De plástico e aço inox', fontHeight: 10, isBold: false, y: 320 },
      { text: 'Quantidade/Caixa: 100', fontHeight: 8, isBold: false, y: 300 },
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

describe('isCatalogContentPage', () => {
  it('sempre ignora a primeira página do PDF', () => {
    const productPage = `CRS-2168
R$ 5,75
Bóia Fundo do Mar
Quantidade/Caixa: 100
DIM: 61 cm`;
    expect(isCatalogContentPage(productPage, 0)).toBe(false);
    expect(isCatalogContentPage(productPage, 1)).toBe(true);
  });

  it('ignora capa promocional sem blocos de produto', () => {
    const cover = `Novidades
Akash IMPORTS
DESCONTO DE 10% EM TODA A TABELA
verão 2026`;
    expect(isCatalogContentPage(cover, 1)).toBe(false);
  });

  it('aceita página com vários SKUs e quantidade por caixa', () => {
    const page = `CRS-2168 R$ 5,75 Bóia
Quantidade/Caixa: 100
CRS-2170 R$ 10,00 Bóia
Quantidade/Caixa: 100`;
    expect(isCatalogContentPage(page, 2)).toBe(true);
  });
});
