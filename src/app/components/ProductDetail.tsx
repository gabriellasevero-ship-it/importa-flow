import React, { useState } from 'react';
import { ArrowLeft, Plus, Minus, ShoppingCart } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Product } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

interface ProductDetailProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({ product, onClose }) => {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [observations, setObservations] = useState('');

  if (!product) return null;

  const handleAddToCart = () => {
    addItem(product, quantity, observations);
    toast.success('Produto adicionado ao carrinho!');
    onClose();
  };

  return (
    <Dialog open={!!product} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[1400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            Código: {product.code}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Image */}
          <div className="w-full h-[500px] bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Package className="w-40 h-40 mx-auto mb-2" />
              <p className="text-sm">Imagem não disponível</p>
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-4">
            <div>
              <h2 className="mb-2">{product.name}</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Código: {product.code}
              </p>
              <div className="flex gap-2">
                <Badge variant="outline">{product.importadoraName}</Badge>
                <Badge variant="secondary">{product.category}</Badge>
                {product.subcategory && (
                  <Badge variant="outline">{product.subcategory}</Badge>
                )}
              </div>
            </div>

            {product.description && (
              <Card>
                <CardContent className="p-4">
                  <h4 className="mb-2">Descrição</h4>
                  <p className="text-sm text-muted-foreground">{product.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Additional Details */}
            {(product.detalhe1 || product.detalhe2 || product.detalhe3 || product.material || product.dimensions) && (
              <Card>
                <CardContent className="p-4">
                  <h4 className="mb-3">Detalhes do Produto</h4>
                  <div className="space-y-2 text-sm">
                    {product.material && (
                      <div className="flex">
                        <span className="font-medium text-muted-foreground w-24">Material:</span>
                        <span>{product.material}</span>
                      </div>
                    )}
                    {product.dimensions && (
                      <div className="flex">
                        <span className="font-medium text-muted-foreground w-24">Dimensões:</span>
                        <span>{product.dimensions}</span>
                      </div>
                    )}
                    {product.detalhe1 && (
                      <div className="flex">
                        <span className="font-medium text-muted-foreground mr-2">•</span>
                        <span>{product.detalhe1}</span>
                      </div>
                    )}
                    {product.detalhe2 && (
                      <div className="flex">
                        <span className="font-medium text-muted-foreground mr-2">•</span>
                        <span>{product.detalhe2}</span>
                      </div>
                    )}
                    {product.detalhe3 && (
                      <div className="flex">
                        <span className="font-medium text-muted-foreground mr-2">•</span>
                        <span>{product.detalhe3}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pricing */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Preço por Caixa</p>
                    <p className="text-2xl font-medium" style={{ color: '#1B5B6B' }}>
                      R$ {product.price.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Unidades/Caixa</p>
                    <p className="text-2xl font-medium">{product.minOrder} un</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quantity Selector */}
            <Card>
              <CardContent className="p-4">
                <label className="text-sm mb-3 block">Quantidade de Caixas</label>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    variant="outline"
                    size="lg"
                  >
                    <Minus className="w-5 h-5" />
                  </Button>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-center text-xl font-medium w-24"
                  />
                  <Button
                    onClick={() => setQuantity(quantity + 1)}
                    variant="outline"
                    size="lg"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                  <div className="ml-auto text-right">
                    <p className="text-sm text-muted-foreground">Subtotal</p>
                    <p className="text-xl font-medium" style={{ color: '#1B5B6B' }}>
                      R$ {(product.price * quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Observations */}
            <div className="space-y-2">
              <label className="text-sm">Observações (opcional)</label>
              <Textarea
                placeholder="Adicione observaões sobre este item..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
              />
            </div>

            {/* Add to Cart Button */}
            <Button
              onClick={handleAddToCart}
              className="w-full py-6 text-lg bg-secondary hover:bg-secondary/90"
              size="lg"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Adicionar ao Carrinho
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { Package } from 'lucide-react';