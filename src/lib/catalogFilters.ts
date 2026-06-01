import type { Product } from '@/types';

export interface CatalogFilterState {
  searchTerm: string;
  selectedImportadoras: string[];
  selectedCategory: string;
  selectedSubcategory: string;
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

  const selCat = state.selectedCategory === 'all' ? 'all' : state.selectedCategory.trim();
  if (selCat !== 'all') {
    const pCat = (product.category ?? '').trim();
    if (pCat !== selCat) return false;
  }

  // Com "Todas as categorias", não filtra por subcategoria (evita sumir produto por estado do select)
  if (selCat === 'all') return true;

  const selSub =
    state.selectedSubcategory === 'all' ? 'all' : state.selectedSubcategory.trim();
  if (selSub === 'all') return true;

  const productSub = product.subcategory?.trim();
  if (!productSub) return true;

  return productSub === selSub;
}
