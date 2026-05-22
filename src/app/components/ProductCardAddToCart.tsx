import React, { useState } from 'react';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Product } from '@/types';

interface ProductCardAddToCartProps {
  product: Product;
  onAdd: (product: Product, quantity: number) => void;
}

export const ProductCardAddToCart: React.FC<ProductCardAddToCartProps> = ({ product, onAdd }) => {
  const [quantity, setQuantity] = useState(1);

  const updateQuantity = (value: number) => {
    setQuantity(Math.max(1, value));
  };

  return (
    <div
      className="flex items-start gap-3 sm:gap-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-7 p-0 sm:h-9 sm:w-8"
            onClick={() => updateQuantity(quantity - 1)}
          >
            <Minus className="w-3 h-3" />
          </Button>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => updateQuantity(parseInt(e.target.value, 10) || 1)}
            className="h-8 w-10 text-sm font-medium text-center p-0 sm:h-9 sm:w-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-7 p-0 sm:h-9 sm:w-8"
            onClick={() => updateQuantity(quantity + 1)}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        <span className="text-[10px] leading-none text-muted-foreground sm:text-xs">caixa</span>
      </div>
      <Button
        onClick={() => onAdd(product, quantity)}
        className="h-8 min-w-0 flex-1 bg-secondary hover:bg-secondary/90 sm:h-9"
        size="sm"
      >
        <ShoppingCart className="h-3.5 w-3.5 shrink-0 sm:mr-1.5 sm:h-4 sm:w-4" />
        <span className="truncate text-xs sm:text-sm">Adicionar</span>
      </Button>
    </div>
  );
};
