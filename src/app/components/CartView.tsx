import React, { useState } from 'react';
import { X, Plus, Minus, Trash2, Link as LinkIcon, ShoppingBag } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useCart } from '@/contexts/CartContext';
import { useClientes } from '@/hooks/useData';
import { toast } from 'sonner';

interface CartViewProps {
  onNavigate: (tab: string) => void;
}

export const CartView: React.FC<CartViewProps> = ({ onNavigate }) => {
  const { items, updateItem, removeItem, clearCart, getTotal } = useCart();
  const { clientes } = useClientes();
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [observations, setObservations] = useState('');

  const handleGenerateLink = () => {
    if (!selectedCliente) {
      toast.error('Selecione um cliente primeiro');
      return;
    }
    
    const linkId = Math.random().toString(36).substring(7);
    const link = `${window.location.origin}/pedido/${linkId}`;
    
    // Copiar para clipboard com fallback
    const copyToClipboard = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Link copiado para área de transferência!');
      } catch (err) {
        // Fallback usando textarea temporária
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          toast.success('Link copiado para área de transferência!');
        } catch (error) {
          toast.error('Não foi possível copiar o link');
        }
        document.body.removeChild(textArea);
      }
    };
    
    copyToClipboard(link);
    setShowLinkDialog(false);
    setSelectedCliente('');
  };

  const handleCreateOrder = () => {
    if (items.length === 0) {
      toast.error('Adicione produtos ao carrinho');
      return;
    }
    
    toast.success('Pedido criado com sucesso!');
    clearCart();
    onNavigate('orders');
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="mb-2">Carrinho vazio</h3>
        <p className="text-muted-foreground text-center mb-6">
          Adicione produtos do catálogo para começar
        </p>
        <Button onClick={() => onNavigate('catalog')} className="bg-primary hover:bg-primary/90">
          Ver Catálogo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-1">Carrinho</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'produto' : 'produtos'}
          </p>
        </div>
        <Button
          onClick={clearCart}
          variant="outline"
          size="sm"
          className="text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Limpar
        </Button>
      </div>

      {/* Cart Items */}
      <div className="space-y-3">
        {items.map(item => (
          <Card key={item.productId}>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="w-20 h-20 bg-muted rounded-lg flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm line-clamp-1 mb-1">{item.product.name}</h4>
                      <p className="text-xs text-muted-foreground">{item.product.code}</p>
                    </div>
                    <Button
                      onClick={() => removeItem(item.productId)}
                      variant="ghost"
                      size="sm"
                      className="text-destructive h-8 w-8 p-0 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => updateItem(item.productId, Math.max(1, item.quantity - 1))}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                      <Button
                        onClick={() => updateItem(item.productId, item.quantity + 1)}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="font-medium" style={{ color: '#1B5B6B' }}>
                      R$ {(item.product.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Observations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observações do Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Adicione observações gerais sobre o pedido..."
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Total and Actions */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-medium">Total</span>
            <span className="text-2xl font-medium" style={{ color: '#1B5B6B' }}>
              R$ {getTotal().toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Button
              onClick={handleCreateOrder}
              className="w-full bg-secondary hover:bg-secondary/90"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Criar Pedido Direto
            </Button>
            <Button
              onClick={() => setShowLinkDialog(true)}
              variant="outline"
              className="w-full"
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Gerar Link para Cliente
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generate Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Link de Venda</DialogTitle>
            <DialogDescription>
              Selecione o cliente e gere um link personalizado
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Cliente</label>
              <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map(cliente => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleGenerateLink}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Gerar e Copiar Link
              </Button>
              <Button
                onClick={() => setShowLinkDialog(false)}
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};