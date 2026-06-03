import React, { useState, useEffect } from 'react';
import { Users, Plus, Phone, Mail, Building, Search, Edit, ShoppingBag, Calendar, DollarSign, FileText, X, ArrowLeft, Package, TrendingUp, RefreshCw, Download, MapPin, Truck, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { Badge } from '@/app/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { ImageWithFallback } from '@/app/components/ui/image';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useCatalogClients } from '@/contexts/CatalogClientsContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useClientes, useImportadoras, useCommissions, useTransportadoras } from '@/hooks/useData';
import { createCliente, deleteCliente } from '@/services/clientes';
import { toast } from 'sonner';
import { Cliente, Order, OrderStatus } from '@/types';
import {
  formatPriceBRL,
  getBoxPrice,
  getCartLineTotal,
  getUnitPrice,
} from '@/lib/productPricing';
import { formatOrderDisplayId, formatOrderLabel } from '@/lib/orderDisplay';
import { handleOrderExport } from '@/lib/orderExport';

type ViewMode = 'list' | 'client-detail' | 'order-detail';

export const Clients: React.FC = () => {
  const { user } = useAuth();
  const { catalogClients } = useCatalogClients();
  const { orders, refetch: refetchOrders, deleteOrder } = useOrders();
  const { clientes, refetch: refetchClientes } = useClientes();
  const { importadoras } = useImportadoras();
  const { commissions } = useCommissions();
  const { transportadoras } = useTransportadoras();
  const allClients = [...clientes, ...catalogClients.filter(c => !clientes.some(x => x.id === c.id))];

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [isEditingClientInfo, setIsEditingClientInfo] = useState(false);
  const [showNotaFiscalDialog, setShowNotaFiscalDialog] = useState(false);
  const [notaFiscalNumber, setNotaFiscalNumber] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState<{orderId: string, status: string} | null>(null);
  const [showDeleteClientDialog, setShowDeleteClientDialog] = useState(false);
  const [showDeleteOrderDialog, setShowDeleteOrderDialog] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: '',
    businessName: '',
    cnpj: '',
    stateRegistration: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    void refetchOrders();
  }, [refetchOrders]);

  const formatCNPJ = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 14) {
      return cleaned
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return value;
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4,5})(\d{4})$/, '$1-$2');
    }
    return value;
  };

  const formatCEP = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 8) {
      return cleaned.replace(/^(\d{5})(\d)/, '$1-$2');
    }
    return value;
  };

  const getFullAddress = (cliente: Cliente) => {
    const parts = [
      cliente.street,
      cliente.number,
      cliente.complement,
      cliente.neighborhood,
      cliente.city,
      cliente.state,
      cliente.cep ? `CEP: ${cliente.cep}` : ''
    ];
    return parts.filter(Boolean).join(', ');
  };

  const filteredClients = allClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm)
  );

  const getClientOrders = (clientId: string) => {
    return orders.filter(order => order.clienteId === clientId);
  };

  const getClientTotal = (clientId: string) => {
    return orders
      .filter(order => order.clienteId === clientId && order.status === 'faturado')
      .reduce((sum, order) => sum + order.total, 0);
  };

  const handleAddClient = async () => {
    if (!newClient.name || !newClient.phone) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    const cnpjDigits = newClient.cnpj.replace(/\D/g, '');
    if (cnpjDigits.length !== 14) {
      toast.error('Informe um CNPJ válido com 14 dígitos.');
      return;
    }
    if (!user?.id) {
      toast.error('Sessão inválida. Faça login novamente.');
      return;
    }
    try {
      await createCliente({
        representanteId: user.id,
        name: newClient.name.trim(),
        phone: newClient.phone.trim(),
        email: newClient.email.trim() || undefined,
        businessName: newClient.businessName.trim() || undefined,
        cnpj: cnpjDigits,
        stateRegistration: newClient.stateRegistration.trim() || undefined,
        cep: newClient.cep.replace(/\D/g, '') || undefined,
        street: newClient.street.trim() || undefined,
        number: newClient.number.trim() || undefined,
        complement: newClient.complement.trim() || undefined,
        neighborhood: newClient.neighborhood.trim() || undefined,
        city: newClient.city.trim() || undefined,
        state: newClient.state.trim() || undefined,
      });
      await refetchClientes();
      toast.success('Cliente adicionado com sucesso!');
      setShowAddDialog(false);
      setNewClient({
        name: '',
        phone: '',
        email: '',
        businessName: '',
        cnpj: '',
        stateRegistration: '',
        cep: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
      });
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o cliente. Verifique os dados e tente novamente.');
    }
  };

  const handleOpenClient = (client: Cliente) => {
    setSelectedClient(client);
    setEditingClient({ ...client });
    setViewMode('client-detail');
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;
    setDeletingClient(true);
    try {
      await deleteCliente(selectedClient.id);
      await refetchClientes();
      await refetchOrders();
      toast.success('Cliente excluído com sucesso. Os pedidos foram mantidos.');
      setShowDeleteClientDialog(false);
      setSelectedClient(null);
      setEditingClient(null);
      setViewMode('list');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível excluir o cliente.');
    } finally {
      setDeletingClient(false);
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
      setViewMode('client-detail');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível excluir o pedido.');
    } finally {
      setDeletingOrder(false);
    }
  };

  const handleSaveClient = () => {
    if (!editingClient?.name || !editingClient?.phone) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    const editCnpjDigits = (editingClient.cnpj ?? '').replace(/\D/g, '');
    if (editCnpjDigits.length !== 14) {
      toast.error('Informe um CNPJ válido com 14 dígitos.');
      return;
    }

    toast.success('Cliente atualizado com sucesso!');
    setSelectedClient(null);
    setEditingClient(null);
    setViewMode('list');
  };

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

  const handleStatusChange = (orderId: string, newStatus: string) => {
    if (newStatus === 'faturado') {
      // Abrir dialog para pedir nota fiscal
      setPendingStatusChange({ orderId, status: newStatus });
      setShowNotaFiscalDialog(true);
    } else {
      toast.success(`Status do pedido alterado para ${newStatus === 'aberto' ? 'Em Aberto' : 'Cancelado'}`);
      // Em produção, aqui faria a atualização no backend
    }
  };

  const handleConfirmNotaFiscal = () => {
    if (!notaFiscalNumber.trim()) {
      toast.error('Por favor, informe o número da nota fiscal');
      return;
    }

    if (pendingStatusChange && selectedOrder) {
      // Atualizar pedido com status faturado e nota fiscal
      setSelectedOrder({ ...selectedOrder, status: 'faturado', notaFiscal: notaFiscalNumber });
      toast.success(`Pedido faturado com sucesso! Nota Fiscal: ${notaFiscalNumber}`);
      
      // Limpar estados
      setShowNotaFiscalDialog(false);
      setNotaFiscalNumber('');
      setPendingStatusChange(null);
    }
  };

  const handleExportOrder = (order: Order, format: string) => {
    const transportadora = order.transportadoraId
      ? transportadoras.find((t) => t.id === order.transportadoraId) ?? null
      : null;

    handleOrderExport(order, format, {
      client: selectedClient
        ? {
            name: selectedClient.name,
            address: selectedClient.address,
            cnpj: selectedClient.cnpj,
            phone: selectedClient.phone,
            email: selectedClient.email,
          }
        : undefined,
      transportadora,
      onSuccess: (message) => toast.success(message),
    });
  };

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden pb-2">
      {viewMode === 'list' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="mb-1">Meus Clientes</h2>
              <p className="text-sm text-muted-foreground">
                Gerencie sua carteira de clientes
              </p>
            </div>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-secondary hover:bg-secondary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Client List */}
          <div className="space-y-3">
            {filteredClients.map(client => {
              const orders = getClientOrders(client.id);
              const total = getClientTotal(client.id);

              return (
                <Card 
                  key={client.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleOpenClient(client)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="mb-1">{client.name}</h4>
                        {client.businessName && (
                          <p className="text-xs text-muted-foreground mb-2">{client.businessName}</p>
                        )}
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span className="text-xs">{client.phone}</span>
                          </div>
                          {client.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              <span className="text-xs">{client.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{orders.length} pedidos</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Comprado</p>
                        <p className="font-medium" style={{ color: '#10B981' }}>
                          R$ {total.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cliente desde</p>
                        <p className="text-sm">
                          {client.createdAt.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredClients.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum cliente encontrado</p>
            </div>
          )}
        </>
      )}

      {viewMode === 'client-detail' && selectedClient && editingClient && (
        <>
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-8 px-2"
              onClick={() => setViewMode('list')}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>

            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold leading-tight sm:text-2xl">{selectedClient.name}</h2>
                {selectedClient.businessName && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{selectedClient.businessName}</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteClientDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir cliente
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <p className="mb-1 text-[10px] text-muted-foreground sm:text-xs">Total Comprado</p>
                  <p className="text-sm font-bold text-emerald-600 sm:text-lg">
                    R$ {getClientTotal(selectedClient.id).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <p className="mb-1 text-[10px] text-muted-foreground sm:text-xs">Pedidos</p>
                  <p className="text-sm font-bold sm:text-2xl">
                    {getClientOrders(selectedClient.id).length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <p className="mb-1 text-[10px] text-muted-foreground sm:text-xs">Cliente desde</p>
                  <p className="text-xs font-medium sm:text-sm">
                    {selectedClient.createdAt.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Informações do Cliente</CardTitle>
                {!isEditingClientInfo && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 sm:hidden"
                      onClick={() => setIsEditingClientInfo(true)}
                      aria-label="Editar cliente"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="hidden shrink-0 sm:inline-flex"
                      onClick={() => setIsEditingClientInfo(true)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!isEditingClientInfo ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Nome</p>
                        <p className="text-sm font-medium">{selectedClient.name}</p>
                      </div>
                      {selectedClient.businessName && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Nome Fantasia / Razão Social</p>
                          <p className="text-sm font-medium">{selectedClient.businessName}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {selectedClient.cnpj && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">CNPJ</p>
                          <p className="text-sm font-medium">{selectedClient.cnpj}</p>
                        </div>
                      )}
                      {selectedClient.stateRegistration && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Inscrição Estadual</p>
                          <p className="text-sm font-medium">{selectedClient.stateRegistration}</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Telefone</p>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-medium">{selectedClient.phone}</p>
                        </div>
                      </div>
                      {selectedClient.email && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Email</p>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <p className="text-sm font-medium">{selectedClient.email}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {(selectedClient.street || selectedClient.cep) && (
                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Endereço</p>
                        </div>
                        <div className="space-y-2">
                          {selectedClient.street && (
                            <p className="text-sm">
                              {selectedClient.street}
                              {selectedClient.number && `, ${selectedClient.number}`}
                              {selectedClient.complement && ` - ${selectedClient.complement}`}
                            </p>
                          )}
                          {selectedClient.neighborhood && (
                            <p className="text-sm">{selectedClient.neighborhood}</p>
                          )}
                          {(selectedClient.city || selectedClient.state) && (
                            <p className="text-sm">
                              {selectedClient.city}
                              {selectedClient.city && selectedClient.state && ' - '}
                              {selectedClient.state}
                            </p>
                          )}
                          {selectedClient.cep && (
                            <p className="text-sm text-muted-foreground">CEP: {selectedClient.cep}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Nome *</label>
                      <Input
                        value={editingClient.name}
                        onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                        placeholder="Nome do cliente"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Nome Fantasia / Razão Social</label>
                      <Input
                        value={editingClient.businessName || ''}
                        onChange={(e) => setEditingClient({ ...editingClient, businessName: e.target.value })}
                        placeholder="Nome comercial ou razão social"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">CNPJ *</label>
                        <Input
                          value={editingClient.cnpj || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, cnpj: formatCNPJ(e.target.value) })}
                          placeholder="00.000.000/0000-00"
                          maxLength={18}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Inscrição Estadual</label>
                        <Input
                          value={editingClient.stateRegistration || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, stateRegistration: e.target.value })}
                          placeholder="000.000.000.000"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Telefone *</label>
                        <Input
                          value={editingClient.phone}
                          onChange={(e) => setEditingClient({ ...editingClient, phone: formatPhone(e.target.value) })}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm text-muted-foreground">Email</label>
                        <Input
                          type="email"
                          value={editingClient.email || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                          placeholder="email@cliente.com"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <label className="mb-3 block text-sm text-muted-foreground">Endereço</label>

                      <div className="space-y-3">
                        <Input
                          placeholder="CEP"
                          value={editingClient.cep || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, cep: formatCEP(e.target.value) })}
                          maxLength={9}
                        />

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                          <div className="sm:col-span-3">
                            <Input
                              placeholder="Rua/Avenida"
                              value={editingClient.street || ''}
                              onChange={(e) => setEditingClient({ ...editingClient, street: e.target.value })}
                            />
                          </div>
                          <div>
                            <Input
                              placeholder="Número"
                              value={editingClient.number || ''}
                              onChange={(e) => setEditingClient({ ...editingClient, number: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Input
                            placeholder="Complemento"
                            value={editingClient.complement || ''}
                            onChange={(e) => setEditingClient({ ...editingClient, complement: e.target.value })}
                          />
                          <Input
                            placeholder="Bairro"
                            value={editingClient.neighborhood || ''}
                            onChange={(e) => setEditingClient({ ...editingClient, neighborhood: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-2">
                            <Input
                              placeholder="Cidade"
                              value={editingClient.city || ''}
                              onChange={(e) => setEditingClient({ ...editingClient, city: e.target.value })}
                            />
                          </div>
                          <Input
                            placeholder="Estado (UF)"
                            value={editingClient.state || ''}
                            onChange={(e) => setEditingClient({ ...editingClient, state: e.target.value.toUpperCase() })}
                            maxLength={2}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setEditingClient({ ...selectedClient });
                          setIsEditingClientInfo(false);
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        className="w-full bg-secondary hover:bg-secondary/90 sm:w-auto"
                        disabled={
                          !editingClient?.name?.trim() ||
                          !editingClient?.phone?.trim() ||
                          (editingClient.cnpj ?? '').replace(/\D/g, '').length !== 14
                        }
                        onClick={() => {
                          if (!editingClient?.name || !editingClient?.phone) {
                            toast.error('Preencha os campos obrigatórios');
                            return;
                          }
                          const digits = (editingClient.cnpj ?? '').replace(/\D/g, '');
                          if (digits.length !== 14) {
                            toast.error('Informe um CNPJ válido com 14 dígitos.');
                            return;
                          }
                          toast.success('Cliente atualizado com sucesso!');
                          setSelectedClient({ ...editingClient });
                          setIsEditingClientInfo(false);
                        }}
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-5 w-5" />
                Pedidos do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getClientOrders(selectedClient.id).length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhum pedido encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getClientOrders(selectedClient.id)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .map((order) => (
                      <div
                        key={order.id}
                        className="flex cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                        onClick={() => {
                          setSelectedOrder(order);
                          setViewMode('order-detail');
                        }}
                      >
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium" title={order.id}>
                              {formatOrderLabel(order.id)}
                            </p>
                            <div className="shrink-0 sm:hidden">{getOrderStatusBadge(order.status)}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                            <div className="flex min-w-0 items-center gap-1">
                              <Building className="h-3 w-3 shrink-0" />
                              <span className="truncate">{order.importadoraName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              {order.createdAt.toLocaleDateString('pt-BR')}
                            </div>
                            <div className="col-span-2 flex items-center gap-1">
                              <Package className="h-3 w-3 shrink-0" />
                              {order.items.length} {order.items.length === 1 ? 'produto' : 'produtos'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                          <div>
                            <p className="text-xs text-muted-foreground">Valor Total</p>
                            <p className="text-lg font-bold text-primary">
                              R$ {order.total.toFixed(2)}
                            </p>
                          </div>
                          <div className="hidden sm:block">{getOrderStatusBadge(order.status)}</div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {viewMode === 'order-detail' && selectedOrder && selectedClient && (
        <>
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-8 px-2"
              onClick={() => setViewMode('client-detail')}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar para Cliente
            </Button>

            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p
                    className="text-lg font-semibold leading-tight text-foreground"
                    title={selectedOrder.id}
                  >
                    {formatOrderLabel(selectedOrder.id)}
                  </p>
                  {getOrderStatusBadge(selectedOrder.status)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Cliente: {selectedClient.name}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteOrderDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir pedido
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <DollarSign className="h-5 w-5 text-primary" />
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
                  <div className="rounded-lg bg-secondary/10 p-2">
                    <Package className="h-5 w-5 text-secondary" />
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
                  <div className="rounded-lg bg-green-500/10 p-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      // Em produção, aqui atualizaria o pedido no backend
                      if (value === 'none') {
                        setSelectedOrder({ ...selectedOrder, transportadoraId: undefined });
                        toast.success('Transportadora removida');
                      } else {
                        setSelectedOrder({ ...selectedOrder, transportadoraId: value });
                        const transportadora = transportadoras.find(t => t.id === value);
                        toast.success(`Transportadora ${transportadora?.name} selecionada`);
                      }
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

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Produtos do Pedido</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 border-secondary/40 text-secondary hover:bg-secondary/10 sm:hidden"
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
                <Select onValueChange={(value) => handleExportOrder(selectedOrder, value)}>
                  <SelectTrigger className="hidden h-9 w-[200px] border-secondary/40 bg-secondary text-white hover:bg-secondary/90 sm:flex [&>span]:text-white">
                    <SelectValue placeholder="Exportar Pedido">
                      <div className="flex items-center gap-2 text-white">
                        <Download className="h-4 w-4" />
                        <span>Exportar Pedido</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Exportar para CSV</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Exportar para PDF</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b-2 border-primary/20 pb-2">
                  <Building className="h-5 w-5 text-primary" />
                  <h4 className="text-lg font-semibold text-primary">{selectedOrder.importadoraName}</h4>
                </div>

                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                          {item.product.image ? (
                            <ImageWithFallback
                              src={item.product.image}
                              alt={item.product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 font-medium">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Código: {item.product.code}
                          </p>
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
                        <p className="font-bold text-primary">
                          R$ {formatPriceBRL(getCartLineTotal(item))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t-2 border-primary/30 pt-4">
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

      {/* Add Client Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>Adicione um novo cliente à sua carteira.</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input
                  placeholder="Nome do cliente"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nome Fantasia / Razão Social</label>
                <Input
                  placeholder="Nome comercial ou razão social"
                  value={newClient.businessName}
                  onChange={(e) => setNewClient({ ...newClient, businessName: e.target.value })}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">CNPJ *</label>
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={newClient.cnpj}
                    onChange={(e) => setNewClient({ ...newClient, cnpj: formatCNPJ(e.target.value) })}
                    maxLength={18}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Inscrição Estadual</label>
                  <Input
                    placeholder="000.000.000.000"
                    value={newClient.stateRegistration}
                    onChange={(e) => setNewClient({ ...newClient, stateRegistration: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Telefone *</label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: formatPhone(e.target.value) })}
                    maxLength={15}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="email@cliente.com"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <label className="text-sm font-medium mb-3 block">Endereço</label>
                
                <div className="space-y-3">
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <Input
                        placeholder="CEP"
                        value={newClient.cep}
                        onChange={(e) => setNewClient({ ...newClient, cep: formatCEP(e.target.value) })}
                        maxLength={9}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-3">
                    <div className="md:col-span-3">
                      <Input
                        placeholder="Rua/Avenida"
                        value={newClient.street}
                        onChange={(e) => setNewClient({ ...newClient, street: e.target.value })}
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Número"
                        value={newClient.number}
                        onChange={(e) => setNewClient({ ...newClient, number: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Input
                        placeholder="Complemento"
                        value={newClient.complement}
                        onChange={(e) => setNewClient({ ...newClient, complement: e.target.value })}
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Bairro"
                        value={newClient.neighborhood}
                        onChange={(e) => setNewClient({ ...newClient, neighborhood: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <Input
                        placeholder="Cidade"
                        value={newClient.city}
                        onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Estado (UF)"
                        value={newClient.state}
                        onChange={(e) => setNewClient({ ...newClient, state: e.target.value.toUpperCase() })}
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleAddClient}
              className="flex-1 bg-secondary hover:bg-secondary/90"
              disabled={
                !newClient.name.trim() ||
                !newClient.phone.trim() ||
                newClient.cnpj.replace(/\D/g, '').length !== 14
              }
            >
              Adicionar Cliente
            </Button>
            <Button
              onClick={() => setShowAddDialog(false)}
              variant="outline"
            >
              Cancelar
            </Button>
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

      <Dialog open={showDeleteClientDialog} onOpenChange={setShowDeleteClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cliente</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir o cliente{' '}
              <span className="font-semibold text-foreground">{selectedClient?.name}</span>?
              Os pedidos deste cliente serão mantidos na aba Pedidos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteClientDialog(false)} disabled={deletingClient}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteClient} disabled={deletingClient}>
              {deletingClient ? 'Excluindo...' : 'Sim, excluir'}
            </Button>
          </DialogFooter>
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