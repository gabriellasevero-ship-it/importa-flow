import React, { useState } from 'react';
import { ShoppingBag, ArrowLeft, Package, DollarSign, TrendingUp, Calendar, Building, User, Download, Bell, Eye, Search, Upload, FileText, X, CheckCircle, Truck } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';

type ViewMode = 'list' | 'detail';
type FilterType = 'all' | 'unread' | 'cliente' | 'representante';

export const Orders: React.FC = () => {
  const { orders, loading, updateOrder } = useOrders();
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
    csvContent += `Cliente:,${order.clienteName || 'Não informado'},,,,Data Emissão:,${order.createdAt.toLocaleDateString('pt-BR')}\n`;
    csvContent += `Endereço:,,,,,Data Saída:,${order.updatedAt?.toLocaleDateString('pt-BR') || ''}\n`;
    csvContent += `Bairro:,,,,,UF:,CEP:,\n`;
    csvContent += `CNPJ/CPF:,,,Inscr. Est.:,\n`;
    csvContent += `Fone:,,,Forma Pagto.:,${order.paymentTerm || ''}\n`;
    csvContent += `Contato:,,,Fax.:,\n`;
    csvContent += `E-Mail:,\n`;
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
    const transportadora = order.transportadoraId ? transportadoras.find(t => t.id === order.transportadoraId) : null;
    csvContent += `Transportadora:,${transportadora?.name || ''}\n`;
    csvContent += `Fone:,${transportadora?.phone || ''}\n`;
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
    // Criar conteúdo HTML para o PDF
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

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Pedido ${order.id}</title>
        <style>
          @page { margin: 20mm; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 11px;
            color: #000;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #5B3DF5;
            padding-bottom: 10px;
          }
          .header h1 {
            color: #5B3DF5;
            margin: 0;
            font-size: 20px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 5px;
          }
          .info-item {
            margin-bottom: 8px;
          }
          .info-label {
            font-weight: bold;
            color: #555;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background: #5B3DF5;
            color: white;
            padding: 10px 8px;
            text-align: left;
            font-size: 10px;
          }
          td {
            border: 1px solid #ddd;
            padding: 8px;
            font-size: 10px;
          }
          tr:nth-child(even) {
            background: #f9f9f9;
          }
          .totals {
            margin-top: 20px;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 5px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 12px;
          }
          .total-row.main {
            font-size: 16px;
            font-weight: bold;
            color: #5B3DF5;
            padding-top: 10px;
            border-top: 2px solid #5B3DF5;
          }
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 10px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${order.importadoraName}</h1>
          <p>Pedido Nº ${order.id} | Data: ${dataFormatada} ${horaFormatada}</p>
        </div>

        <div class="info-grid">
          <div>
            <div class="info-item">
              <span class="info-label">Cliente:</span> ${order.clienteName || 'Não informado'}
            </div>
            <div class="info-item">
              <span class="info-label">Representante:</span> ${order.representanteName}
            </div>
            <div class="info-item">
              <span class="info-label">Data de Criação:</span> ${order.createdAt.toLocaleDateString('pt-BR')}
            </div>
            <div class="info-item">
              <span class="info-label">Status:</span> ${order.status === 'faturado' ? 'Faturado' : order.status === 'aberto' ? 'Em Aberto' : 'Cancelado'}
            </div>
          </div>
          <div>
            <div class="info-item">
              <span class="info-label">Prazo de Pagamento:</span> ${order.paymentTerm || 'Não informado'}
            </div>
            <div class="info-item">
              <span class="info-label">Transportadora:</span> ${transportadora?.name || 'Não informada'}
            </div>
            ${transportadora ? `
            <div class="info-item">
              <span class="info-label">Telefone Transportadora:</span> ${transportadora.phone}
            </div>
            <div class="info-item">
              <span class="info-label">Local:</span> ${transportadora.city} - ${transportadora.state}
            </div>
            ` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th style="text-align: center;">Cxs</th>
              <th style="text-align: right;">Vlr/Uni</th>
              <th style="text-align: right;">Vlr Total</th>
              <th style="text-align: center;">IPI %</th>
              <th style="text-align: right;">IPI</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => {
              const vlrUnitario = item.product.price.toFixed(2);
              const vlrTotal = (item.quantity * item.product.price).toFixed(2);
              const ipiValor = (item.quantity * item.product.price * 0.065).toFixed(2);
              return `
                <tr>
                  <td>${item.product.code}</td>
                  <td>${item.product.name}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">R$ ${vlrUnitario}</td>
                  <td style="text-align: right;">R$ ${vlrTotal}</td>
                  <td style="text-align: center;">6,50%</td>
                  <td style="text-align: right;">R$ ${ipiValor}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Total de Caixas:</span>
            <span>${totalCaixas}</span>
          </div>
          <div class="total-row">
            <span>Subtotal:</span>
            <span>R$ ${order.total.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Total IPI:</span>
            <span>R$ ${totalIPI.toFixed(2)}</span>
          </div>
          <div class="total-row main">
            <span>TOTAL DO PEDIDO:</span>
            <span>R$ ${order.total.toFixed(2)}</span>
          </div>
        </div>

        ${order.notes ? `
        <div class="footer">
          <div class="info-label">Observações:</div>
          <p>${order.notes}</p>
        </div>
        ` : ''}

        <div class="footer" style="margin-top: 40px; text-align: center;">
          <p>Documento gerado em ${dataFormatada} às ${horaFormatada}</p>
        </div>
      </body>
      </html>
    `;

    // Criar blob e fazer download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pedido_${order.id}_${order.importadoraName.replace(/\s+/g, '_')}_${dataFormatada.replace(/\//g, '-')}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Abrir em nova janela para impressão/salvar como PDF
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
    <div className="space-y-4">
      {viewMode === 'list' && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2>Meus Pedidos</h2>
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

            {/* Import Button */}
            <Button
              onClick={() => setShowImportDialog(true)}
              className="bg-secondary hover:bg-secondary/90 flex-shrink-0"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar Pedido (PDF)
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
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
                size="sm"
              >
                Todos
              </Button>
              <Button
                variant={filterType === 'unread' ? 'default' : 'outline'}
                onClick={() => setFilterType('unread')}
                size="sm"
                className={filterType === 'unread' ? '' : 'border-red-500/30 text-red-500 hover:bg-red-500/10'}
              >
                <Bell className="w-4 h-4 mr-2" />
                Não Lidos ({unreadCount})
              </Button>
              <Button
                variant={filterType === 'cliente' ? 'default' : 'outline'}
                onClick={() => setFilterType('cliente')}
                size="sm"
              >
                <User className="w-4 h-4 mr-2" />
                De Clientes
              </Button>
              <Button
                variant={filterType === 'representante' ? 'default' : 'outline'}
                onClick={() => setFilterType('representante')}
                size="sm"
              >
                Criados por Mim
              </Button>
            </div>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus | 'all')}>
              <SelectTrigger className="w-[180px]">
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
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">Pedido #{order.id}</h4>
                        {!order.isRead && (
                          <Badge className="bg-red-500">
                            <Bell className="w-3 h-3 mr-1" />
                            Novo
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-2">
                        {getOriginBadge(order.origin)}
                        {getOrderStatusBadge(order.status)}
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          <span className="text-xs">{order.importadoraName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span className="text-xs">
                            {order.createdAt.toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          <span className="text-xs">
                            {order.items.length} {order.items.length === 1 ? 'produto' : 'produtos'}
                          </span>
                        </div>
                      </div>

                      {order.clienteName && (
                        <div className="flex items-center gap-2 mt-2">
                          <User className="w-4 h-4 text-secondary" />
                          <span className="text-sm font-semibold text-foreground">{order.clienteName}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
                      <p className="text-2xl font-bold text-primary">
                        R$ {order.total.toFixed(2)}
                      </p>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2>Pedido #{selectedOrder.id}</h2>
                  {!selectedOrder.isRead && (
                    <Badge className="bg-red-500">
                      <Eye className="w-3 h-3 mr-1" />
                      Acabou de visualizar
                    </Badge>
                  )}
                </div>
                {getOrderStatusBadge(selectedOrder.status)}
              </div>
              <div className="flex gap-2">
                {getOriginBadge(selectedOrder.origin)}
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
    </div>
  );
};