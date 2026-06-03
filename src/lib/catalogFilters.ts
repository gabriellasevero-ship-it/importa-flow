import type { Category, Product } from '@/types';
import {
  consolidateCategoryLabels,
  consolidateSubcategoryLabels,
  getEffectiveProductCategory,
  normalizeCategoryKey,
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
    const productCategory = getEffectiveProductCategory(product, dbCategories);
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
  const inScope = catalogProductsInScope(products, selectedImportadoras);
  const dbNames = dbCategories.map((c) => c.name.trim()).filter(Boolean);

  const effective = inScope
    .map((product) => getEffectiveProductCategory(product, dbCategories))
    .filter(Boolean);

  const rawLabels = inScope
    .map((p) => (p.category ?? '').trim())
    .filter(Boolean);

  let consolidated = consolidateCategoryLabels(
    effective.length > 0 ? effective : rawLabels,
    dbCategories
  ).filter((label) => Boolean(normalizeCategoryKey(label)));

  if (consolidated.length > 1) {
    consolidated = consolidated.filter(
      (label) => normalizeCategoryKey(label) !== 'catalogo'
    );
  }

  if (dbNames.length > 0) {
    const canonicalSet = new Set(effective);
    const fromRegistry = dbNames.filter(
      (dbName) => canonicalSet.has(dbName) || consolidated.includes(dbName)
    );
    if (fromRegistry.length > 0) {
      return fromRegistry.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }
  }

  return consolidated;
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
    if (getEffectiveProductCategory(product, dbCategories) !== category) continue;
    const sub = product.subcategory?.trim();
    if (sub) rawLabels.push(sub);
  }

  return consolidateSubcategoryLabels(rawLabels);
}
