import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, Save, Upload, X, Plus, Pencil, Trash2, FileText, Package, Eye, Search, ZoomIn, EyeOff, CreditCard, Users, TrendingUp, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  cropImageBlobVertical,
  equalVerticalCropFracs,
  extractTextAndPageImages,
} from '@/lib/pdfUtils';
import { parseCatalogText } from '@/lib/catalogParser';
import { useProducts, useRepresentatives } from '@/hooks/useData';
import * as productsApi from '@/services/products';
import { uploadCatalogPageImage } from '@/services/storage';
import type { Product as ApiProduct } from '@/types';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { ImageWithFallback } from '@/app/components/ui/image';
import { Switch } from '@/app/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  quantityPerBox: number;
  material: string;
  unitsPerPackage: number;
  dimensions: string;
  image?: string;
  published: boolean;
}

interface Importer {
  id: string;
  name: string;
  productsCount: number;
  lastUpdate: string;
  contactEmail: string;
  contactPhone: string;
  cnpj?: string;
}

interface ImporterDetailProps {
  importer: Importer;
  onBack: () => void;
  onUpdate: (importer: Importer) => void;
  onDelete?: (importerId: string) => void;
}

function apiProductToLocal(p: ApiProduct): Product {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    price: p.price,
    quantityPerBox: p.minOrder,
    material: p.material ?? '',
    unitsPerPackage: 0,
    dimensions: p.dimensions ?? '',
    image: p.image,
    published: p.active,
  };
}

