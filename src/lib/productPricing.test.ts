import { describe, expect, it } from 'vitest';
import { getBoxPrice, getCartLineTotal, getUnitPrice, getUnitsPerBox } from './productPricing';

describe('productPricing', () => {
  const product = { price: 5.75, minOrder: 100 };

  it('calcula unidades por caixa com mínimo 1', () => {
    expect(getUnitsPerBox({ price: 10, minOrder: 0 })).toBe(1);
    expect(getUnitsPerBox(product)).toBe(100);
  });

  it('calcula preço unitário e da caixa', () => {
    expect(getUnitPrice(product)).toBe(5.75);
    expect(getBoxPrice(product)).toBe(575);
  });

  it('calcula total da linha por quantidade de caixas', () => {
    expect(getCartLineTotal({ product, quantity: 2 })).toBe(1150);
    expect(getCartLineTotal({ product, quantity: 1 })).toBe(575);
  });
});
