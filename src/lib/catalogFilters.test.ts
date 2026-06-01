import { describe, expect, it } from 'vitest';
import type { Product } from '@/types';
import {
  consolidateCategoryLabels,
  resolveCanonicalCategory,
} from './catalogCategoryNormalize';
import {
  getCatalogCategoryOptions,
  getCatalogSubcategoryOptions,
  productMatchesCatalogFilters,
} from './catalogFilters';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    importadoraId: 'imp-1',
    importadoraName: 'Attic Goal',
    code: 'AG-100',
    name: 'Produto teste',
    price: 10,
    minOrder: 12,
    category: 'Infláveis',
    active: true,
    createdAt: new Date(),
    ...overrides,
  };
}

const dbCategories = [
  { name: 'Infláveis' },
  { name: 'Brinquedos' },
  { name: 'Ferramentas' },
  { name: 'Utilidades' },
];

describe('resolveCanonicalCategory', () => {
  it('mapeia variações infláveis para a categoria cadastrada', () => {
    expect(resolveCanonicalCategory('Artigos Infláveis', dbCategories)).toBe('Infláveis');
    expect(resolveCanonicalCategory('Bóia Inflável', dbCategories)).toBe('Infláveis');
    expect(resolveCanonicalCategory('Bóias Infláveis', dbCategories)).toBe('Infláveis');
  });

  it('unifica acentuação', () => {
    expect(resolveCanonicalCategory('Boia Inflável Infantil', dbCategories)).toBe('Infláveis');
    expect(resolveCanonicalCategory('Bóia Inflável Infantil', dbCategories)).toBe('Infláveis');
  });

  it('mapeia brinquedo inflável para Brinquedos', () => {
    expect(resolveCanonicalCategory('Brinquedo Inflável', dbCategories)).toBe('Brinquedos');
  });
});

describe('consolidateCategoryLabels', () => {
  it('remove duplicatas parecidas', () => {
    const labels = [
      'Boia Inflável Infantil',
      'Bóia Inflável Infantil',
      'Artigos Infláveis',
      'Bóias Infláveis',
      'Brinquedo Inflável',
      'Brinquedos',
    ];
    expect(consolidateCategoryLabels(labels, dbCategories)).toEqual([
      'Brinquedos',
      'Infláveis',
    ]);
  });
});

describe('getCatalogCategoryOptions', () => {
  it('lista categorias consolidadas dos produtos', () => {
    const products = [
      makeProduct({ id: '1', category: 'Bóia Inflável' }),
      makeProduct({ id: '2', category: 'Boia Inflável Infantil' }),
      makeProduct({ id: '3', category: 'Brinquedo Inflável' }),
      makeProduct({ id: '4', category: 'Ferramentas' }),
    ];
    expect(getCatalogCategoryOptions(products, [], dbCategories)).toEqual([
      'Brinquedos',
      'Ferramentas',
      'Infláveis',
    ]);
  });

  it('respeita filtro de importadora ao montar categorias', () => {
    const products = [
      makeProduct({ id: '1', importadoraId: 'imp-1', category: 'Infláveis' }),
      makeProduct({ id: '2', importadoraId: 'imp-2', category: 'Ferramentas' }),
    ];
    expect(getCatalogCategoryOptions(products, ['imp-1'], dbCategories)).toEqual(['Infláveis']);
  });
});

describe('getCatalogSubcategoryOptions', () => {
  it('inclui subcategorias dos produtos e do cadastro sem duplicatas', () => {
    const products = [
      makeProduct({ category: 'Infláveis', subcategory: 'Boias' }),
      makeProduct({ id: '2', category: 'Infláveis', subcategory: 'Bóias' }),
      makeProduct({ id: '3', category: 'Infláveis', subcategory: 'Colchões' }),
    ];
    const db = [{ name: 'Infláveis', subcategories: ['Boias', 'Bóias'] }];
    expect(getCatalogSubcategoryOptions(products, [], 'Infláveis', db)).toEqual([
      'Boias',
      'Colchões',
    ]);
  });
});

describe('productMatchesCatalogFilters', () => {
  it('filtra por categoria canônica', () => {
    const products = [
      makeProduct({ id: '1', category: 'Bóia Inflável' }),
      makeProduct({ id: '2', category: 'Ferramentas' }),
    ];
    const filtered = products.filter((product) =>
      productMatchesCatalogFilters(product, {
        searchTerm: '',
        selectedImportadoras: [],
        selectedCategory: 'Infláveis',
        selectedSubcategory: 'all',
        dbCategories,
      })
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].category).toBe('Bóia Inflável');
  });
});
