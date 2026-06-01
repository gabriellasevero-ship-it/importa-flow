import type { Category, Product } from '@/types';
import {
  consolidateCategoryLabels,
  consolidateSubcategoryLabels,
  resolveCanonicalCategory,
  subcategoriesMatch,
} from '@/lib/catalogCategoryNormalize';

export interface CatalogFilterState {
  searchTerm: string;
  selectedImportadoras: string[];
  selectedCategory: string;
  selectedSubcategory: string;
  dbCategories?: readonly Pick<Category, 'name' | 'subcategories'>[];
}

/**
 * Mesma regra de filtro do catálogo (representante) e do link público do cliente.
 */
export function productMatchesCatalogFilters(
  product: Product,
  state: CatalogFilterState
): boolean {
  if (!product.active) return false;

  const q = state.searchTerm.toLowerCase().trim();
  if (q) {
    const name = product.name.toLowerCase();
    const code = product.code.toLowerCase();
    if (!name.includes(q) && !code.includes(q)) return false;
  }

  if (
    state.selectedImportadoras.length > 0 &&
    !state.selectedImportadoras.includes(product.importadoraId)
  ) {
    return false;
  }

  const dbCategories = state.dbCategories ?? [];
  const selCat = state.selectedCategory === 'all' ? 'all' : state.selectedCategory.trim();
  if (selCat !== 'all') {
    const productCategory = resolveCanonicalCategory(product.category ?? '', dbCategories);
    if (productCategory !== selCat) return false;
  }

  // Com "Todas as categorias", não filtra por subcategoria (evita sumir produto por estado do select)
  if (selCat === 'all') return true;

  const selSub =
    state.selectedSubcategory === 'all' ? 'all' : state.selectedSubcategory.trim();
  if (selSub === 'all') return true;

  const productSub = product.subcategory?.trim();
  if (!productSub) return true;

  return subcategoriesMatch(productSub, selSub);
}

/** Produtos ativos no escopo dos filtros de importadora (sem busca/categoria). */
export function catalogProductsInScope(
  products: readonly Product[],
  selectedImportadoras: readonly string[]
): Product[] {
  return products.filter((product) => {
    if (!product.active) return false;
    if (
      selectedImportadoras.length > 0 &&
      !selectedImportadoras.includes(product.importadoraId)
    ) {
      return false;
    }
    return true;
  });
}

/** Categorias disponíveis no catálogo, consolidadas e alinhadas ao cadastro. */
export function getCatalogCategoryOptions(
  products: readonly Product[],
  selectedImportadoras: readonly string[],
  dbCategories: readonly Pick<Category, 'name'>[] = []
): string[] {
  const rawLabels: string[] = [];
  for (const product of catalogProductsInScope(products, selectedImportadoras)) {
    const category = (product.category ?? '').trim();
    if (category) rawLabels.push(category);
  }
  return consolidateCategoryLabels(rawLabels, dbCategories);
}

/** Subcategorias da categoria selecionada (produtos + cadastro), sem duplicatas. */
export function getCatalogSubcategoryOptions(
  products: readonly Product[],
  selectedImportadoras: readonly string[],
  selectedCategory: string,
  dbCategories: readonly Pick<Category, 'name' | 'subcategories'>[] = []
): string[] {
  if (selectedCategory === 'all') return [];
  const category = selectedCategory.trim();
  const rawLabels: string[] = [];

  const dbCategory = dbCategories.find((c) => c.name.trim() === category);
  for (const sub of dbCategory?.subcategories ?? []) {
    const label = sub.trim();
    if (label) rawLabels.push(label);
  }

  for (const product of catalogProductsInScope(products, selectedImportadoras)) {
    if (resolveCanonicalCategory(product.category ?? '', dbCategories) !== category) continue;
    const sub = product.subcategory?.trim();
    if (sub) rawLabels.push(sub);
  }

  return consolidateSubcategoryLabels(rawLabels);
}
