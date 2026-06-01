import { describe, expect, it } from 'vitest';
import type { Product } from '@/types';
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

describe('getCatalogCategoryOptions', () => {
  it('lista categorias distintas dos produtos mesmo sem cadastro em categories', () => {
    const products = [
      makeProduct({ id: '1', category: 'Infláveis' }),
      makeProduct({ id: '2', category: 'Piscina' }),
      makeProduct({ id: '3', category: 'Infláveis' }),
    ];
    expect(getCatalogCategoryOptions(products, [], [])).toEqual(['Infláveis', 'Piscina']);
  });

  it('respeita filtro de importadora ao montar categorias', () => {
    const products = [
      makeProduct({ id: '1', importadoraId: 'imp-1', category: 'Infláveis' }),
      makeProduct({ id: '2', importadoraId: 'imp-2', category: 'Ferramentas' }),
    ];
    expect(getCatalogCategoryOptions(products, ['imp-1'], [])).toEqual(['Infláveis']);
  });
});

describe('getCatalogSubcategoryOptions', () => {
  it('inclui subcategorias dos produtos e do cadastro', () => {
    const products = [
      makeProduct({ category: 'Infláveis', subcategory: 'Boias' }),
      makeProduct({ id: '2', category: 'Infláveis', subcategory: 'Colchões' }),
    ];
    const db = [{ name: 'Infláveis', subcategories: ['Boias', 'Bóias'] }];
    expect(getCatalogSubcategoryOptions(products, [], 'Infláveis', db)).toEqual([
      'Boias',
      'Bóias',
      'Colchões',
    ]);
  });
});

describe('productMatchesCatalogFilters', () => {
  it('filtra por categoria selecionada', () => {
    const products = [
      makeProduct({ id: '1', category: 'Infláveis' }),
      makeProduct({ id: '2', category: 'Piscina' }),
    ];
    const filtered = products.filter((product) =>
      productMatchesCatalogFilters(product, {
        searchTerm: '',
        selectedImportadoras: [],
        selectedCategory: 'Infláveis',
        selectedSubcategory: 'all',
      })
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].category).toBe('Infláveis');
  });
});
