import React, { useState } from 'react';
import { TrendingUp, Package, DollarSign, Calendar, ChevronDown, ChevronUp, ShoppingCart, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useOrders } from '@/contexts/OrdersContext';
import { useImportadoras, useCommissions } from '@/hooks/useData';
import { getRepresentanteCommissionPercent } from '@/lib/representanteCommission';
import { Badge } from '@/app/components/ui/badge';
import { Button, buttonVariants } from '@/app/components/ui/button';
import { cn } from '@/app/components/ui/utils';
import type { Order } from '@/types';

export const Commissions: React.FC = () => {
  const { orders: mockOrders } = useOrders();
  const { importadoras: mockImportadoras } = useImportadoras();
  const { commissions: mockCommissions } = useCommissions();
  const [periodFilter, setPeriodFilter] = useState<'todos' | 'semana' | 'mes' | 'ano'>('todos');
  const [expandedImportadoraId, setExpandedImportadoraId] = useState<string | null>(null);

  const getOrderStatusBadge = (status: string) => {
    const statusMap = {
      faturado: { label: 'Faturado', className: 'bg-success/10 text-success border-success/20' },
      aberto: { label: 'Em Aberto', className: 'bg-warning/10 text-warning border-warning/20' },
      cancelado: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    };
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.aberto;
    return (
      <Badge variant="outline" className={statusInfo.className}>
        {statusInfo.label}
      </Badge>
    );
  };

  const filterOrdersByPeriod = (orders: Order[]) => {
    if (periodFilter === 'todos') {
      return orders;
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      
      switch (periodFilter) {
        case 'semana':
          return orderDate >= startOfWeek;
        case 'mes':
          return orderDate >= startOfMonth;
        case 'ano':
          return orderDate >= startOfYear;
        default:
          return true;
      }
    });
  };

  const calculateCommissionByImportadora = () => {
    return mockImportadoras.map(importadora => {
      const commissionRow = mockCommissions.find(c => c.importadoraId === importadora.id);
      const pct = getRepresentanteCommissionPercent(
        importadora.id,
        mockCommissions,
        mockImportadoras
      );
      const allOrders = mockOrders.filter(
        o => o.importadoraId === importadora.id && o.status === 'faturado'
      );
      const filteredOrders = filterOrdersByPeriod(allOrders);
      const totalSales = filteredOrders.reduce((sum, order) => sum + order.total, 0);
      const totalCommission = totalSales * (pct / 100);

      return {
        importadora,
        commission: pct,
        isExclusive: commissionRow?.isExclusive ?? false,
        totalSales,
        totalCommission,
        orderCount: filteredOrders.length,
      };
    });
  };

  const commissionData = calculateCommissionByImportadora();
  const totalCommission = commissionData.reduce((sum, data) => sum + data.totalCommission, 0);
  const totalSales = commissionData.reduce((sum, data) => sum + data.totalSales, 0);

  const exportImportadoraOrders = (importadoraId: string, importadoraName: string) => {
    const orders = filterOrdersByPeriod(
      mockOrders.filter(o => o.importadoraId === importadoraId && o.status === 'faturado')
    );

    if (orders.length === 0) {
      alert('Não há pedidos para exportar');
      return;
    }

    const commissionPercentage = getRepresentanteCommissionPercent(
      importadoraId,
      mockCommissions,
      mockImportadoras
    );

    // Criar CSV
    const headers = ['Pedido', 'Cliente', 'Data', 'Nota Fiscal', 'Valor Total', 'Comissão (%)', 'Valor Comissão', 'Status'];
    const rows = orders.map(order => [
      order.id,
      order.clienteName || 'Sem cliente',
      new Date(order.createdAt).toLocaleDateString('pt-BR'),
      order.notaFiscal || '-',
      `R$ ${order.total.toFixed(2)}`,
      `${commissionPercentage}%`,
      `R$ ${(order.total * (commissionPercentage / 100)).toFixed(2)}`,
      order.status === 'faturado' ? 'Faturado' : order.status === 'aberto' ? 'Em Aberto' : 'Cancelado'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pedidos_${importadoraName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFullReport = () => {
    const activeData = commissionData.filter((d) => d.orderCount > 0);

    if (activeData.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    const periodLabel = {
      todos: 'Todos',
      semana: 'Esta Semana',
      mes: 'Este Mês',
      ano: 'Este Ano',
    }[periodFilter];

    const headers = ['Importadora', 'Pedidos', 'Comissão (%)', 'Vendas', 'Comissão Total'];
    const rows = activeData.map((data) => [
      data.importadora.name,
      data.orderCount,
      `${data.commission}%`,
      `R$ ${data.totalSales.toFixed(2)}`,
      `R$ ${data.totalCommission.toFixed(2)}`,
    ]);

    const csvContent = [
      `Relatório de Comissões - ${periodLabel}`,
      '',
      headers.join(','),
      ...rows.map((row) => row.join(',')),
      '',
      `Total,,,R$ ${totalSales.toFixed(2)},R$ ${totalCommission.toFixed(2)}`,
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `relatorio_comissoes_${periodFilter}_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden pb-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 flex-1 text-xl font-semibold leading-tight sm:text-2xl">
            Comissões
          </h2>

          <div className="flex shrink-0 items-center gap-4">
            <Select value={periodFilter} onValueChange={(value: 'todos' | 'semana' | 'mes' | 'ano') => setPeriodFilter(value)}>
              <SelectTrigger
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'icon' }),
                  '!border-border !bg-background dark:!border-input dark:!bg-input/30',
                  'justify-center p-0 [&_[data-slot=select-value]]:!hidden [&>svg:last-child]:hidden',
                  'sm:h-10 sm:w-[180px] sm:justify-between sm:px-3 sm:[&_[data-slot=select-value]]:!flex sm:[&>svg:last-child]:block',
                )}
                aria-label="Filtrar por período"
              >
                <Calendar className="h-4 w-4 shrink-0 sm:mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[100]">
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="semana">Esta Semana</SelectItem>
                <SelectItem value="mes">Este Mês</SelectItem>
                <SelectItem value="ano">Este Ano</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 sm:hidden"
              onClick={exportFullReport}
              aria-label="Baixar relatório"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="hidden h-10 shrink-0 sm:inline-flex"
              onClick={exportFullReport}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Relatório
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Acompanhe suas comissões por importadora
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Comissão Total (Mês)</CardTitle>
            <DollarSign className="w-4 h-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-medium" style={{ color: '#10B981' }}>
              R$ {totalCommission.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sobre R$ {totalSales.toFixed(2)} em vendas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Taxa Média</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-medium" style={{ color: '#1B5B6B' }}>
              {totalSales > 0 ? ((totalCommission / totalSales) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Comissão média ponderada
            </p>
          </CardContent>
        </Card>
      </div>

      {/* By Importadora */}
      <Card>
        <CardHeader>
          <CardTitle>Comissões por Importadora</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {commissionData.filter(d => d.orderCount > 0).map(data => {
            const isExpanded = expandedImportadoraId === data.importadora.id;
            const importadoraOrders = filterOrdersByPeriod(
              mockOrders.filter(o => o.importadoraId === data.importadora.id && o.status === 'faturado')
            );

            return (
              <div key={data.importadora.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div
                    className="min-w-0 flex-1 cursor-pointer transition-opacity hover:opacity-80"
                    onClick={() => setExpandedImportadoraId(isExpanded ? null : data.importadora.id)}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-medium">{data.importadora.name}</h4>
                      {data.isExclusive && (
                        <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                          Exclusiva
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {data.orderCount} {data.orderCount === 1 ? 'pedido' : 'pedidos'} •
                      Comissão: {data.commission}%
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="font-medium" style={{ color: '#10B981' }}>
                        R$ {data.totalCommission.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        de R$ {data.totalSales.toFixed(2)}
                      </p>
                    </div>

                    <Button
                      size="icon"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportImportadoraOrders(data.importadora.id, data.importadora.name);
                      }}
                      className="h-9 w-9 shrink-0"
                      aria-label={`Baixar relatório ${data.importadora.name}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {totalSales > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Participação nas vendas</span>
                      <span>{((data.totalSales / totalSales) * 100).toFixed(1)}%</span>
                    </div>
                    <Progress
                      value={(data.totalSales / totalSales) * 100}
                      className="h-2"
                    />
                  </div>
                )}

                {/* Lista de Pedidos Expandida */}
                {isExpanded && importadoraOrders.length > 0 && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingCart className="w-4 h-4 text-primary" />
                      <h5 className="text-sm font-medium">Pedidos Faturados</h5>
                    </div>
                    {importadoraOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">Pedido #{order.id}</p>
                            {getOrderStatusBadge(order.status)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Cliente: {order.clienteName || 'Sem cliente'} •{' '}
                            {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                          {order.notaFiscal && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              NF: {order.notaFiscal}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-2 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                          <p className="text-sm font-bold text-primary">
                            R$ {order.total.toFixed(2)}
                          </p>
                          <p className="text-xs" style={{ color: '#10B981' }}>
                            Comissão: R$ {(order.total * (data.commission / 100)).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {commissionData.filter(d => d.orderCount > 0).length === 0 && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                Ainda não há vendas registradas
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm mb-1">Informativo</h4>
              <p className="text-xs text-muted-foreground">
                Os valores exibidos são estimativas baseadas nos pedidos marcados como vendidos. 
                O pagamento efetivo das comissões segue os termos do contrato com cada importadora.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};