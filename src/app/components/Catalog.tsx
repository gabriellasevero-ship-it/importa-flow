import React, { useState } from 'react';
import { Search, Filter, Camera, Package, ShoppingCart, X, Plus, Minus, Trash2, Link as LinkIcon, ShoppingBag, GitCompare, Check, AlertCircle } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Textarea } from '@/app/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { Checkbox } from '@/app/components/ui/checkbox';
import { MultiSelect } from '@/app/components/ui/multi-select';
import { Product } from '@/types';
import { useImportadoras, useCategories, useProducts, useClientes } from '@/hooks/useData';
import { useCart } from '@/contexts/CartContext';
import { ImageSearchDialog } from '@/app/components/ImageSearchDialog';
import { toast } from 'sonner';

interface CatalogProps {
  onProductSelect: (product: Product) => void;
  showCart?: boolean;
}

export const Catalog: React.FC<CatalogProps> = ({
  onProductSelect,
  showCart = false
}) => {
  const { items, addItem, updateItem, removeItem, clearCart, getTotal } = useCart();
  const { products } = useProducts();
  const { importadoras } = useImportadoras();
  const { categories } = useCategories();
  const { clientes } = useClientes();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImportadoras, setSelectedImportadoras] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showCreateOrderDialog, setShowCreateOrderDialog] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [selectedClienteForOrder, setSelectedClienteForOrder] = useState<string>('');
  const [observations, setObservations] = useState('');
  const [zoomedImage, setZoomedImage] = useState<{ productName: string; code: string } | null>(null);
  const [compareProducts, setCompareProducts] = useState<string[]>([]);
  const [showComparator, setShowComparator] = useState(false);
  const [showImageSearchDialog, setShowImageSearchDialog] = useState(false);

  // Constante para pedido mínimo
  const MINIMUM_ORDER_VALUE = 3000;

  // Agrupar itens do carrinho por importadora
  const groupedByImportadora = items.reduce((acc, item) => {
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
  }, {} as Record<string, { importadoraName: string; items: typeof items; total: number }>);

  // Get available subcategories based on selected category
  const availableSubcategories = selectedCategory === 'all' 
    ? [] 
    : categories.find(cat => cat.name === selectedCategory)?.subcategories || [];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesImportadora = selectedImportadoras.length === 0 || selectedImportadoras.includes(product.importadoraId);
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSubcategory = selectedSubcategory === 'all' || product.subcategory === selectedSubcategory;
    
    return matchesSearch && matchesImportadora && matchesCategory && matchesSubcategory && product.active;
  });

  const handleGenerateLink = () => {
    // Gerar link do catálogo (não precisa de cliente específico)
    const linkId = Math.random().toString(36).substring(7);
    const link = `${window.location.origin}/catalogo/${linkId}`;
    
    // Fallback para clipboard API
    const copyToClipboard = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Link do catálogo copiado para área de transferência!');
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
          toast.success('Link do catálogo copiado para área de transferência!');
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
    
    // Open dialog to select client
    setShowCreateOrderDialog(true);
  };

  const handleConfirmCreateOrder = () => {
    if (!selectedClienteForOrder) {
      toast.error('Selecione um cliente primeiro');
      return;
    }
    
    const cliente = clientes.find(c => c.id === selectedClienteForOrder);
    toast.success(`Pedido criado com sucesso para ${cliente?.name}!`);
    clearCart();
    setCartOpen(false);
    setShowCreateOrderDialog(false);
    setSelectedClienteForOrder('');
  };

  const handleCompareProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Se já está selecionado, remove
    if (compareProducts.includes(productId)) {
      setCompareProducts(compareProducts.filter(id => id !== productId));
      return;
    }

    // Se é o primeiro produto, adiciona
    if (compareProducts.length === 0) {
      setCompareProducts([productId]);
      return;
    }

    // Verifica se o produto tem a mesma categoria e subcategoria dos produtos já selecionados
    const firstProduct = products.find(p => p.id === compareProducts[0]);
    if (firstProduct?.category !== product.category || firstProduct?.subcategory !== product.subcategory) {
      toast.error(`Só é possível comparar produtos da mesma categoria e subcategoria: ${firstProduct?.category} > ${firstProduct?.subcategory}`);
      return;
    }

    setCompareProducts([...compareProducts, productId]);
  };

  // Verifica se um produto pode ser comparado com os produtos já selecionados
  const canCompare = (productId: string): boolean => {
    if (compareProducts.length === 0) return true;
    if (compareProducts.includes(productId)) return true;
    
    const product = products.find(p => p.id === productId);
    const firstProduct = products.find(p => p.id === compareProducts[0]);
    
    return product?.category === firstProduct?.category && 
           product?.subcategory === firstProduct?.subcategory;
  };

  // Verifica se há filtros ou busca ativos para mostrar comparação
  const hasActiveFilters = 
    searchTerm !== '' || 
    selectedCategory !== 'all' || 
    selectedSubcategory !== 'all' || 
    selectedImportadoras.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-2">Catálogo de Produtos</h2>
          <p className="text-muted-foreground">
            Busque e adicione produtos ao carrinho
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Generate Catalog Link Button */}
          <Button
            onClick={() => setShowLinkDialog(true)}
            variant="outline"
            className="border-secondary text-secondary hover:bg-secondary/10"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Compartilhar Catálogo
          </Button>
          
          {/* Cart Button */}
          <Button
            onClick={() => setCartOpen(true)}
            className="relative bg-primary hover:bg-primary/90"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Carrinho
            {items.length > 0 && (
              <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-secondary">
                {items.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Search Bar */}
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

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Multi-select Importadoras */}
        <MultiSelect
          options={importadoras.map(imp => ({ value: imp.id, label: imp.name }))}
          selected={selectedImportadoras}
          onChange={setSelectedImportadoras}
          placeholder="Todas as importadoras"
        />

        <Select 
          value={selectedCategory} 
          onValueChange={(value) => {
            setSelectedCategory(value);
            setSelectedSubcategory('all'); // Reset subcategory when category changes
            setCompareProducts([]); // Clear comparison when category changes
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select 
          value={selectedSubcategory} 
          onValueChange={(value) => {
            setSelectedSubcategory(value);
            setCompareProducts([]); // Clear comparison when subcategory changes
          }}
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
              Todas as importadoras ({importadoras.length})
            </Badge>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {selectedImportadoras.map(id => {
                const imp = importadoras.find(i => i.id === id);
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

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredProducts.map(product => {
          const isComparable = canCompare(product.id);
          const isSelected = compareProducts.includes(product.id);
          
          return (
          <Card
            key={product.id}
            className="hover:shadow-lg transition-shadow overflow-hidden relative"
          >
            {/* Compare Checkbox - Only shown when filters/search are active */}
            {hasActiveFilters && (
              <div className="absolute top-2 right-2 z-10">
                <div 
                  className={`bg-white rounded-md p-1.5 shadow-md border ${!isComparable && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={!isComparable && !isSelected ? 'Só é possível comparar produtos da mesma categoria e subcategoria' : 'Adicionar à comparação'}
                >
                  <Checkbox
                    id={`compare-${product.id}`}
                    checked={isSelected}
                    disabled={!isComparable && !isSelected}
                    onCheckedChange={() => handleCompareProduct(product.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            <CardContent className="p-0">
              {/* Product Image */}
              <div className="relative bg-white p-4 group">
                <div 
                  className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center border relative overflow-hidden cursor-zoom-in"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomedImage({ productName: product.name, code: product.code });
                  }}
                >
                  <Package className="w-16 h-16 text-muted-foreground" />
                  {/* Zoom indicator */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                      <Search className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Product Info */}
              <div 
                className="p-4 space-y-2 cursor-pointer"
                onClick={() => onProductSelect(product)}
              >
                {/* Product Code */}
                <p className="text-sm font-medium text-muted-foreground">{product.code}</p>
                
                {/* Price Badge */}
                <div className="inline-block">
                  <div className="relative bg-gradient-to-r from-orange-500 to-orange-400 text-white px-3 py-1 font-bold text-lg">
                    R$ {product.price.toFixed(2)}
                    {/* Arrow decoration */}
                    <div className="absolute right-0 top-0 w-0 h-0 border-t-[16px] border-t-transparent border-b-[16px] border-b-transparent border-l-[12px] border-l-orange-400 translate-x-full"></div>
                  </div>
                </div>

                {/* Product Name */}
                <h4 className="text-base font-medium line-clamp-2 min-h-[3rem]">
                  {product.name}
                </h4>

                {/* Product Details */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><span className="font-medium">Qtd/Caixa:</span> {product.minOrder} un</p>
                  {product.material && (
                    <p><span className="font-medium">Material:</span> {product.material}</p>
                  )}
                  {product.dimensions && (
                    <p><span className="font-medium">DIM:</span> {product.dimensions}</p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 pt-2">
                  <Badge variant="outline" className="text-xs font-semibold border-primary/50 text-primary">
                    {product.importadoraName}
                  </Badge>
                </div>

                {/* Add to Cart Button */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    addItem(product, 1);
                    toast.success(`${product.name} adicionado ao carrinho`);
                  }}
                  className="w-full mt-3 bg-secondary hover:bg-secondary/90"
                  size="sm"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Adicionar ao Carrinho
                </Button>
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
            Nenhum produto encontrado com os filtros selecionados
          </p>
        </div>
      )}

      {/* Cart Sidebar */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Carrinho</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? 'produto' : 'produtos'}
            </p>
          </SheetHeader>

          {items.length === 0 ? (
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
                onClick={clearCart}
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
                                    onClick={() => removeItem(item.productId)}
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
                                      onClick={() => updateItem(item.productId, Math.max(1, item.quantity - 1))}
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
                                        updateItem(item.productId, Math.max(1, value));
                                      }}
                                      className="h-7 w-14 text-sm font-medium text-center p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Button
                                      onClick={() => updateItem(item.productId, item.quantity + 1)}
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
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Generate Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar Catálogo</DialogTitle>
            <DialogDescription>
              Gere um link para compartilhar o catálogo com seus clientes. Eles poderão visualizar produtos e fazer pedidos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                Ao compartilhar este link, seus clientes poderão:
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Visualizar todo o catálogo de produtos</li>
                <li>Adicionar produtos ao carrinho</li>
                <li>Fazer pedidos diretamente</li>
                <li>Consultar histórico de pedidos anteriores</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleGenerateLink}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <LinkIcon className="w-4 h-4 mr-2" />
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

      {/* Image Zoom Dialog */}
      <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{zoomedImage?.productName}</DialogTitle>
            <DialogDescription>
              Código: {zoomedImage?.code}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center justify-center bg-gray-50 rounded-lg p-8">
            <div className="w-full aspect-square max-w-2xl bg-white rounded-lg flex items-center justify-center border-2">
              <Package className="w-32 h-32 text-muted-foreground" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Compare Button */}
      {compareProducts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setShowComparator(true)}
            size="lg"
            className="bg-secondary hover:bg-secondary/90 shadow-lg relative"
          >
            <GitCompare className="w-5 h-5 mr-2" />
            Comparar Produtos
            <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-primary">
              {compareProducts.length}
            </Badge>
          </Button>
        </div>
      )}

      {/* Product Comparator Modal */}
      <Dialog open={showComparator} onOpenChange={setShowComparator}>
        <DialogContent className="!max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparador de Produtos</DialogTitle>
            <DialogDescription>
              Compare preços, quantidades e materiais entre diferentes importadoras
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {compareProducts.length === 0 ? (
              <div className="text-center py-12">
                <GitCompare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Selecione produtos para comparar
                </p>
              </div>
            ) : (
              <>
                {/* Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Nome</th>
                        {compareProducts.map(productId => {
                          const product = products.find(p => p.id === productId);
                          return (
                            <th key={productId} className="text-left p-3 min-w-[200px]">
                              <div className="flex items-start justify-between">
                                <span className="text-sm font-normal">{product?.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleCompareProduct(productId)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Image Row */}
                      <tr className="border-b">
                        <td className="p-3 font-medium">Imagem</td>
                        {compareProducts.map(productId => (
                          <td key={productId} className="p-3">
                            <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center border w-32">
                              <Package className="w-12 h-12 text-muted-foreground" />
                            </div>
                          </td>
                        ))}
                      </tr>

                      {/* Code Row */}
                      <tr className="border-b bg-muted/30">
                        <td className="p-3 font-medium">Código</td>
                        {compareProducts.map(productId => {
                          const product = products.find(p => p.id === productId);
                          return (
                            <td key={productId} className="p-3">
                              <span className="text-sm text-muted-foreground">{product?.code}</span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Importadora Row */}
                      <tr className="border-b">
                        <td className="p-3 font-medium">Importadora</td>
                        {compareProducts.map(productId => {
                          const product = products.find(p => p.id === productId);
                          return (
                            <td key={productId} className="p-3">
                              <Badge variant="outline">{product?.importadoraName}</Badge>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Price Row */}
                      <tr className="border-b bg-muted/30">
                        <td className="p-3 font-medium">Preço Caixa</td>
                        {compareProducts.map(productId => {
                          const product = products.find(p => p.id === productId);
                          const allPrices = compareProducts.map(id => products.find(p => p.id === id)?.price || 0);
                          const minPrice = Math.min(...allPrices);
                          const isLowestPrice = product?.price === minPrice;
                          
                          return (
                            <td key={productId} className="p-3">
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${isLowestPrice ? 'text-secondary' : ''}`}>
                                  R$ {product?.price.toFixed(2)}
                                </span>
                                {isLowestPrice && allPrices.length > 1 && (
                                  <Badge className="bg-secondary text-white">Menor preço</Badge>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Quantity per Box Row */}
                      <tr className="border-b">
                        <td className="p-3 font-medium">Quantidade/Caixa</td>
                        {compareProducts.map(productId => {
                          const product = products.find(p => p.id === productId);
                          return (
                            <td key={productId} className="p-3">
                              <span>{product?.minOrder} unidades</span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Material Row */}
                      <tr className="border-b bg-muted/30">
                        <td className="p-3 font-medium">Material</td>
                        {compareProducts.map(productId => {
                          const product = products.find(p => p.id === productId);
                          return (
                            <td key={productId} className="p-3">
                              <span className="text-sm">{product?.material || '-'}</span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Dimensions Row */}
                      <tr className="border-b">
                        <td className="p-3 font-medium">Dimensões</td>
                        {compareProducts.map(productId => {
                          const product = products.find(p => p.id === productId);
                          return (
                            <td key={productId} className="p-3">
                              <span className="text-sm">{product?.dimensions || '-'}</span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Add to Cart Row */}
                      <tr className="border-b bg-muted/30">
                        <td className="p-3 font-medium">Ações</td>
                        {compareProducts.map(productId => {
                          const product = products.find(p => p.id === productId);
                          return (
                            <td key={productId} className="p-3">
                              {product && (
                                <Button
                                  onClick={() => {
                                    onProductSelect(product);
                                    toast.success(`${product.name} adicionado ao carrinho`);
                                  }}
                                  className="w-full bg-secondary hover:bg-secondary/90"
                                  size="sm"
                                >
                                  <ShoppingCart className="w-4 h-4 mr-2" />
                                  Adicionar
                                </Button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    onClick={() => setShowComparator(false)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Fechar
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Order Dialog */}
      <Dialog open={showCreateOrderDialog} onOpenChange={setShowCreateOrderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Pedido</DialogTitle>
            <DialogDescription>
              Selecione o cliente para criar o pedido
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Cliente</label>
              <Select value={selectedClienteForOrder} onValueChange={setSelectedClienteForOrder}>
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
                onClick={handleConfirmCreateOrder}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Criar Pedido
              </Button>
              <Button
                onClick={() => setShowCreateOrderDialog(false)}
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </div>
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