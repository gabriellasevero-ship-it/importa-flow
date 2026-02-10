import React, { useState } from 'react';
import { Search, Package, ShoppingCart, Plus, Minus, X, User, LogIn, UserPlus, LogOut, History, Trash2, ShoppingBag, AlertCircle, Check, ArrowLeft, Building, DollarSign, FileText, Camera } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Textarea } from '@/app/components/ui/textarea';
import { MultiSelect } from '@/app/components/ui/multi-select';
import { useProducts, useImportadoras, useCategories, useTransportadoras } from '@/hooks/useData';
import { Product, CartItem, Order } from '@/types';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { useOrders } from '@/contexts/OrdersContext';
import { ImageSearchDialog } from '@/app/components/ImageSearchDialog';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';

interface RepresentanteInfo {
  id: string;
  name: string;
  avatar?: string;
}

const MOCK_REPRESENTANTES: Record<string, RepresentanteInfo> = {
  'rep-1': {
    id: 'rep-1',
    name: 'Maria Silva',
    avatar: undefined, // em produção viria a URL da foto
  },
};

interface ClientCatalogViewProps {
  linkId: string;
  representanteId: string;
}

export const ClientCatalogView: React.FC<ClientCatalogViewProps> = ({ linkId, representanteId }) => {
  const representante = MOCK_REPRESENTANTES[representanteId] ?? { id: representanteId, name: 'Representante' };
  const { client, isAuthenticated, logout, login, register } = useClientAuth();
  const { orders, addOrder } = useOrders();
  const { products: productsList } = useProducts();
  const { importadoras: importadorasList } = useImportadoras();
  const { categories: categoriesList } = useCategories();
  const { transportadoras: transportadorasList } = useTransportadoras();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImportadoras, setSelectedImportadoras] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [observations, setObservations] = useState('');
  const [selectedTransportadoraId, setSelectedTransportadoraId] = useState<string>('');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [showImageSearchDialog, setShowImageSearchDialog] = useState(false);

  // Dados de cadastro
  const [registerData, setRegisterData] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    cnpj: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  // Dados de login
  const [loginData, setLoginData] = useState({
    email: '',
    phone: '',
  });

  const availableSubcategories = selectedCategory === 'all' 
    ? [] 
    : categoriesList.find(cat => cat.name === selectedCategory)?.subcategories || [];

  const filteredProducts = productsList.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesImportadora = selectedImportadoras.length === 0 || selectedImportadoras.includes(product.importadoraId);
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSubcategory = selectedSubcategory === 'all' || product.subcategory === selectedSubcategory;
    
    return matchesSearch && matchesImportadora && matchesCategory && matchesSubcategory && product.active;
  });

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        product,
        quantity: 1,
      }]);
    }
    
    toast.success(`${product.name} adicionado ao carrinho`);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
    toast.success('Produto removido do carrinho');
  };

  const getTotal = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  };

  // Constante para pedido mínimo
  const MINIMUM_ORDER_VALUE = 3000;

  // Agrupar itens do carrinho por importadora
  const groupedByImportadora = cart.reduce((acc, item) => {
    const importadoraId = item.product.importadoraId;
    if (!acc[importadoraId]) {
      acc[importadoraId] = {
        importadoraName: item.product.importadoraName,
        items: [],
        total: 0
      };
    }
    acc[importadoraId].items.push(item);
    acc[importadoraId].total += item.product.price * item.quantity;
    return acc;
  }, {} as Record<string, { importadoraName: string; items: CartItem[]; total: number }>);

  const handleSubmitOrder = async () => {
    if (!isAuthenticated) {
      toast.error('Você precisa estar logado para fazer um pedido');
      setShowLoginDialog(true);
      return;
    }

    if (cart.length === 0) {
      toast.error('Adicione produtos ao carrinho');
      return;
    }

    // Agrupar por importadora
    const groupedByImportadora = cart.reduce((acc, item) => {
      const importadoraId = item.product.importadoraId;
      if (!acc[importadoraId]) {
        acc[importadoraId] = [];
      }
      acc[importadoraId].push(item);
      return acc;
    }, {} as Record<string, CartItem[]>);

    // Criar e salvar pedido para cada importadora
    const newOrders: Order[] = Object.entries(groupedByImportadora).map(([importadoraId, items]) => {
      const importadora = importadorasList.find(imp => imp.id === importadoraId);
      const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

      return {
        id: `PED${Date.now()}-${Math.random().toString(36).substring(7)}`,
        representanteId,
        representanteName: 'Maria Silva',
        clienteId: client!.id,
        clienteName: client!.name,
        importadoraId,
        importadoraName: importadora?.name || 'Desconhecida',
        items,
        status: 'aberto',
        total,
        observations,
        transportadoraId: selectedTransportadoraId && selectedTransportadoraId !== 'none' ? selectedTransportadoraId : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        linkId,
        origin: 'cliente',
        isRead: false,
        notes: observations,
      };
    });

    newOrders.forEach(order => addOrder(order));
    
    toast.success('Pedido enviado com sucesso! O representante será notificado.');
    setCart([]);
    setObservations('');
    setShowOrderDialog(false);
    setShowCart(false);
  };

  // Filtrar pedidos do cliente (área logada do cliente, com status)
  const clientOrders = orders.filter(order => 
    order.clienteId === client?.id && order.origin === 'cliente'
  );

  const getOrderStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      rascunho: { label: 'Rascunho', className: 'bg-gray-500' },
      aberto: { label: 'Em Aberto', className: 'bg-blue-500' },
      faturado: { label: 'Faturado', className: 'bg-green-500' },
      cancelado: { label: 'Cancelado', className: 'bg-red-500' },
    };
    const config = statusConfig[status] || statusConfig.rascunho;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const formatOrderDate = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-white/10 rounded-lg">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Importa Flow</h1>
                <p className="text-xs text-primary-foreground/80">Catálogo de Produtos</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOrderHistory(true)}
                    className="text-primary-foreground hover:bg-white/10"
                  >
                    <History className="w-4 h-4 mr-2" />
                    Meus Pedidos ({clientOrders.length})
                  </Button>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
                    <User className="w-4 h-4" />
                    <span className="text-sm">{client?.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-primary-foreground hover:bg-white/10"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLoginDialog(true)}
                    className="text-primary-foreground hover:bg-white/10"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Entrar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowRegisterDialog(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Cadastrar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Title and Cart Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="mb-2">Catálogo de Produtos</h2>
            <p className="text-muted-foreground">
              Busque e adicione produtos ao carrinho
            </p>
          </div>
          
          {/* Cart Button */}
          <Button
            onClick={() => setShowCart(true)}
            className="relative bg-primary hover:bg-primary/90"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Carrinho
            {cart.length > 0 && (
              <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-secondary">
                {cart.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-12"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
              title="Buscar por imagem"
              onClick={() => setShowImageSearchDialog(true)}
            >
              <Camera className="w-5 h-5 text-primary" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Multi-select Importadoras */}
            <MultiSelect
              options={importadorasList.map(imp => ({ value: imp.id, label: imp.name }))}
              selected={selectedImportadoras}
              onChange={setSelectedImportadoras}
              placeholder="Todas as importadoras"
            />

            <Select 
              value={selectedCategory} 
              onValueChange={(value) => {
                setSelectedCategory(value);
                setSelectedSubcategory('all');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categoriesList.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={selectedSubcategory} 
              onValueChange={setSelectedSubcategory}
              disabled={selectedCategory === 'all'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as subcategorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as subcategorias</SelectItem>
                {availableSubcategories.map(subcat => (
                  <SelectItem key={subcat} value={subcat}>{subcat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Info & Results Count */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                Buscando em: 
              </span>
              {selectedImportadoras.length === 0 ? (
                <Badge variant="secondary" className="font-normal">
                  Todas as importadoras ({importadorasList.length})
                </Badge>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {selectedImportadoras.map(id => {
                    const imp = importadorasList.find(i => i.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="font-normal">
                        {imp?.name}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
            <span className="text-muted-foreground">
              {filteredProducts.length} produtos encontrados
            </span>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredProducts.map(product => {
            const cartItem = cart.find(item => item.productId === product.id);
            
            return (
              <Card key={product.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="aspect-square bg-gray-50 rounded-t-lg flex items-center justify-center border-b">
                    <Package className="w-16 h-16 text-muted-foreground" />
                  </div>
                  
                  <div className="p-4 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{product.code}</p>
                    
                    <div className="inline-block">
                      <div className="relative bg-gradient-to-r from-orange-500 to-orange-400 text-white px-3 py-1 font-bold text-lg">
                        R$ {product.price.toFixed(2)}
                        <div className="absolute right-0 top-0 w-0 h-0 border-t-[16px] border-t-transparent border-b-[16px] border-b-transparent border-l-[12px] border-l-orange-400 translate-x-full"></div>
                      </div>
                    </div>

                    <h4 className="text-base font-medium line-clamp-2 min-h-[3rem]">
                      {product.name}
                    </h4>

                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><span className="font-medium">Qtd/Caixa:</span> {product.minOrder} un</p>
                      {product.material && (
                        <p><span className="font-medium">Material:</span> {product.material}</p>
                      )}
                    </div>

                    <Badge variant="outline" className="text-xs font-semibold border-primary/50 text-primary">
                      {product.importadoraName}
                    </Badge>

                    {cartItem ? (
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="flex-1 text-center font-medium">{cartItem.quantity}</span>
                        <Button
                          onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => addToCart(product)}
                        className="w-full mt-3 bg-secondary hover:bg-secondary/90"
                        size="sm"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Adicionar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Nenhum produto encontrado
            </p>
          </div>
        )}
      </main>

      {/* Cart Sidebar */}
      <Sheet open={showCart} onOpenChange={setShowCart}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Carrinho</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {cart.length} {cart.length === 1 ? 'produto' : 'produtos'}
            </p>
          </SheetHeader>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="mb-2">Carrinho vazio</h3>
              <p className="text-muted-foreground text-center mb-6">
                Adicione produtos do catálogo para começar
              </p>
            </div>
          ) : (
            <div className="space-y-4 mt-6">
              {/* Clear Cart Button */}
              <Button
                onClick={() => {
                  setCart([]);
                  toast.success('Carrinho limpo');
                }}
                variant="outline"
                size="sm"
                className="text-destructive w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Carrinho
              </Button>

              {/* Cart Items - Grouped by Importadora */}
              <div className="space-y-4">
                {Object.entries(groupedByImportadora).map(([importadoraId, group]) => {
                    const progress = (group.total / MINIMUM_ORDER_VALUE) * 100;
                    const isMinimumReached = group.total >= MINIMUM_ORDER_VALUE;
                    
                    return (
                      <Card key={importadoraId} className={isMinimumReached ? 'border-secondary' : 'border-orange-300'}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <CardTitle className="text-base">{group.importadoraName}</CardTitle>
                                {isMinimumReached ? (
                                  <Badge className="bg-secondary text-white text-xs">
                                    <Check className="w-3 h-3 mr-1" />
                                    Mínimo atingido
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-orange-400 text-orange-600 text-[10px] px-1.5 py-0">
                                    <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                                    Abaixo do mínimo
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                R$ {group.total.toFixed(2)} de R$ {MINIMUM_ORDER_VALUE.toFixed(2)}
                              </p>
                              
                              {/* Progress Bar */}
                              <div className="w-full bg-muted rounded-full h-2 mt-2">
                                <div 
                                  className={`h-2 rounded-full transition-all ${isMinimumReached ? 'bg-secondary' : 'bg-orange-400'}`}
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-3 pt-0">
                          {group.items.map(item => (
                            <div key={item.productId} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                              <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center">
                                <Package className="w-8 h-8 text-muted-foreground" />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium line-clamp-1 mb-0.5">{item.product.name}</h4>
                                    <p className="text-xs text-muted-foreground">{item.product.code}</p>
                                  </div>
                                  <Button
                                    onClick={() => removeFromCart(item.productId)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive h-7 w-7 p-0 flex-shrink-0"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>

                                <div className="flex flex-col gap-2 items-start">
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 1;
                                        updateQuantity(item.productId, Math.max(1, value));
                                      }}
                                      className="h-7 w-14 text-sm font-medium text-center p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Button
                                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                    <span className="text-xs text-muted-foreground ml-0.5">cx</span>
                                  </div>
                                  <p className="text-sm font-bold text-center text-primary w-full">
                                    R$ {(item.product.price * item.quantity).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })}
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
                  {/* Subtotals by Importadora */}
                  {Object.entries(groupedByImportadora).length > 0 && (
                    <div className="space-y-2 mb-4 pb-4 border-b">
                      <p className="text-sm text-muted-foreground mb-2">Subtotais por Importadora</p>
                      {Object.entries(groupedByImportadora).map(([importadoraId, group]) => (
                        <div key={importadoraId} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{group.importadoraName}</span>
                          <span className="font-medium text-primary">
                            R$ {group.total.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-medium">Total</span>
                    <span className="text-2xl font-medium text-primary">
                      R$ {getTotal().toFixed(2)}
                    </span>
                  </div>

                  <Button
                    onClick={() => {
                      if (!isAuthenticated) {
                        setShowCart(false);
                        setShowLoginDialog(true);
                      } else {
                        setShowOrderDialog(true);
                      }
                    }}
                    className="w-full bg-secondary hover:bg-secondary/90"
                    disabled={cart.length === 0}
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Finalizar Pedido
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Order Confirmation Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pedido</DialogTitle>
            <DialogDescription>
              Revise seu pedido antes de enviar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Representante que receberá o pedido */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <Avatar className="h-12 w-12">
                {representante.avatar ? (
                  <AvatarImage src={representante.avatar} alt={representante.name} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                  {representante.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Seu pedido será enviado para</p>
                <p className="font-semibold text-foreground">{representante.name}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Cliente: {client?.name}</p>
              <p className="text-sm text-muted-foreground">{cart.length} produtos</p>
              <p className="text-lg font-bold text-primary">
                Total: R$ {getTotal().toFixed(2)}
              </p>
            </div>

            {/* Transportadora */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Transportadora</label>
              <Select value={selectedTransportadoraId || 'none'} onValueChange={v => setSelectedTransportadoraId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a transportadora">
                    {selectedTransportadoraId ? (
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        {transportadorasList.find(t => t.id === selectedTransportadoraId)?.name}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Selecione a transportadora</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Nenhuma selecionada</span>
                  </SelectItem>
                  {transportadorasList.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        <span>{t.name}</span>
                        <span className="text-xs text-muted-foreground">({t.city} - {t.state})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowOrderDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitOrder}
                className="flex-1 bg-secondary hover:bg-secondary/90"
              >
                Confirmar e Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Login Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entrar</DialogTitle>
            <DialogDescription>
              Use seu e-mail ou telefone para entrar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">E-mail ou Telefone</label>
              <Input
                placeholder="seu@email.com ou (00) 00000-0000"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Telefone</label>
              <Input
                placeholder="(00) 00000-0000"
                value={loginData.phone}
                onChange={(e) => setLoginData({ ...loginData, phone: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowLoginDialog(false);
                  setShowRegisterDialog(true);
                }}
                className="flex-1"
              >
                Criar Conta
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await login(loginData.email, loginData.phone);
                    setShowLoginDialog(false);
                    setLoginData({ email: '', phone: '' });
                    toast.success('Login realizado com sucesso!');
                  } catch (error: any) {
                    toast.error(error.message || 'Erro ao fazer login');
                  }
                }}
                className="flex-1 bg-primary"
              >
                Entrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Register Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar-se</DialogTitle>
            <DialogDescription>
              Preencha seus dados para fazer pedidos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Nome / Razão Social *</label>
              <Input
                placeholder="Seu nome ou nome da loja"
                value={registerData.name}
                onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Nome Fantasia</label>
              <Input
                placeholder="Nome fantasia (opcional)"
                value={registerData.businessName}
                onChange={(e) => setRegisterData({ ...registerData, businessName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm">E-mail *</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Telefone *</label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={registerData.phone}
                  onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm">CNPJ</label>
              <Input
                placeholder="00.000.000/0000-00"
                value={registerData.cnpj}
                onChange={(e) => setRegisterData({ ...registerData, cnpj: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm">CEP</label>
              <Input
                placeholder="00000-000"
                value={registerData.cep}
                onChange={(e) => setRegisterData({ ...registerData, cep: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <label className="text-sm">Rua</label>
                <Input
                  placeholder="Nome da rua"
                  value={registerData.street}
                  onChange={(e) => setRegisterData({ ...registerData, street: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Número</label>
                <Input
                  placeholder="123"
                  value={registerData.number}
                  onChange={(e) => setRegisterData({ ...registerData, number: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm">Complemento</label>
              <Input
                placeholder="Apto, sala, etc."
                value={registerData.complement}
                onChange={(e) => setRegisterData({ ...registerData, complement: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm">Bairro</label>
                <Input
                  placeholder="Nome do bairro"
                  value={registerData.neighborhood}
                  onChange={(e) => setRegisterData({ ...registerData, neighborhood: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Cidade</label>
                <Input
                  placeholder="Nome da cidade"
                  value={registerData.city}
                  onChange={(e) => setRegisterData({ ...registerData, city: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm">Estado</label>
              <Input
                placeholder="SP"
                value={registerData.state}
                onChange={(e) => setRegisterData({ ...registerData, state: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRegisterDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await register(registerData, representanteId);
                    setShowRegisterDialog(false);
                    setRegisterData({
                      name: '',
                      businessName: '',
                      email: '',
                      phone: '',
                      cnpj: '',
                      cep: '',
                      street: '',
                      number: '',
                      complement: '',
                      neighborhood: '',
                      city: '',
                      state: '',
                    });
                    toast.success('Cadastro realizado com sucesso!');
                  } catch (error: any) {
                    toast.error(error.message || 'Erro ao cadastrar');
                  }
                }}
                className="flex-1 bg-primary"
                disabled={!registerData.name || !registerData.email || !registerData.phone}
              >
                Cadastrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order History Dialog - Lista ou Interna do Pedido */}
      <Dialog open={showOrderHistory} onOpenChange={(open) => { if (!open) setSelectedOrderDetail(null); setShowOrderHistory(open); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedOrderDetail ? (
            /* Interna do pedido (igual à da representante) */
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedOrderDetail(null)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <DialogTitle>Pedido #{selectedOrderDetail.id}</DialogTitle>
                  {getOrderStatusBadge(selectedOrderDetail.status)}
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <DollarSign className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Valor Total</p>
                          <p className="text-xl font-bold text-primary">
                            R$ {selectedOrderDetail.total.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-secondary/10">
                          <Package className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total de Itens</p>
                          <p className="text-xl font-bold">
                            {selectedOrderDetail.items.reduce((sum, item) => sum + item.quantity, 0)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Informações do Pedido</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Importadora</p>
                        <p className="text-sm font-medium">{selectedOrderDetail.importadoraName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Data de Criação</p>
                        <p className="text-sm">{formatOrderDate(selectedOrderDetail.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Forma de pagamento</p>
                        <p className="text-sm font-medium">{selectedOrderDetail.paymentTerm || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                        <p className="text-sm font-medium">{getOrderStatusBadge(selectedOrderDetail.status)}</p>
                      </div>
                      {selectedOrderDetail.transportadoraId && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Transportadora</p>
                          <p className="text-sm font-medium">
                            {transportadorasList.find(t => t.id === selectedOrderDetail.transportadoraId)?.name ?? '-'}
                          </p>
                        </div>
                      )}
                      {selectedOrderDetail.status === 'faturado' && selectedOrderDetail.notaFiscal && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Nota Fiscal</p>
                          <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <FileText className="w-4 h-4 text-green-500" />
                            <p className="text-sm font-medium text-green-600">{selectedOrderDetail.notaFiscal}</p>
                          </div>
                        </div>
                      )}
                      {(selectedOrderDetail.notes || selectedOrderDetail.observations) && (
                        <div className="md:col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">Observações</p>
                          <p className="text-sm">{selectedOrderDetail.notes || selectedOrderDetail.observations}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Produtos do Pedido</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b-2 border-primary/20">
                        <Building className="w-5 h-5 text-primary" />
                        <h4 className="text-lg font-semibold text-primary">{selectedOrderDetail.importadoraName}</h4>
                      </div>
                      <div className="space-y-2">
                        {selectedOrderDetail.items.map((item, index) => (
                          <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                              <Package className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium mb-1">{item.product.name}</p>
                              <p className="text-xs text-muted-foreground">Código: {item.product.code}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">
                                {item.quantity}x R$ {item.product.price.toFixed(2)}
                              </p>
                              <p className="font-bold text-primary">
                                R$ {(item.quantity * item.product.price).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t-2 border-primary/30">
                        <div className="flex items-center justify-between text-lg font-bold">
                          <span>Total do Pedido</span>
                          <span className="text-primary">R$ {selectedOrderDetail.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setCart(selectedOrderDetail.items.map(item => ({ ...item })));
                    setShowOrderHistory(false);
                    setSelectedOrderDetail(null);
                    setShowCart(true);
                    toast.success('Produtos adicionados ao carrinho!');
                  }}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Reutilizar este pedido
                </Button>
              </div>
            </>
          ) : (
            /* Lista de pedidos */
            <>
              <DialogHeader>
                <DialogTitle>Meus Pedidos</DialogTitle>
                <DialogDescription>
                  Histórico dos seus pedidos anteriores
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {clientOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum pedido encontrado</p>
                  </div>
                ) : (
                  clientOrders
                    .sort((a, b) => {
                      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
                      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
                      return dateB.getTime() - dateA.getTime();
                    })
                    .map(order => (
                      <Card
                        key={order.id}
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedOrderDetail(order)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold">Pedido #{order.id}</h4>
                              <p className="text-sm text-muted-foreground">
                                {formatOrderDate(order.createdAt)}
                              </p>
                            </div>
                            {getOrderStatusBadge(order.status)}
                          </div>
                          <div className="space-y-1 text-sm">
                            <p><span className="font-medium">Importadora:</span> {order.importadoraName}</p>
                            <p><span className="font-medium">Produtos:</span> {order.items.length}</p>
                            <p className="text-lg font-bold text-primary">
                              Total: R$ {order.total.toFixed(2)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ImageSearchDialog
        open={showImageSearchDialog}
        onOpenChange={setShowImageSearchDialog}
        onSearch={(text) => setSearchTerm(text)}
      />
    </div>
  );
};
