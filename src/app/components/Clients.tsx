import React, { useState } from 'react';
import { Users, Plus, Phone, Mail, Building, Search, Edit, ShoppingBag, Calendar, DollarSign, FileText, X, ArrowLeft, Package, TrendingUp, RefreshCw, Download, MapPin, Truck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { Badge } from '@/app/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { useCatalogClients } from '@/contexts/CatalogClientsContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useClientes, useImportadoras, useCommissions, useTransportadoras } from '@/hooks/useData';
import { toast } from 'sonner';
import { Cliente, Order, OrderStatus } from '@/types';

type ViewMode = 'list' | 'client-detail' | 'order-detail';

export const Clients: React.FC = () => {
  const { catalogClients } = useCatalogClients();
  const { orders } = useOrders();
  const { clientes } = useClientes();
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

  const handleAddClient = () => {
    if (!newClient.name || !newClient.phone) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    
    toast.success('Cliente adicionado com sucesso!');
    setShowAddDialog(false);
    setNewClient({ name: '', phone: '', email: '', businessName: '', cnpj: '', stateRegistration: '', cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' });
  };

  const handleOpenClient = (client: Cliente) => {
    setSelectedClient(client);
    setEditingClient({ ...client });
    setViewMode('client-detail');
  };

  const handleSaveClient = () => {
    if (!editingClient?.name || !editingClient?.phone) {
      toast.error('Preencha os campos obrigatórios');
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

  const exportOrderToCSV = (order: Order) => {
    // Criar CSV no formato do pedido profissional
    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString('pt-BR');
    const horaFormatada = hoje.toLocaleTimeString('pt-BR');
    
    let csvContent = '';
    
    // Cabeçalho
    csvContent += `${order.importadoraName}\n`;
    csvContent += `Data: ${dataFormatada},,,,,,,Pedido Nro. ${order.id}\n`;
    csvContent += `Hora: ${horaFormatada},,,,,,,Nota Nro.: ${order.notaFiscal || ''}\n`;
    csvContent += `\n`;
    
    // Informações do Cliente
    csvContent += `Cliente:,${selectedClient?.name || order.clienteName},,,,Data Emissão:,${order.createdAt.toLocaleDateString('pt-BR')}\n`;
    csvContent += `Endereço:,${selectedClient?.address || ''},,,,Data Saída:,${order.updatedAt?.toLocaleDateString('pt-BR') || ''}\n`;
    csvContent += `Bairro:,${selectedClient?.cnpj || ''},,,,UF:,CEP:,\n`;
    csvContent += `CNPJ/CPF:,${selectedClient?.cnpj || ''},,Inscr. Est.:,\n`;
    csvContent += `Fone:,${selectedClient?.phone || ''},,Forma Pagto.:,\n`;
    csvContent += `Contato:,${selectedClient?.email || ''},,Fax.:,\n`;
    csvContent += `E-Mail:,${selectedClient?.email || ''}\n`;
    csvContent += `\n`;
    
    // Cabeçalho da tabela de produtos
    csvContent += `Referência,Foto,NCM,Cod. Barra,Descrição,Cxs,Vlr/Uni,Vlr Total,ST,IPI%,IPI\n`;
    
    // Produtos
    let totalCaixas = 0;
    let totalIPI = 0;
    
    order.items.forEach((item) => {
      const vlrUnitario = item.product.price.toFixed(2);
      const vlrTotal = (item.quantity * item.product.price).toFixed(2);
      const ipiPercentual = '6,50';
      const ipiValor = (item.quantity * item.product.price * 0.065).toFixed(2);
      
      totalCaixas += item.quantity;
      totalIPI += parseFloat(ipiValor);
      
      csvContent += `${item.product.code},,,,${item.product.name},${item.quantity},${vlrUnitario},${vlrTotal},0.00,${ipiPercentual},${ipiValor}\n`;
    });
    
    csvContent += `\n`;
    
    // Totais
    csvContent += `,,,,,VL Total:,${order.total.toFixed(2)}\n`;
    csvContent += `,,,,,Total ST:,0.00\n`;
    csvContent += `,,,,,Total IPI:,${totalIPI.toFixed(2)}\n`;
    csvContent += `\n`;
    
    // Informações finais
    csvContent += `Total de Caixas:,${totalCaixas}\n`;
    csvContent += `Total de Cubagem:,\n`;
    csvContent += `Vendedor:,${order.representanteName}\n`;
    csvContent += `Vendedor Ext.:,\n`;
    csvContent += `Frete:,\n`;
    csvContent += `Transportadora:,\n`;
    csvContent += `Fone:,\n`;
    csvContent += `Total Peso Líquido:,\n`;
    csvContent += `Total Peso Bruto:,\n`;
    csvContent += `Observação:,${order.notes || ''}\n`;

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pedido_${order.id}_${order.importadoraName.replace(/\s+/g, '_')}_${dataFormatada.replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Pedido exportado para CSV com sucesso!');
  };

  const exportOrderToPDF = (order: Order) => {
    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString('pt-BR');
    const horaFormatada = hoje.toLocaleTimeString('pt-BR');
    
    let totalCaixas = 0;
    let totalIPI = 0;
    
    order.items.forEach((item) => {
      totalCaixas += item.quantity;
      totalIPI += (item.quantity * item.product.price * 0.065);
    });

    const transportadora = order.transportadoraId ? transportadoras.find(t => t.id === order.transportadoraId) : null;

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido ${order.id}</title><style>@page{margin:20mm;}body{font-family:Arial,sans-serif;font-size:11px;color:#000;}.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #5B3DF5;padding-bottom:10px;}.header h1{color:#5B3DF5;margin:0;font-size:20px;}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;padding:15px;background:#f5f5f5;border-radius:5px;}.info-item{margin-bottom:8px;}.info-label{font-weight:bold;color:#555;}table{width:100%;border-collapse:collapse;margin-bottom:20px;}th{background:#5B3DF5;color:white;padding:10px 8px;text-align:left;font-size:10px;}td{border:1px solid #ddd;padding:8px;font-size:10px;}tr:nth-child(even){background:#f9f9f9;}.totals{margin-top:20px;padding:15px;background:#f5f5f5;border-radius:5px;}.total-row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;}.total-row.main{font-size:16px;font-weight:bold;color:#5B3DF5;padding-top:10px;border-top:2px solid #5B3DF5;}.footer{margin-top:30px;padding-top:15px;border-top:1px solid #ddd;font-size:10px;color:#666;}</style></head><body><div class="header"><h1>${order.importadoraName}</h1><p>Pedido Nº ${order.id} | Data: ${dataFormatada} ${horaFormatada}</p></div><div class="info-grid"><div><div class="info-item"><span class="info-label">Cliente:</span> ${selectedClient?.name || order.clienteName || 'Não informado'}</div><div class="info-item"><span class="info-label">Representante:</span> ${order.representanteName}</div><div class="info-item"><span class="info-label">Data de Criação:</span> ${order.createdAt.toLocaleDateString('pt-BR')}</div><div class="info-item"><span class="info-label">Status:</span> ${order.status === 'faturado' ? 'Faturado' : order.status === 'aberto' ? 'Em Aberto' : 'Cancelado'}</div></div><div><div class="info-item"><span class="info-label">Prazo de Pagamento:</span> ${order.paymentTerm || 'Não informado'}</div><div class="info-item"><span class="info-label">Transportadora:</span> ${transportadora?.name || 'Não informada'}</div>${transportadora ? `<div class="info-item"><span class="info-label">Telefone Transportadora:</span> ${transportadora.phone}</div><div class="info-item"><span class="info-label">Local:</span> ${transportadora.city} - ${transportadora.state}</div>` : ''}</div></div><table><thead><tr><th>Código</th><th>Descrição</th><th style="text-align:center;">Cxs</th><th style="text-align:right;">Vlr/Uni</th><th style="text-align:right;">Vlr Total</th><th style="text-align:center;">IPI %</th><th style="text-align:right;">IPI</th></tr></thead><tbody>${order.items.map(item => {const vlrUnitario = item.product.price.toFixed(2);const vlrTotal = (item.quantity * item.product.price).toFixed(2);const ipiValor = (item.quantity * item.product.price * 0.065).toFixed(2);return `<tr><td>${item.product.code}</td><td>${item.product.name}</td><td style="text-align:center;">${item.quantity}</td><td style="text-align:right;">R$ ${vlrUnitario}</td><td style="text-align:right;">R$ ${vlrTotal}</td><td style="text-align:center;">6,50%</td><td style="text-align:right;">R$ ${ipiValor}</td></tr>`;}).join('')}</tbody></table><div class="totals"><div class="total-row"><span>Total de Caixas:</span><span>${totalCaixas}</span></div><div class="total-row"><span>Subtotal:</span><span>R$ ${order.total.toFixed(2)}</span></div><div class="total-row"><span>Total IPI:</span><span>R$ ${totalIPI.toFixed(2)}</span></div><div class="total-row main"><span>TOTAL DO PEDIDO:</span><span>R$ ${order.total.toFixed(2)}</span></div></div>${order.notes ? `<div class="footer"><div class="info-label">Observações:</div><p>${order.notes}</p></div>` : ''}<div class="footer" style="margin-top:40px;text-align:center;"><p>Documento gerado em ${dataFormatada} às ${horaFormatada}</p></div></body></html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pedido_${order.id}_${order.importadoraName.replace(/\s+/g, '_')}_${dataFormatada.replace(/\//g, '-')}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }

    toast.success('Pedido exportado para PDF com sucesso!');
  };

  const handleExportOrder = (order: Order, format: string) => {
    if (format === 'csv') {
      exportOrderToCSV(order);
    } else if (format === 'pdf') {
      exportOrderToPDF(order);
    }
  };

  return (
    <div className="space-y-4">
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
              <h2>{selectedClient.name}</h2>
              {selectedClient.businessName && (
                <p className="text-sm text-muted-foreground">{selectedClient.businessName}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Client Info Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Informações do Cliente</CardTitle>
                  {!isEditingClientInfo ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingClientInfo(true)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingClient({ ...selectedClient });
                          setIsEditingClientInfo(false);
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-secondary hover:bg-secondary/90"
                        onClick={() => {
                          if (!editingClient?.name || !editingClient?.phone) {
                            toast.error('Preencha os campos obrigatórios');
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
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!isEditingClientInfo ? (
                  // Modo Visualização
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
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

                    <div className="grid md:grid-cols-2 gap-4">
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

                    <div className="grid md:grid-cols-2 gap-4">
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
                  // Modo Edição
                  <ScrollArea className="max-h-[500px] pr-4">
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

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm text-muted-foreground">CNPJ</label>
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

                      <div className="grid md:grid-cols-2 gap-4">
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

                      <div className="pt-4 border-t">
                        <label className="text-sm text-muted-foreground mb-3 block">Endereço</label>
                        
                        <div className="space-y-3">
                          <div className="grid md:grid-cols-3 gap-3">
                            <div className="md:col-span-2">
                              <Input
                                placeholder="CEP"
                                value={editingClient.cep || ''}
                                onChange={(e) => setEditingClient({ ...editingClient, cep: formatCEP(e.target.value) })}
                                maxLength={9}
                              />
                            </div>
                          </div>

                          <div className="grid md:grid-cols-4 gap-3">
                            <div className="md:col-span-3">
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

                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <Input
                                placeholder="Complemento"
                                value={editingClient.complement || ''}
                                onChange={(e) => setEditingClient({ ...editingClient, complement: e.target.value })}
                              />
                            </div>
                            <div>
                              <Input
                                placeholder="Bairro"
                                value={editingClient.neighborhood || ''}
                                onChange={(e) => setEditingClient({ ...editingClient, neighborhood: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="grid md:grid-cols-3 gap-3">
                            <div className="md:col-span-2">
                              <Input
                                placeholder="Cidade"
                                value={editingClient.city || ''}
                                onChange={(e) => setEditingClient({ ...editingClient, city: e.target.value })}
                              />
                            </div>
                            <div>
                              <Input
                                placeholder="Estado (UF)"
                                value={editingClient.state || ''}
                                onChange={(e) => setEditingClient({ ...editingClient, state: e.target.value.toUpperCase() })}
                                maxLength={2}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Statistics Card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Estatísticas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-2">Total Comprado</p>
                    <p className="text-3xl font-bold" style={{ color: '#10B981' }}>
                      R$ {getClientTotal(selectedClient.id).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total de Pedidos</p>
                    <p className="text-2xl font-medium">
                      {getClientOrders(selectedClient.id).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Cliente desde</p>
                    <p className="text-sm font-medium">
                      {selectedClient.createdAt.toLocaleDateString('pt-BR', { 
                        day: '2-digit',
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Orders List */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  Pedidos do Cliente
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getClientOrders(selectedClient.id).length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum pedido encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getClientOrders(selectedClient.id)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .map(order => (
                    <div 
                      key={order.id} 
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => {
                        setSelectedOrder(order);
                        setViewMode('order-detail');
                      }}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div>
                          <p className="text-sm font-medium">Pedido #{order.id}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building className="w-3 h-3" />
                              {order.importadoraName}
                            </div>
                            <span className="text-xs text-muted-foreground">•</span>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {order.createdAt.toLocaleDateString('pt-BR')}
                            </div>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {order.items.length} {order.items.length === 1 ? 'produto' : 'produtos'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
                          <p className="text-lg font-bold text-primary">
                            R$ {order.total.toFixed(2)}
                          </p>
                        </div>
                        {getOrderStatusBadge(order.status)}
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
          {/* Header with Back Button */}
          <div className="mb-6 space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('client-detail')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Cliente
            </Button>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2>Pedido #{selectedOrder.id}</h2>
                {getOrderStatusBadge(selectedOrder.status)}
              </div>
              <p className="text-sm text-muted-foreground">
                Cliente: {selectedClient.name}
              </p>
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

          {/* Order Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Produtos do Pedido</CardTitle>
                <Select onValueChange={(value) => handleExportOrder(selectedOrder, value)}>
                  <SelectTrigger className="w-[200px] bg-green-500 hover:bg-green-600 text-white border-green-500 [&>span]:text-white">
                    <SelectValue placeholder="Exportar Pedido">
                      <div className="flex items-center gap-2 text-white">
                        <Download className="w-4 h-4" />
                        <span>Exportar Pedido</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>Exportar para CSV</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>Exportar para PDF</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                    <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium mb-1">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Código: {item.product.code}
                        </p>
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
                  <label className="text-sm font-medium">CNPJ</label>
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
    </div>
  );
};