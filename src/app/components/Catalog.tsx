import React, { useState } from 'react';
import { Search, Filter, Camera, Package, ShoppingCart, X, Plus, Minus, Trash2, Link as LinkIcon, ShoppingBag, GitCompare, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Textarea } from '@/app/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible';
import { MultiSelect } from '@/app/components/ui/multi-select';
import { Product } from '@/types';
import { useImportadoras, useCategories, useProducts, useClientes } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { resolveRepresentativeForCatalogShare } from '@/services/representantes';
import { ImageSearchDialog } from '@/app/components/ImageSearchDialog';
import { ImageWithFallback } from '@/app/components/ui/image';
import { productMatchesCatalogFilters } from '@/lib/catalogFilters';
import { toast } from 'sonner';

interface CatalogProps {
  onProductSelect: (product: Product) => void;
  showCart?: boolean;
  mainHeaderVisible?: boolean;
  mainHeaderHeight?: number;
}

export const Catalog: React.FC<CatalogProps> = ({
  onProductSelect,
  showCart = false,
  mainHeaderVisible = true,
  mainHeaderHeight = 0,
}) => {
  const { user } = useAuth();
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
  const [zoomedImage, setZoomedImage] = useState<{
    productName: string;
    code: string;
    image?: string;
  } | null>(null);
  const [compareProducts, setCompareProducts] = useState<string[]>([]);
  const [showComparator, setShowComparator] = useState(false);
  const [showImageSearchDialog, setShowImageSearchDialog] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  const filteredProducts = products.filter((product) =>
    productMatchesCatalogFilters(product, {
      searchTerm,
      selectedImportadoras,
      selectedCategory,
      selectedSubcategory,
    })
  );

  const handleGenerateLink = async () => {
    const copyToClipboard = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Link do catálogo copiado para área de transferência!');
      } catch {
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
        } catch {
          toast.error('Não foi possível copiar o link');
        }
        document.body.removeChild(textArea);
      }
    };

    if (!user?.id) {
      toast.error('Faça login para gerar o link do catálogo.');
      return;
    }

    try {
      const rep = await resolveRepresentativeForCatalogShare(user.id, user.email);
      if (!rep?.id) {
        toast.error(
          'Não foi possível identificar seu cadastro de representante. Confira se existe um representante com o mesmo e-mail da sua conta; se o e-mail já estiver vinculado a outro usuário, peça suporte ao administrador.'
        );
        return;
      }
      const suffix = Math.random().toString(36).substring(2, 9);
      const link = `${window.location.origin}/catalogo/${rep.id}/${suffix}`;
      await copyToClipboard(link);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível gerar o link. Tente novamente.');
    }

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
  const hasCatalogFilters =
    selectedCategory !== 'all' ||
    selectedSubcategory !== 'all' ||
    selectedImportadoras.length > 0;

  const hasActiveFilters = 
    searchTerm !== '' || 
    hasCatalogFilters;

  const stickyToolbarTop =
    mainHeaderVisible && mainHeaderHeight > 0 ? mainHeaderHeight : 0;

  return (
    <div className="min-w-0 space-y-5 pb-2">
      <div
        className="sticky z-40 -mx-4 space-y-4 border-b border-border/60 bg-background/95 px-4 pb-4 pt-1 shadow-sm backdrop-blur-sm transition-[top] duration-300 ease-in-out supports-[backdrop-filter]:bg-background/80"
        style={{ top: stickyToolbarTop }}
      >
      <div className="flex items-start justify-between gap-3 overflow-visible">
        <div className="min-w-0 flex-1 pr-1">
          <h2 className="mb-1 text-xl font-semibold sm:mb-2 sm:text-2xl">Catálogo de Produtos</h2>
          <p className="text-sm text-muted-foreground">
            Busque e adicione produtos ao carrinho
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4 pr-2 sm:gap-2 sm:pr-0">
          <Button
            onClick={() => setShowLinkDialog(true)}
            variant="outline"
            size="icon"
            className="h-9 w-9 border-secondary text-secondary hover:bg-secondary/10 sm:hidden"
            aria-label="Compartilhar catálogo"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>

          <div className="relative z-50 shrink-0 sm:hidden">
            <Button
              onClick={() => setCartOpen(true)}
              size="icon"
              className="h-9 w-9 bg-primary hover:bg-primary/90"
              aria-label="Carrinho"
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
            {items.length > 0 && (
              <span
                className="pointer-events-none absolute right-0 top-0 z-[100] flex h-5 min-w-5 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background bg-secondary px-1 text-[11px] font-semibold leading-none text-secondary-foreground shadow-md"
                aria-hidden
              >
                {items.length > 99 ? '99+' : items.length}
              </span>
            )}
          </div>

          <Button
            onClick={() => setShowLinkDialog(true)}
            variant="outline"
            size="sm"
            className="hidden h-10 border-secondary text-secondary hover:bg-secondary/10 sm:inline-flex"
          >
            <LinkIcon className="mr-2 h-4 w-4" />
            Compartilhar
          </Button>

          <div className="relative z-50 hidden shrink-0 sm:block">
            <Button
              onClick={() => setCartOpen(true)}
              size="sm"
              className="h-10 bg-primary hover:bg-primary/90"
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Carrinho
            </Button>
            {items.length > 0 && (
              <span
                className="pointer-events-none absolute right-0 top-0 z-[100] flex h-5 min-w-5 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background bg-secondary px-1 text-xs font-semibold leading-none text-secondary-foreground shadow-md"
                aria-hidden
              >
                {items.length > 99 ? '99+' : items.length}
              </span>
            )}
          </div>
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
      </div>

      {/* Filters — mobile: colapsável */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="md:hidden">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left [&[data-state=open]>svg.chevron]:rotate-180">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Filtros</span>
            {hasCatalogFilters && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                Ativos
              </Badge>
            )}
          </div>
          <ChevronDown className="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3 data-[state=closed]:animate-out data-[state=open]:animate-in">
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
              setSelectedSubcategory('all');
              setCompareProducts([]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[100] max-h-[280px]">
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
              setCompareProducts([]);
            }}
            disabled={selectedCategory === 'all'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as subcategorias" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[100] max-h-[280px]">
              <SelectItem value="all">Todas as subcategorias</SelectItem>
              {availableSubcategories.map(subcat => (
                <SelectItem key={subcat} value={subcat}>{subcat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CollapsibleContent>
      </Collapsible>

      {/* Filters — desktop */}
      <div className="hidden gap-3 md:grid md:grid-cols-3">
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
            setSelectedSubcategory('all');
            setCompareProducts([]);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent position="popper" className="z-[100] max-h-[280px]">
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
            setCompareProducts([]);
          }}
          disabled={selectedCategory === 'all'}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas as subcategorias" />
          </SelectTrigger>
          <SelectContent position="popper" className="z-[100] max-h-[280px]">
            <SelectItem value="all">Todas as subcategorias</SelectItem>
            {availableSubcategories.map(subcat => (
              <SelectItem key={subcat} value={subcat}>{subcat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search Info & Results Count */}
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <span className="shrink-0 text-muted-foreground">
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
        <span className="shrink-0 text-muted-foreground sm:text-right">
          {filteredProducts.length} produto{filteredProducts.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Product Grid */}
      <div className="min-w-0 overflow-x-hidden">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <div className="absolute top-1.5 right-1.5 z-10 sm:top-2 sm:right-2">
                <div 
                  className={`rounded-md border bg-white p-1 shadow-md sm:p-1.5 ${!isComparable && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              <div className="relative bg-white p-2 group sm:p-4">
                <div 
                  className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center border relative overflow-hidden cursor-zoom-in"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomedImage({
                      productName: product.name,
                      code: product.code,
                      image: product.image,
                    });
                  }}
                >
                  {product.image ? (
                    <ImageWithFallback
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Package className="h-10 w-10 text-muted-foreground sm:h-16 sm:w-16" />
                  )}
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
                className="cursor-pointer space-y-1.5 p-2 sm:space-y-2 sm:p-4"
                onClick={() => onProductSelect(product)}
              >
                {/* Product Code */}
                <p className="truncate text-[10px] font-medium text-muted-foreground sm:text-sm">{product.code}</p>
                
                {/* Price Badge */}
                <div className="inline-block max-w-full">
                  <div className="rounded-sm bg-gradient-to-r from-orange-500 to-orange-400 px-2 py-0.5 text-sm font-bold text-white sm:relative sm:rounded-none sm:px-3 sm:py-1 sm:text-lg">
                    R$ {product.price.toFixed(2)}
                    <div className="absolute right-0 top-0 hidden h-0 w-0 translate-x-full border-b-[16px] border-l-[12px] border-t-[16px] border-b-transparent border-l-orange-400 border-t-transparent sm:block" />
                  </div>
                </div>

                {/* Product Name */}
                <h4 className="line-clamp-2 text-xs font-medium sm:min-h-[3rem] sm:text-base">
                  {product.name}
                </h4>

                {/* Product Details */}
                <div className="hidden space-y-1 text-xs text-muted-foreground sm:block">
                  <p><span className="font-medium">Qtd/Caixa:</span> {product.minOrder} un</p>
                  {product.material && (
                    <p><span className="font-medium">Material:</span> {product.material}</p>
                  )}
                  {product.dimensions && (
                    <p><span className="font-medium">DIM:</span> {product.dimensions}</p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 pt-1 sm:pt-2">
                  <Badge variant="outline" className="max-w-full truncate text-[10px] font-semibold border-primary/50 text-primary sm:text-xs">
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
                  className="mt-2 h-8 w-full bg-secondary hover:bg-secondary/90 sm:mt-3 sm:h-9"
                  size="sm"
                >
                  <ShoppingCart className="h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm">Adicionar</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
        })}
      </div>

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
                              <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                                {item.product.image ? (
                                  <ImageWithFallback
                                    src={item.product.image}
                                    alt={item.product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="w-8 h-8 text-muted-foreground" />
                                )}
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

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                onClick={() => setShowLinkDialog(false)}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGenerateLink}
                className="w-full flex-1 bg-primary hover:bg-primary/90"
              >
                <LinkIcon className="mr-2 h-4 w-4" />
                Gerar e Copiar Link
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
            <div className="w-full max-w-2xl bg-white rounded-lg flex items-center justify-center border-2 min-h-[200px] overflow-hidden">
              {zoomedImage?.image ? (
                <ImageWithFallback
                  src={zoomedImage.image}
                  alt={zoomedImage.productName}
                  className="max-h-[70vh] w-full object-contain"
                />
              ) : (
                <div className="aspect-square w-full max-w-2xl flex items-center justify-center">
                  <Package className="w-32 h-32 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Compare Button */}
      {compareProducts.length > 0 && (
        <div className="fixed bottom-20 left-3 right-3 z-50 sm:bottom-6 sm:left-auto sm:right-6 sm:w-auto">
          <Button
            onClick={() => setShowComparator(true)}
            size="lg"
            className="relative w-full bg-secondary shadow-lg hover:bg-secondary/90 sm:w-auto"
          >
            <GitCompare className="mr-2 h-5 w-5 shrink-0" />
            <span className="truncate">Comparar</span>
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
                        {compareProducts.map(productId => {
                          const cmpProduct = products.find(p => p.id === productId);
                          return (
                            <td key={productId} className="p-3">
                              <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center border w-32 overflow-hidden">
                                {cmpProduct?.image ? (
                                  <ImageWithFallback
                                    src={cmpProduct.image}
                                    alt={cmpProduct.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="w-12 h-12 text-muted-foreground" />
                                )}
                              </div>
                            </td>
                          );
                        })}
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