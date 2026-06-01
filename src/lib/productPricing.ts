import type { Product } from '@/types';

type PricedProduct = Pick<Product, 'price' | 'minOrder'>;

export function getUnitsPerBox(product: PricedProduct): number {
  return Math.max(1, product.minOrder);
}

/** Preço por unidade (valor armazenado no produto). */
export function getUnitPrice(product: Pick<Product, 'price'>): number {
  return product.price;
}

/** Preço total de uma caixa (unidade × quantidade por caixa). */
export function getBoxPrice(product: PricedProduct): number {
  return getUnitPrice(product) * getUnitsPerBox(product);
}

/** Total da linha: quantidade de caixas × preço da caixa. */
export function getCartLineTotal(item: {
  product: PricedProduct;
  quantity: number;
}): number {
  return getBoxPrice(item.product) * item.quantity;
}

export function formatPriceBRL(value: number): string {
  return value.toFixed(2);
}