export const ImporterDetail: React.FC<ImporterDetailProps> = ({
  importer: initialImporter,
  onBack,
  onUpdate,
  onDelete,
}) => {
  const [importer, setImporter] = useState(initialImporter);
  const { products: apiProducts, loading: productsLoading, refetch: refetchProducts } = useProducts({
    importadoraId: importer.id,
  });
  const { representatives } = useRepresentatives();
  const products = apiProducts.map(apiProductToLocal);
  const linkedRepresentatives = representatives
    .filter((r) => r.importerId === importer.id)
    .map((r) => ({ id: r.id, name: r.name, email: r.email, status: r.status }));
  const [activeTab, setActiveTab] = useState('products');
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCatalogUploadDialog, setShowCatalogUploadDialog] = useState(false);
  const [showDeleteImporterDialog, setShowDeleteImporterDialog] = useState(false);
  const [showImageZoomDialog, setShowImageZoomDialog] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [catalogProcessing, setCatalogProcessing] = useState(false);
  const [catalogProgress, setCatalogProgress] = useState<{ currentPage: number; totalPages: number } | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSaving, setProductSaving] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteMode, setBulkDeleteMode] = useState<'selected' | 'all' | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showProductDeleteOptions, setShowProductDeleteOptions] = useState(false);

  // Estados Financeiros (novas importadoras vêm com plano free e pagamento em dia)
  const [financialData, setFinancialData] = useState({
    plan: 'free' as 'free' | 'basic' | 'pro',
    maxRepresentatives: '3',
    maxProcessesPerMonth: '20',
    paymentStatus: 'paid' as 'paid' | 'overdue',
  });

  const [formData, setFormData] = useState({
    name: importer.name,
    cnpj: importer.cnpj || '',
    contactEmail: importer.contactEmail,
    contactPhone: importer.contactPhone,
  });

  const [productFormData, setProductFormData] = useState({
    code: '',
    name: '',
    category: '',
    price: '',
    quantityPerBox: '',
    material: '',
    unitsPerPackage: '',
    dimensions: '',
    published: true,
  });

  useEffect(() => {
    if (activeTab !== 'products') {
      setShowProductDeleteOptions(false);
      setSelectedProductIds(new Set());
      setBulkDeleteMode(null);
    }
  }, [activeTab]);

  useEffect(() => {
    const valid = new Set(apiProducts.map((p) => p.id));
    setSelectedProductIds((prev) => {
      const next = new Set<string>();
      let changed = false;
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      if (!changed && next.size === prev.size) return prev;
      return next;
    });
  }, [apiProducts]);

  const getProductSaveErrorMessage = (error: unknown) => {
    if (!error || typeof error !== 'object') {
      return 'Não foi possível salvar o produto.';
    }

    const message = 'message' in error ? String(error.message) : '';
    const code = 'code' in error ? String(error.code) : '';

    if (code === '23505' || message.toLowerCase().includes('duplicate key')) {
      return 'Já existe um produto com este código nesta importadora.';
    }

    if (message) {
      return message;
    }

    return 'Não foi possível salvar o produto.';
  };

  const handleSaveInfo = () => {
    const updatedImporter = {
      ...importer,
      name: formData.name,
      cnpj: formData.cnpj,
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
    };
    setImporter(updatedImporter);
    onUpdate(updatedImporter);
    toast.success('Informações atualizadas com sucesso!');
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductFormData({
      code: '',
      name: '',
      category: '',
      price: '',
      quantityPerBox: '',
      material: '',
      unitsPerPackage: '',
      dimensions: '',
      published: true,
    });
    setShowProductDialog(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductFormData({
      code: product.code,
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      quantityPerBox: product.quantityPerBox.toString(),
      material: product.material,
      unitsPerPackage: product.unitsPerPackage.toString(),
      dimensions: product.dimensions,
      published: product.published,
    });
    setShowProductDialog(true);
  };

  const handleSaveProduct = async () => {
    const code = productFormData.code.trim();
    const name = productFormData.name.trim();
    const category = productFormData.category.trim();
    const price = Number(productFormData.price);
    const minOrder = Number.parseInt(productFormData.quantityPerBox, 10) || 1;

    if (!code || !name || !category || !productFormData.price) {
      toast.error('Preencha código, nome, categoria e preço.');
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Informe um preço maior que zero.');
      return;
    }

    if (minOrder <= 0) {
      toast.error('A quantidade por caixa deve ser maior que zero.');
      return;
    }

    setProductSaving(true);
    try {
      if (editingProduct) {
        await productsApi.updateProduct(editingProduct.id, {
          name,
          category,
          price,
          minOrder,
          material: productFormData.material.trim() || undefined,
          dimensions: productFormData.dimensions.trim() || undefined,
          active: productFormData.published,
        });
        toast.success('Produto atualizado com sucesso!');
      } else {
        await productsApi.createProduct({
          importadoraId: importer.id,
          code,
          name,
          category,
          price,
          minOrder,
          material: productFormData.material.trim() || undefined,
          dimensions: productFormData.dimensions.trim() || undefined,
          active: productFormData.published,
        });
        toast.success('Produto adicionado com sucesso!');
      }
      await refetchProducts();
      setShowProductDialog(false);
    } catch (e) {
      console.error(e);
      toast.error(getProductSaveErrorMessage(e));
    } finally {
      setProductSaving(false);
    }
  };

  const confirmDeleteProduct = (product: Product) => {
    setDeletingProduct(product);
    setShowDeleteDialog(true);
  };

  const handleDeleteProduct = async () => {
    const target = deletingProduct ?? editingProduct;
    if (!target) {
      toast.error('Nenhum produto selecionado para exclusão.');
      return;
    }
    try {
      await productsApi.deleteProduct(target.id);
      toast.success('Produto excluído com sucesso!');
      setShowDeleteDialog(false);
      setDeletingProduct(null);
      setShowProductDialog(false);
      setEditingProduct(null);
      setSelectedProductIds((prev) => {
        if (!prev.has(target.id)) return prev;
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
      const updatedList = await refetchProducts();
      setImporter((prev) => {
        const next = { ...prev, productsCount: updatedList.length };
        onUpdate(next);
        return next;
      });
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível excluir o produto.');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Por favor, envie apenas arquivos PDF');
        return;
      }
      setUploadedFileName(file.name);
      setUploadedFile(file);
      toast.success('Arquivo selecionado. Clique em Processar Catálogo.');
    }
    event.target.value = '';
  };

  const handleProcessCatalog = async () => {
    if (!uploadedFile) return;
    setCatalogProcessing(true);
    setCatalogProgress(null);
    try {
      const { pageTexts, pageBlobs, ocrPageCount, pageSkuVerticalBands } = await extractTextAndPageImages(
        uploadedFile,
        {
          onOcrStarting: () => {
            toast.info('Usando OCR no catálogo', {
              description:
                'Algumas páginas têm pouco texto selecionável; estamos lendo a imagem. Pode levar mais alguns instantes.',
              duration: 10_000,
            });
          },
          onPageProcessed: ({ currentPage, totalPages }) => {
            setCatalogProgress({ currentPage, totalPages });
          },
        }
      );
      const itemsWithPage: Array<ReturnType<typeof parseCatalogText>[number] & { pageIndex: number }> = [];
      for (let i = 0; i < pageTexts.length; i++) {
        const pageItems = parseCatalogText(pageTexts[i]);
        pageItems.forEach((item) => itemsWithPage.push({ ...item, pageIndex: i }));
      }
      if (itemsWithPage.length === 0) {
        toast.warning('Nenhum produto identificado no PDF. Tente outro arquivo ou adicione produtos manualmente.');
        return;
      }
      const codeUsed = new Set(products.map((p) => p.code));
      const ensureUniqueCode = (code: string, pageIndex: number, batchIndex: number): string => {
        const fallback = `PAG-${pageIndex + 1}-${batchIndex + 1}`;
        const base = (code && code.trim()) || fallback;
        if (!codeUsed.has(base)) {
          codeUsed.add(base);
          return base;
        }
        let n = 2;
        let candidate = `${base}-${n}`;
        while (codeUsed.has(candidate)) {
          n += 1;
          candidate = `${base}-${n}`;
        }
        codeUsed.add(candidate);
        return candidate;
      };

      const itemsByPage = new Map<number, typeof itemsWithPage>();
      for (const it of itemsWithPage) {
        const arr = itemsByPage.get(it.pageIndex) ?? [];
        arr.push(it);
        itemsByPage.set(it.pageIndex, arr);
      }

      const cropByItem = new Map<
        (typeof itemsWithPage)[number],
        { top: number; bottom: number }
      >();
      for (const [pIdx, list] of itemsByPage) {
        if (list.length <= 1) continue;
        const bands = pageSkuVerticalBands[pIdx] ?? [];
        const equal = equalVerticalCropFracs(list.length);
        list.forEach((item, slot) => {
          const bySku = bands.find((b) => b.sku === item.code);
          if (bySku) {
            cropByItem.set(item, { top: bySku.topFrac, bottom: bySku.bottomFrac });
          } else if (equal[slot]) {
            cropByItem.set(item, { top: equal[slot].topFrac, bottom: equal[slot].bottomFrac });
          }
        });
      }

      itemsWithPage.forEach((item, idx) => {
        item.code = ensureUniqueCode(item.code, item.pageIndex, idx);
      });
      const batchId = String(Date.now());

      let created = 0;
      let uploadFailed = false;
      for (const item of itemsWithPage) {
        const pageBlob = item.pageIndex < pageBlobs.length ? pageBlobs[item.pageIndex] : undefined;
        let blob: Blob | undefined = pageBlob;
        const crop = cropByItem.get(item);
        if (crop && pageBlob) {
          const cropped = await cropImageBlobVertical(pageBlob, crop.top, crop.bottom);
          if (cropped) blob = cropped;
        }
        const samePage = itemsByPage.get(item.pageIndex) ?? [item];
        const productSlot = samePage.length > 1 ? samePage.indexOf(item) : undefined;
        let imageUrl: string | undefined;
        if (blob) {
          try {
            imageUrl = await uploadCatalogPageImage(
              importer.id,
              item.pageIndex,
              blob,
              batchId,
              productSlot
            );
          } catch (storageErr) {
            console.warn('Upload de imagem falhou para um produto:', storageErr);
            uploadFailed = true;
          }
        }
        await productsApi.createProduct({
          importadoraId: importer.id,
          code: item.code,
          name: item.name,
          category: item.category,
          price: item.price,
          minOrder: item.minOrder,
          material: item.material || undefined,
          dimensions: item.dimensions || undefined,
          active: true,
          image: imageUrl,
        });
        created++;
      }
      if (uploadFailed) {
        toast.warning('Algumas imagens não foram enviadas; revise os produtos sem foto.');
      }
      await refetchProducts();
      setShowCatalogUploadDialog(false);
      setUploadedFileName(null);
      setUploadedFile(null);
      setCatalogProgress(null);
      const hadAnyBlob = pageBlobs.length > 0;
      const successTitle = hadAnyBlob
        ? `Catálogo processado: ${created} produto(s) adicionado(s) com imagens.`
        : `Catálogo processado: ${created} produto(s) adicionado(s).`;
      if (ocrPageCount > 0) {
        toast.success(successTitle, {
          description: `OCR aplicado em ${ocrPageCount} página(s) para extrair código, preço e descrição.`,
        });
      } else {
        toast.success(successTitle);
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        msg.length > 80
          ? `Erro ao processar catálogo. Verifique o console (F12) para detalhes.`
          : `Erro: ${msg}`
      );
    } finally {
      setCatalogProcessing(false);
      setCatalogProgress(null);
    }
  };

  const handleImageZoom = (image: string) => {
    setZoomedImage(image);
    setShowImageZoomDialog(true);
  };

  const handleDeleteImporter = () => {
    if (onDelete) {
      onDelete(importer.id);
      setShowDeleteImporterDialog(false);
    }
  };

  const handleSaveFinancial = () => {
    toast.success('Dados financeiros atualizados com sucesso!');
  };

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.code.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          (product.category || '').toLowerCase().includes(productSearchTerm.toLowerCase()) ||
          (product.material || '').toLowerCase().includes(productSearchTerm.toLowerCase())
      ),
    [products, productSearchTerm]
  );

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredProducts.map((p) => p.id);
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedProductIds.has(id));
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleConfirmBulkDelete = async () => {
    if (!bulkDeleteMode) return;
    setBulkDeleting(true);
    try {
      if (bulkDeleteMode === 'all') {
        await productsApi.deleteProductsByImportadoraId(importer.id);
        toast.success('Todos os produtos foram excluídos.');
      } else {
        const ids = Array.from(selectedProductIds);
        if (ids.length === 0) {
          toast.error('Nenhum produto selecionado.');
          setBulkDeleteMode(null);
          return;
        }
        await productsApi.deleteProductsByIds(ids);
        toast.success(
          ids.length === 1 ? '1 produto excluído.' : `${ids.length} produtos excluídos.`
        );
      }
      const updatedList = await refetchProducts();
      setSelectedProductIds(new Set());
      setBulkDeleteMode(null);
      setShowProductDeleteOptions(false);
      setImporter((prev) => {
        const next = { ...prev, productsCount: updatedList.length };
        onUpdate(next);
        return next;
      });
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível excluir os produtos.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleProductDeleteOptions = () => {
    setShowProductDeleteOptions((prev) => {
      if (prev) {
        setSelectedProductIds(new Set());
        setBulkDeleteMode(null);
      }
      return !prev;
    });
  };

  const visibleIds = filteredProducts.map((p) => p.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedProductIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedProductIds.has(id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="h-10 w-10 p-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="mb-0">{importer.name}</h2>
              <p className="text-sm text-muted-foreground">
                {products.length} produtos cadastrados
              </p>
            </div>
          </div>
        </div>
        {onDelete && (
          <Button
            variant="destructive"
            onClick={() => setShowDeleteImporterDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir Importadora
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="products">
            Produtos
            <Badge variant="secondary" className="ml-2">
              {products.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
        </TabsList>

        {/* Aba de Informações */}
        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados Cadastrais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Importadora *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) =>
                      setFormData({ ...formData, cnpj: e.target.value })
                    }
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email de Contato *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, contactEmail: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    value={formData.contactPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, contactPhone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveInfo}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Produtos */}
        <TabsContent value="products" className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Catálogo de Produtos</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie os produtos desta importadora
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                className={
                  showProductDeleteOptions
                    ? ''
                    : 'text-destructive border-destructive/40 hover:bg-destructive/10'
                }
                onClick={toggleProductDeleteOptions}
                disabled={products.length === 0 && !showProductDeleteOptions}
              >
                {showProductDeleteOptions ? (
                  <X className="w-4 h-4 mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {showProductDeleteOptions ? 'Cancelar exclusão' : 'Excluir produtos'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCatalogUploadDialog(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload de Catálogo
              </Button>
              <Button
                onClick={handleAddProduct}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Produto
              </Button>
            </div>
          </div>

          {/* Busca de Produtos */}
          {products.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, nome, categoria ou material..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {products.length > 0 && showProductDeleteOptions && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-visible-products"
                  checked={
                    allVisibleSelected
                      ? true
                      : someVisibleSelected
                        ? 'indeterminate'
                        : false
                  }
                  onCheckedChange={() => toggleSelectAllVisible()}
                  disabled={filteredProducts.length === 0}
                />
                <label
                  htmlFor="select-visible-products"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Selecionar visíveis
                </label>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedProductIds.size} selecionado(s)
              </span>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  disabled={selectedProductIds.size === 0}
                  onClick={() => setBulkDeleteMode('selected')}
                >
                  Excluir selecionados
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setBulkDeleteMode('all')}>
                  Excluir todos os produtos
                </Button>
              </div>
            </div>
          )}

          {/* Lista de Produtos */}
          {productsLoading && products.length === 0 ? (
            <Card className="p-12">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Package className="w-8 h-8 text-muted-foreground animate-pulse" />
                </div>
                <p className="text-muted-foreground">Carregando produtos...</p>
              </div>
            </Card>
          ) : filteredProducts.length > 0 ? (
            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {showProductDeleteOptions && (
                        <Checkbox
                          className="shrink-0"
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={(checked) => {
                            setSelectedProductIds((prev) => {
                              const next = new Set(prev);
                              if (checked === true) next.add(product.id);
                              else next.delete(product.id);
                              return next;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Selecionar ${product.code}`}
                        />
                      )}
                      {/* Imagem do Produto */}
                      <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted group cursor-pointer">
                        {product.image ? (
                          <>
                            <ImageWithFallback
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                            <div
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              onClick={() => handleImageZoom(product.image!)}
                            >
                              <ZoomIn className="w-6 h-6 text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Informações do Produto */}
                      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                        {/* Código e Nome */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono text-xs">
                              {product.code}
                            </Badge>
                            {product.published ? (
                              <Badge variant="default" className="bg-green-600 text-xs">
                                <Eye className="w-3 h-3 mr-1" />
                                Publicado
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <EyeOff className="w-3 h-3 mr-1" />
                                Rascunho
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-semibold truncate">{product.name}</h4>
                          <p className="text-xs text-muted-foreground">{product.category}</p>
                        </div>

                        {/* Especificações */}
                        <div className="text-sm space-y-1">
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">{product.quantityPerBox}</span> unid/caixa
                          </p>
                          <p className="text-muted-foreground">
                            Sacola: <span className="font-medium text-foreground">{product.unitsPerPackage}</span> unid
                          </p>
                        </div>

                        {/* Material e Dimensões */}
                        <div className="text-sm space-y-1">
                          <p className="text-muted-foreground truncate">
                            {product.material}
                          </p>
                          <p className="text-muted-foreground">
                            Dim: {product.dimensions}
                          </p>
                        </div>

                        {/* Preço */}
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary mb-1">
                            R$ {product.price.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex flex-col gap-3 shrink-0 items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => handleEditProduct(product)}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products.length === 0 ? (
            <Card className="p-12">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg">Nenhum produto cadastrado</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Faça o upload de um catálogo em PDF ou adicione produtos manualmente
                </p>
                <div className="flex gap-2 justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCatalogUploadDialog(true)}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload de Catálogo
                  </Button>
                  <Button
                    onClick={handleAddProduct}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Produto
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-12">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg">Nenhum produto encontrado</h3>
                <p className="text-muted-foreground">
                  Tente buscar com outros termos
                </p>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Aba Financeira */}
        <TabsContent value="financial" className="space-y-6">
          {/* Cards de Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Plano Atual</p>
                    <p className="text-xl font-bold capitalize">{financialData.plan}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Representantes</p>
                    <p className="text-xl font-bold">
                      {linkedRepresentatives.length} / {financialData.maxRepresentatives}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    financialData.paymentStatus === 'paid' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {financialData.paymentStatus === 'paid' ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Pagamento</p>
                    <p className={`text-xl font-bold ${
                      financialData.paymentStatus === 'paid' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {financialData.paymentStatus === 'paid' ? 'Em dia' : 'Atrasado'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Configurações do Plano */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plan">Plano da Importadora</Label>
                  <Select
                    value={financialData.plan}
                    onValueChange={(value) =>
                      setFinancialData({ ...financialData, plan: value as 'free' | 'basic' | 'pro' })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">🆓 Free</SelectItem>
                      <SelectItem value="basic">📦 Básico</SelectItem>
                      <SelectItem value="pro">⭐ Pro</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {financialData.plan === 'free' && 'Plano gratuito com recursos limitados'}
                    {financialData.plan === 'basic' && 'Plano básico para pequenas operações'}
                    {financialData.plan === 'pro' && 'Plano completo com todos os recursos'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentStatus">Status de Pagamento</Label>
                  <Select
                    value={financialData.paymentStatus}
                    onValueChange={(value) =>
                      setFinancialData({ ...financialData, paymentStatus: value as 'paid' | 'overdue' })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">✅ Em dia</SelectItem>
                      <SelectItem value="overdue">⚠️ Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {financialData.paymentStatus === 'paid' && 'Pagamento em dia, todos os recursos ativos'}
                    {financialData.paymentStatus === 'overdue' && 'Pagamento atrasado, recursos podem ser limitados'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Limites */}
          <Card>
            <CardHeader>
              <CardTitle>Limites e Cotas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="maxRepresentatives">Número de Representantes</Label>
                  <Input
                    id="maxRepresentatives"
                    type="number"
                    value={financialData.maxRepresentatives}
                    onChange={(e) =>
                      setFinancialData({ ...financialData, maxRepresentatives: e.target.value })
                    }
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Atual: {linkedRepresentatives.length} de {financialData.maxRepresentatives} representantes vinculados
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxProcessesPerMonth">Processos por Mês</Label>
                  <Input
                    id="maxProcessesPerMonth"
                    type="number"
                    value={financialData.maxProcessesPerMonth}
                    onChange={(e) =>
                      setFinancialData({ ...financialData, maxProcessesPerMonth: e.target.value })
                    }
                    placeholder="100"
                  />
                  <p className="text-xs text-muted-foreground">
                    Limite mensal de processos/pedidos que podem ser criados
                  </p>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveFinancial}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Representantes Vinculadas */}
          <Card>
            <CardHeader>
              <CardTitle>Representantes Vinculadas</CardTitle>
            </CardHeader>
            <CardContent>
              {linkedRepresentatives.length > 0 ? (
                <div className="space-y-3">
                  {linkedRepresentatives.map((rep) => (
                    <div
                      key={rep.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{rep.name}</p>
                          <p className="text-sm text-muted-foreground">{rep.email}</p>
                        </div>
                      </div>
                      <Badge
                        variant={rep.status === 'active' ? 'default' : 'secondary'}
                        className={rep.status === 'active' ? 'bg-green-600' : ''}
                      >
                        {rep.status === 'active' ? 'Ativa' : 'Pendente'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-3">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg mb-1">Nenhuma representante vinculada</h3>
                  <p className="text-sm text-muted-foreground">
                    As representantes aparecerão aqui quando forem associadas a esta importadora
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Upload de Catálogo */}
      <Dialog open={showCatalogUploadDialog} onOpenChange={setShowCatalogUploadDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload de Catálogo PDF</DialogTitle>
            <DialogDescription>
              Envie o catálogo em PDF para extrair automaticamente os produtos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              {uploadedFileName ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{uploadedFileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Arquivo pronto para processar
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUploadedFileName(null);
                      setUploadedFile(null);
                    }}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remover
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Arraste o PDF aqui ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Apenas arquivos PDF são aceitos
                    </p>
                  </div>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="max-w-xs mx-auto"
                  />
                </>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">O que será extraído:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Código, nome e preço (em campos separados)</li>
                <li>Material e dimensões (quando identificados no texto)</li>
                <li>Uma imagem por página (a página inteira como foto do produto)</li>
              </ul>
              <p className="text-xs text-muted-foreground pt-1">
                Produtos da mesma página compartilham a mesma imagem. Você pode trocar por foto do produto depois.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCatalogUploadDialog(false);
                setUploadedFileName(null);
                setUploadedFile(null);
                setCatalogProgress(null);
              }}
              disabled={catalogProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProcessCatalog}
              disabled={!uploadedFile || catalogProcessing}
              className="bg-primary hover:bg-primary/90"
            >
              {catalogProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {catalogProcessing
                ? catalogProgress
                  ? `Processando página ${catalogProgress.currentPage} de ${catalogProgress.totalPages}...`
                  : 'Processando...'
                : 'Processar Catálogo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Adicionar/Editar Produto */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Produto' : 'Adicionar Produto'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Atualize as informações do produto'
                : 'Adicione um novo produto ao catálogo'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Código do Produto *</Label>
                <Input
                  id="code"
                  value={productFormData.code}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, code: e.target.value })
                  }
                  placeholder="Ex: CRS-2625"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productName">Nome do Produto *</Label>
                <Input
                  id="productName"
                  value={productFormData.name}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, name: e.target.value })
                  }
                  placeholder="Ex: Garfo de Mesa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  value={productFormData.category}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, category: e.target.value })
                  }
                  placeholder="Ex: Madras"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={productFormData.price}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, price: e.target.value })
                  }
                  placeholder="8.75"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantityPerBox">Quantidade por Caixa</Label>
                <Input
                  id="quantityPerBox"
                  type="number"
                  value={productFormData.quantityPerBox}
                  onChange={(e) =>
                    setProductFormData({
                      ...productFormData,
                      quantityPerBox: e.target.value,
                    })
                  }
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitsPerPackage">Unidades por Sacola</Label>
                <Input
                  id="unitsPerPackage"
                  type="number"
                  value={productFormData.unitsPerPackage}
                  onChange={(e) =>
                    setProductFormData({
                      ...productFormData,
                      unitsPerPackage: e.target.value,
                    })
                  }
                  placeholder="6"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="material">Material</Label>
                <Input
                  id="material"
                  value={productFormData.material}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, material: e.target.value })
                  }
                  placeholder="Ex: Madeira e metal"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="dimensions">Dimensões</Label>
                <Input
                  id="dimensions"
                  value={productFormData.dimensions}
                  onChange={(e) =>
                    setProductFormData({
                      ...productFormData,
                      dimensions: e.target.value,
                    })
                  }
                  placeholder="Ex: 27x8 cm"
                />
              </div>
            </div>

            {/* Status de Publicação */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="published" className="text-base">
                    Publicar Produto
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {productFormData.published
                      ? 'Produto visível no catálogo para representantes e clientes'
                      : 'Produto oculto, apenas visível para administradores'}
                  </p>
                </div>
                <Switch
                  id="published"
                  checked={productFormData.published}
                  onCheckedChange={(checked) =>
                    setProductFormData({ ...productFormData, published: checked })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            {editingProduct && (
              <Button
                variant="destructive"
                onClick={() => confirmDeleteProduct(editingProduct)}
                className="mr-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Produto
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowProductDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveProduct}
                className="bg-primary hover:bg-primary/90"
                disabled={productSaving}
              >
                {productSaving ? 'Salvando...' : editingProduct ? 'Atualizar' : 'Adicionar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão de Produto */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setDeletingProduct(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir o produto{' '}
              <span className="font-semibold text-foreground">
                {deletingProduct?.code} - {deletingProduct?.name}
              </span>
              ?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDeleteProduct} variant="destructive">
              Sim, Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDeleteMode !== null}
        onOpenChange={(open) => {
          if (!open && !bulkDeleting) setBulkDeleteMode(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkDeleteMode === 'all'
                ? 'Excluir todo o catálogo?'
                : 'Excluir produtos selecionados?'}
            </DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground space-y-2">
            {bulkDeleteMode === 'all' ? (
              <p>
                Todos os produtos desta importadora serão removidos, inclusive os que não aparecem
                no resultado da busca atual.
              </p>
            ) : (
              <p>
                Você está prestes a excluir{' '}
                <span className="font-semibold text-foreground">{selectedProductIds.size}</span>{' '}
                produto(s).
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteMode(null)}
              disabled={bulkDeleting}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Confirmar exclusão'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão da Importadora */}
      <Dialog open={showDeleteImporterDialog} onOpenChange={setShowDeleteImporterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão da Importadora</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir a importadora{' '}
              <span className="font-semibold text-foreground">{importer.name}</span>?
              Todos os produtos associados serão removidos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteImporterDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDeleteImporter} variant="destructive">
              Sim, Excluir Importadora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Zoom da Imagem */}
      <Dialog open={showImageZoomDialog} onOpenChange={setShowImageZoomDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Visualização da Imagem</DialogTitle>
            <DialogDescription>
              Imagem em tamanho ampliado
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {zoomedImage && (
              <ImageWithFallback
                src={zoomedImage}
                alt="Produto em zoom"
                className="w-full h-auto rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};