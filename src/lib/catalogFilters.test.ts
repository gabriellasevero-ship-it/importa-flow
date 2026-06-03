import { describe, expect, it } from 'vitest';
import type { Product } from '@/types';
import {
  consolidateCategoryLabels,
  getEffectiveProductCategory,
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
  { name: 'Mergulho' },
  { name: 'Papelaria' },
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

describe('getEffectiveProductCategory', () => {
  it('infere Infláveis para produto com categoria Catálogo e nome de boia', () => {
    const product = makeProduct({
      category: 'Catálogo',
      name: 'Bóia Inflável Infantil Unicórnio',
    });
    expect(getEffectiveProductCategory(product, dbCategories)).toBe('Infláveis');
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
  it('consolida famílias embutidas sem cadastro no banco', () => {
    const products = [
      makeProduct({ id: '1', category: 'Bóia Inflável' }),
      makeProduct({ id: '2', category: 'Boia Inflável Infantil' }),
      makeProduct({ id: '3', category: 'Artigos Infláveis' }),
      makeProduct({ id: '4', category: 'Brinquedo Inflável' }),
      makeProduct({ id: '5', category: 'Ferramentas' }),
    ];
    expect(getCatalogCategoryOptions(products, [], [])).toEqual([
      'Brinquedos',
      'Ferramentas',
      'Infláveis',
    ]);
  });

  it('lista só categorias cadastradas que têm produtos', () => {
    const products = [
      makeProduct({ id: '1', category: 'Bóia Inflável' }),
      makeProduct({ id: '2', category: 'Boia Inflável Infantil' }),
      makeProduct({ id: '3', category: 'Brinquedo Inflável' }),
      makeProduct({ id: '4', category: 'Ferramentas' }),
      makeProduct({ id: '5', category: 'Catálogo', name: 'Colchão Inflável' }),
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

  it('inclui produto Catálogo quando nome indica inflável', () => {
    const products = [
      makeProduct({ id: '1', category: 'Catálogo', name: 'Boia Fundo do Mar' }),
      makeProduct({ id: '2', category: 'Ferramentas', name: 'Alicate' }),
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
    expect(filtered[0].name).toContain('Boia');
  });
});
