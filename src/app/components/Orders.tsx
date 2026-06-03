import React, { useState, useEffect } from 'react';
import { ShoppingBag, ArrowLeft, Package, DollarSign, TrendingUp, Calendar, Building, User, Download, Bell, Eye, Search, Upload, FileText, X, CheckCircle, Truck, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useOrders } from '@/contexts/OrdersContext';
import { useTransportadoras } from '@/hooks/useData';
import { toast } from 'sonner';
import { Order, OrderStatus } from '@/types';
import {
  formatPriceBRL,
  getBoxPrice,
  getCartLineTotal,
  getUnitPrice,
} from '@/lib/productPricing';
import { handleOrderExport } from '@/lib/orderExport';
import { formatOrderDisplayId, formatOrderLabel } from '@/lib/orderDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { ImageWithFallback } from '@/app/components/ui/image';

type ViewMode = 'list' | 'detail';
type FilterType = 'all' | 'unread' | 'cliente' | 'representante';

export const Orders: React.FC = () => {
  const { orders, loading, updateOrder, deleteOrder, refetch } = useOrders();

  useEffect(() => {
    void refetch();
  }, [refetch]);
  const { transportadoras } = useTransportadoras();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [showNotaFiscalDialog, setShowNotaFiscalDialog] = useState(false);
  const [notaFiscalNumber, setNotaFiscalNumber] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState<{orderId: string, status: string} | null>(null);
  const [showDeleteOrderDialog, setShowDeleteOrderDialog] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);

  // Filtrar pedidos
  const filteredOrders = orders.filter(order => {
    // Filtro de busca
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clienteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.importadoraName.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro de tipo
    let matchesType = true;
    if (filterType === 'unread') matchesType = !order.isRead;
    else if (filterType === 'cliente') matchesType = order.origin === 'cliente';
    else if (filterType === 'representante') matchesType = order.origin === 'representante';

    // Filtro de status
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Contar pedidos não lidos
  const unreadCount = orders.filter(order => !order.isRead).length;

  const getOrderStatusBadge = (status: string) => {
    const statusConfig = {
      rascunho: { label: 'Rascunho', className: 'bg-gray-500' },
      aberto: { label: 'Em Aberto', className: 'bg-blue-500' },
      faturado: { label: 'Faturado', className: 'bg-green-500' },
      cancelado: { label: 'Cancelado', className: 'bg-red-500' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.rascunho;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getOriginBadge = (origin: string) => {
    if (origin === 'cliente') {
      return <Badge variant="outline" className="border-secondary text-secondary">Enviado por Cliente</Badge>;
    }
    return <Badge variant="outline" className="border-primary text-primary">Criado por Mim</Badge>;
  };

  const handleOpenOrder = (order: Order) => {
    setSelectedOrder(order);
    setViewMode('detail');
    
    if (!order.isRead) {
      updateOrder(order.id, { isRead: true }).then(() => {
        setSelectedOrder(prev => prev ? { ...prev, isRead: true } : null);
        toast.success('Pedido visualizado');
      });
    }
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    if (newStatus === 'faturado') {
      setPendingStatusChange({ orderId, status: newStatus });
      setShowNotaFiscalDialog(true);
    } else {
      updateOrder(orderId, { status: newStatus as OrderStatus }).then(() => {
        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus as OrderStatus });
        }
        toast.success(`Status do pedido alterado para ${newStatus === 'aberto' ? 'Em Aberto' : 'Cancelado'}`);
      });
    }
  };

  const handleConfirmNotaFiscal = () => {
    if (!notaFiscalNumber.trim()) {
      toast.error('Por favor, informe o número da nota fiscal');
      return;
    }

    if (pendingStatusChange && selectedOrder) {
      updateOrder(selectedOrder.id, { status: 'faturado', notaFiscal: notaFiscalNumber }).then(() => {
        setSelectedOrder(prev => prev ? { ...prev, status: 'faturado', notaFiscal: notaFiscalNumber } : null);
        setShowNotaFiscalDialog(false);
        setNotaFiscalNumber('');
        setPendingStatusChange(null);
        toast.success(`Pedido faturado com sucesso! Nota Fiscal: ${notaFiscalNumber}`);
      });
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    setDeletingOrder(true);
    try {
      await deleteOrder(selectedOrder.id);
      toast.success('Pedido excluído com sucesso.');
      setShowDeleteOrderDialog(false);
      setSelectedOrder(null);
      setViewMode('list');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível excluir o pedido.');
    } finally {
      setDeletingOrder(false);
    }
  };

  const handleExportOrder = (order: Order, format: string) => {
    const transportadora = order.transportadoraId
      ? transportadoras.find((t) => t.id === order.transportadoraId) ?? null
      : null;

    handleOrderExport(order, format, {
      transportadora,
      onSuccess: (message) => toast.success(message),
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setImportSuccess(false);
    } else {
      toast.error('Por favor, selecione um arquivo PDF válido');
    }
  };

  const handleImportPDF = async () => {
    if (!selectedFile) {
      toast.error('Selecione um arquivo PDF para importar');
      return;
    }

    setIsProcessing(true);

    // Simular processamento do PDF (2 segundos)
    setTimeout(() => {
      // Em produção, aqui seria feita a chamada ao backend para processar o PDF
      // Por ora, vamos criar um pedido mockado
      
      const newOrderId = `PED${Math.floor(Math.random() * 100000)}`;
      
      toast.success(`Pedido #${newOrderId} importado com sucesso!`, {
        description: '3 produtos foram adicionados ao pedido',
      });

      setIsProcessing(false);
      setImportSuccess(true);

      // Fechar o dialog após 2 segundos
      setTimeout(() => {
        setShowImportDialog(false);
        setSelectedFile(null);
        setImportSuccess(false);
      }, 2000);
    }, 2000);
  };

  const handleCloseImportDialog = () => {
    if (!isProcessing) {
      setShowImportDialog(false);
      setSelectedFile(null);
      setImportSuccess(false);
    }
  };

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden pb-2">
      {viewMode === 'list' && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold sm:text-2xl">Meus Pedidos</h2>
                {unreadCount > 0 && (
                  <Badge className="bg-red-500">
                    {unreadCount} {unreadCount === 1 ? 'novo' : 'novos'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Gerencie todos os seus pedidos em um só lugar
              </p>
            </div>

            <Button
              onClick={() => setShowImportDialog(true)}
              className="w-full shrink-0 bg-secondary hover:bg-secondary/90 sm:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              <span className="sm:hidden">Importar PDF</span>
              <span className="hidden sm:inline">Importar Pedido (PDF)</span>
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por pedido, cliente ou importadora..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
                size="sm"
                className="shrink-0"
              >
                Todos
              </Button>
              <Button
                variant={filterType === 'unread' ? 'default' : 'outline'}
                onClick={() => setFilterType('unread')}
                size="sm"
                className={`shrink-0 ${filterType === 'unread' ? '' : 'border-red-500/30 text-red-500 hover:bg-red-500/10'}`}
              >
                <Bell className="mr-1.5 h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Não lidos ({unreadCount})</span>
              </Button>
              <Button
                variant={filterType === 'cliente' ? 'default' : 'outline'}
                onClick={() => setFilterType('cliente')}
                size="sm"
                className="shrink-0"
              >
                <User className="mr-1.5 h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">Clientes</span>
              </Button>
              <Button
                variant={filterType === 'representante' ? 'default' : 'outline'}
                onClick={() => setFilterType('representante')}
                size="sm"
                className="shrink-0 whitespace-nowrap"
              >
                Meus pedidos
              </Button>
            </div>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus | 'all')}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="aberto">Em Aberto</SelectItem>
                <SelectItem value="faturado">Faturado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orders List */}
          <div className="space-y-3">
            {filteredOrders
              .sort((a, b) => {
                // Não lidos primeiro
                if (!a.isRead && b.isRead) return -1;
                if (a.isRead && !b.isRead) return 1;
                // Depois por data
                return b.createdAt.getTime() - a.createdAt.getTime();
              })
              .map(order => (
              <Card 
                key={order.id} 
                className={`hover:shadow-md transition-shadow cursor-pointer ${!order.isRead ? 'border-2 border-primary/50 bg-primary/5' : ''}`}
                onClick={() => handleOpenOrder(order)}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p
                          className="text-sm font-medium text-foreground"
                          title={order.id}
                        >
                          {formatOrderLabel(order.id)}
                        </p>
                        {!order.isRead && (
                          <Badge className="shrink-0 bg-red-500">
                            <Bell className="mr-1 h-3 w-3" />
                            Novo
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {getOriginBadge(order.origin)}
                        {getOrderStatusBadge(order.status)}
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate text-xs">{order.importadoraName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-xs whitespace-nowrap">
                            {order.createdAt.toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:col-span-1">
                          <Package className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-xs">
                            {order.items.length} {order.items.length === 1 ? 'produto' : 'produtos'}
                          </span>
                        </div>
                      </div>

                      {order.clienteName && (
                        <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/50 px-2.5 py-2">
                          <User className="h-4 w-4 shrink-0 text-secondary" />
                          <span className="truncate text-sm font-medium text-foreground">
                            {order.clienteName}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                      <p className="text-xs text-muted-foreground sm:hidden">Valor total</p>
                      <div className="text-right">
                        <p className="mb-0.5 hidden text-xs text-muted-foreground sm:block">Valor Total</p>
                        <p className="text-xl font-bold text-primary sm:text-2xl">
                          R$ {order.total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum pedido encontrado</p>
            </div>
          )}
        </>
      )}

      {viewMode === 'detail' && selectedOrder && (
        <>
          {/* Header with Back Button */}
          <div className="mb-6 space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            
            <div className="space-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2 pr-2">
                <p
                  className="text-lg font-semibold leading-tight text-foreground"
                  title={selectedOrder.id}
                >
                  {formatOrderLabel(selectedOrder.id)}
                </p>
                {!selectedOrder.isRead && (
                  <Badge className="shrink-0 bg-red-500">
                    <Eye className="mr-1 h-3 w-3" />
                    Acabou de visualizar
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {getOriginBadge(selectedOrder.origin)}
                  {getOrderStatusBadge(selectedOrder.status)}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDeleteOrderDialog(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 border-secondary/40 text-secondary hover:bg-secondary/10"
                      aria-label="Exportar pedido"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[100]">
                    <DropdownMenuItem onClick={() => handleExportOrder(selectedOrder, 'csv')}>
                      <FileText className="mr-2 h-4 w-4" />
                      Exportar CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportOrder(selectedOrder, 'pdf')}>
                      <FileText className="mr-2 h-4 w-4" />
                      Exportar PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                    <p className="text-xl font-bold text-primary">
                      R$ {selectedOrder.total.toFixed(2)}
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
                      {selectedOrder.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Comissão Estimada</p>
                    <p className="text-xl font-bold text-green-500">
                      R$ {(selectedOrder.total * 0.10).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Info */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Informações do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Importadora</p>
                  <p className="text-sm font-medium">{selectedOrder.importadoraName}</p>
                </div>
                {selectedOrder.clienteName && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                    <p className="text-sm font-medium">{selectedOrder.clienteName}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Data de Criação</p>
                  <p className="text-sm">
                    {selectedOrder.createdAt.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Alterar Status do Pedido</p>
                  <Select
                    value={selectedOrder.status}
                    onValueChange={(value) => handleStatusChange(selectedOrder.id, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberto">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          Em Aberto
                        </div>
                      </SelectItem>
                      <SelectItem value="faturado">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          Faturado
                        </div>
                      </SelectItem>
                      <SelectItem value="cancelado">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          Cancelado
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Prazo de Pagamento */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Prazo de Pagamento</p>
                  <Input
                    placeholder="Ex: 30 dias, 60 dias, À vista..."
                    value={selectedOrder.paymentTerm || ''}
                    onChange={(e) => {
                      // Em produção, aqui atualizaria o pedido no backend
                      setSelectedOrder({ ...selectedOrder, paymentTerm: e.target.value });
                      toast.success('Prazo de pagamento atualizado');
                    }}
                  />
                </div>

                {/* Transportadora */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Transportadora</p>
                  <Select
                    value={selectedOrder.transportadoraId || 'none'}
                    onValueChange={(value) => {
                      if (!selectedOrder) return;
                      const transportadoraId = value === 'none' ? undefined : value;
                      updateOrder(selectedOrder.id, { transportadoraId }).then(() => {
                        setSelectedOrder({ ...selectedOrder, transportadoraId });
                        if (value === 'none') toast.success('Transportadora removida');
                        else {
                          const t = transportadoras.find(x => x.id === value);
                          toast.success(`Transportadora ${t?.name} selecionada`);
                        }
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a transportadora">
                        {selectedOrder.transportadoraId ? (
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            {transportadoras.find(t => t.id === selectedOrder.transportadoraId)?.name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Nenhuma selecionada</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">Nenhuma selecionada</span>
                      </SelectItem>
                      {transportadoras.map((transportadora) => (
                        <SelectItem key={transportadora.id} value={transportadora.id}>
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            <div>
                              <p className="font-medium">{transportadora.name}</p>
                              <p className="text-xs text-muted-foreground">{transportadora.city} - {transportadora.state}</p>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Nota Fiscal - Mostrar se pedido estiver faturado */}
                {selectedOrder.status === 'faturado' && selectedOrder.notaFiscal && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nota Fiscal</p>
                    <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <FileText className="w-4 h-4 text-green-500" />
                      <p className="text-sm font-medium text-green-600">{selectedOrder.notaFiscal}</p>
                    </div>
                  </div>
                )}

                {selectedOrder.notes && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produtos do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Cabeçalho da Importadora */}
                <div className="flex items-center gap-2 pb-2 border-b-2 border-primary/20">
                  <Building className="w-5 h-5 text-primary" />
                  <h4 className="text-lg font-semibold text-primary">{selectedOrder.importadoraName}</h4>
                </div>

                {/* Lista de Produtos */}
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted sm:h-16 sm:w-16">
                          {item.product.image ? (
                            <ImageWithFallback
                              src={item.product.image}
                              alt={item.product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-7 w-7 text-muted-foreground sm:h-8 sm:w-8" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 line-clamp-2 font-medium leading-snug">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">Código: {item.product.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                        <div className="text-sm text-muted-foreground">
                          <p>
                            R$ {formatPriceBRL(getUnitPrice(item.product))}/un · R${' '}
                            {formatPriceBRL(getBoxPrice(item.product))}/cx
                          </p>
                          <p>{item.quantity} cx</p>
                        </div>
                        <p className="text-lg font-bold text-primary sm:text-base">
                          R$ {formatPriceBRL(getCartLineTotal(item))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total do Pedido */}
                <div className="pt-4 border-t-2 border-primary/30">
                  <div className="flex items-center justify-between text-lg font-bold">
                    <span>Total do Pedido</span>
                    <span className="text-primary">R$ {selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Import PDF Dialog */}
      <Dialog open={showImportDialog} onOpenChange={handleCloseImportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Importar Pedido via PDF</DialogTitle>
            <DialogDescription>
              Envie um PDF de pedido para importar automaticamente os produtos e dados
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!importSuccess ? (
              <>
                {/* Upload Area */}
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 rounded-full bg-primary/10">
                        <FileText className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium mb-1">
                          Clique para selecionar um PDF
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Ou arraste e solte aqui
                        </p>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Selected File */}
                {selectedFile && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FileText className="w-5 h-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    {!isProcessing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={handleCloseImportDialog}
                    disabled={isProcessing}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImportPDF}
                    disabled={!selectedFile || isProcessing}
                    className="bg-primary"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Importar Pedido
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-green-500/10">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">Pedido Importado!</h3>
                <p className="text-sm text-muted-foreground">
                  O pedido foi processado e adicionado à sua lista
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Nota Fiscal Dialog */}
      <Dialog open={showNotaFiscalDialog} onOpenChange={() => setShowNotaFiscalDialog(false)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Confirmar Faturamento</DialogTitle>
            <DialogDescription>
              Informe o número da nota fiscal para confirmar o faturamento do pedido
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Input
              placeholder="Número da Nota Fiscal"
              value={notaFiscalNumber}
              onChange={(e) => setNotaFiscalNumber(e.target.value)}
              className="w-full"
            />

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowNotaFiscalDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmNotaFiscal}
                className="bg-primary"
              >
                Confirmar Faturamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteOrderDialog} onOpenChange={setShowDeleteOrderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir pedido</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir o pedido{' '}
              <span className="font-semibold text-foreground" title={selectedOrder?.id}>
                #{formatOrderDisplayId(selectedOrder?.id ?? '')}
              </span>
              ?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteOrderDialog(false)} disabled={deletingOrder}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteOrder} disabled={deletingOrder}>
              {deletingOrder ? 'Excluindo...' : 'Sim, excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};