import React, { useState } from 'react';
import { Package, Minus, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { CartItem } from '@/types';
import { toast } from 'sonner';

interface ClientOrderViewProps {
  linkId: string;
}

export const ClientOrderView: React.FC<ClientOrderViewProps> = ({ linkId }) => {
  // Mock data - em produção viria do backend
  const [items, setItems] = useState<CartItem[]>([
    {
      productId: '1',
      product: {
        id: '1',
        importadoraId: '1',
        importadoraName: 'Casa & Estilo',
        code: 'CE-001',
        name: 'Abridor de Garrafa Automático',
        description: 'Abridor elétrico com design moderno',
        price: 45.90,
        minOrder: 6,
        category: 'Cozinha',
        subcategory: 'Utensílios',
        active: true,
        createdAt: new Date(),
      },
      quantity: 12,
    },
  ]);
  const [observations, setObservations] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  const updateQuantity = (productId: string, newQuantity: number) => {
    setItems(items.map(item =>
      item.productId === productId
        ? { ...item, quantity: Math.max(1, newQuantity) }
        : item
    ));
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
  };

  const getTotal = () => {
    return items.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  const handleSubmitOrder = () => {
    if (!clientName || !clientPhone) {
      toast.error('Preencha seu nome e telefone');
      return;
    }
    
    if (items.length === 0) {
      toast.error('O pedido está vazio');
      return;
    }

    toast.success('Pedido enviado com sucesso!');
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-lg">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl">Importa Flow</h1>
              <p className="text-sm text-primary-foreground/80">Revise e confirme seu pedido</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle>Suas Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Nome / Razão Social *</label>
              <Input
                placeholder="Seu nome ou nome da loja"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Telefone / WhatsApp *</label>
              <Input
                placeholder="(00) 00000-0000"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos Selecionados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map(item => (
              <div key={item.productId} className="p-4 bg-muted rounded-lg">
                <div className="flex gap-3">
                  <div className="w-20 h-20 bg-white rounded-lg flex-shrink-0 flex items-center justify-center">
                    <Package className="w-8 h-8 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm line-clamp-2 mb-1">{item.product.name}</h4>
                        <div className="flex gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {item.product.code}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {item.product.importadoraName}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        onClick={() => removeItem(item.productId)}
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-8 w-8 p-0 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-sm font-medium w-12 text-center">{item.quantity}</span>
                        <Button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          R$ {item.product.price.toFixed(2)} x {item.quantity}
                        </p>
                        <p className="font-medium" style={{ color: '#1B5B6B' }}>
                          R$ {(item.product.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum produto no pedido</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Observations */}
        <Card>
          <CardHeader>
            <CardTitle>Observações (opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Adicione observações sobre o pedido..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Total and Submit */}
        <Card className="bg-muted/50 sticky bottom-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-medium">Total do Pedido</span>
              <span className="text-2xl font-medium" style={{ color: '#1B5B6B' }}>
                R$ {getTotal().toFixed(2)}
              </span>
            </div>
            <Button
              onClick={handleSubmitOrder}
              disabled={items.length === 0}
              className="w-full py-6 text-lg bg-secondary hover:bg-secondary/90"
            >
              <Send className="w-5 h-5 mr-2" />
              Enviar Pedido
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
