import React, { useEffect } from 'react';
import {
  TrendingUp,
  Package,
  ShoppingBag,
  DollarSign,
  Users,
  Building2,
  UserCheck,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useOrders } from '@/contexts/OrdersContext';
import { useImportadoras, useProducts, useCommissions, useRepresentatives } from '@/hooks/useData';
import { getRepresentanteCommissionPercent } from '@/lib/representanteCommission';
import { cn } from '@/app/components/ui/utils';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  mode?: 'admin' | 'representante';
}

interface DashboardLinkCardProps {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

function DashboardLinkCard({ onClick, children, className }: DashboardLinkCardProps) {
  const card = (
    <Card
      className={cn(
        'relative h-full gap-0',
        onClick && 'cursor-pointer transition-shadow hover:border-primary/30 hover:shadow-md',
        className
      )}
    >
      {children}
      {onClick && (
        <ChevronRight
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      )}
    </Card>
  );

  if (!onClick) {
    return card;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {card}
    </button>
  );
}

interface DashboardMetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle: string;
  icon: React.ReactNode;
  valueClassName?: string;
  onClick?: () => void;
}

function DashboardMetricCard({
  title,
  value,
  subtitle,
  icon,
  valueClassName = 'text-primary',
  onClick,
}: DashboardMetricCardProps) {
  return (
    <DashboardLinkCard onClick={onClick}>
      <CardContent className="space-y-2 p-4 pr-9 !pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          {icon}
        </div>
        <div>
          <p className={cn('text-2xl font-bold leading-none', valueClassName)}>{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </DashboardLinkCard>
  );
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, mode }) => {
  const { orders, refetch: refetchOrders } = useOrders();

  useEffect(() => {
    void refetchOrders();
  }, [refetchOrders]);
  const { importadoras } = useImportadoras();
  const { products } = useProducts();
  const { commissions } = useCommissions();
  const { representatives } = useRepresentatives();

  const totalVendido = orders
    .filter((order) => order.status === 'faturado')
    .reduce((sum, order) => sum + order.total, 0);

  const pedidosPendentes = orders.filter((order) => order.status === 'aberto').length;
  const pedidosNaoLidos = orders.filter((o) => !o.isRead).length;

  const comissaoEstimada = orders
    .filter((order) => order.status === 'faturado')
    .reduce((sum, order) => {
      const pct = getRepresentanteCommissionPercent(
        order.importadoraId,
        commissions,
        importadoras
      );
      return sum + order.total * (pct / 100);
    }, 0);

  const effectiveRole: 'admin' | 'representante' = mode ?? 'representante';

  const totalImportadoras = importadoras.length;
  const importadorasAtivas = importadoras.filter((i) => i.active).length;
  const totalRepresentantes = representatives.length;
  const representantesAtivos = representatives.filter((r) => r.status === 'active').length;
  const totalProdutos = products.length;
  const produtosAtivos = products.filter((p) => p.active).length;
  const totalPedidos = orders.length;

  if (effectiveRole === 'admin') {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="mb-1.5">Bem-vinda de volta!</h2>
          <p className="text-sm text-muted-foreground">Aqui está um resumo das suas atividades</p>
        </div>

        <div>
          <h3 className="mb-3 text-base font-semibold">Visão Geral da Plataforma</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <DashboardLinkCard onClick={() => onNavigate('importers')}>
              <CardContent className="p-5 pr-9">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-muted-foreground">Importadoras</p>
                    <p className="text-2xl font-bold leading-none text-primary">{totalImportadoras}</p>
                    <p className="text-xs text-muted-foreground">{importadorasAtivas} ativas</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </DashboardLinkCard>

            <DashboardLinkCard onClick={() => onNavigate('representatives')}>
              <CardContent className="p-5 pr-9">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-muted-foreground">Representantes</p>
                    <p className="text-2xl font-bold leading-none text-primary">{totalRepresentantes}</p>
                    <p className="text-xs text-muted-foreground">{representantesAtivos} ativos</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                    <UserCheck className="h-5 w-5 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </DashboardLinkCard>

            <DashboardLinkCard onClick={() => onNavigate('importers')}>
              <CardContent className="p-5 pr-9">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-muted-foreground">Produtos</p>
                    <p className="text-2xl font-bold leading-none text-primary">{totalProdutos}</p>
                    <p className="text-xs text-muted-foreground">{produtosAtivos} no catálogo</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </DashboardLinkCard>

            <DashboardLinkCard>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                    <p className="text-2xl font-bold leading-none text-primary">{totalPedidos}</p>
                    <p className="text-xs text-muted-foreground">Todos os períodos</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                    <BarChart3 className="h-5 w-5 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </DashboardLinkCard>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pt-0">
            <Button
              onClick={() => onNavigate('importers')}
              className="flex h-auto flex-col gap-2 bg-primary py-4 hover:bg-primary/90"
            >
              <Building2 className="h-6 w-6" />
              <span className="text-sm">Ver Importadoras</span>
            </Button>
            <Button
              onClick={() => onNavigate('representatives')}
              className="flex h-auto flex-col gap-2 bg-secondary py-4 hover:bg-secondary/90"
            >
              <Users className="h-6 w-6" />
              <span className="text-sm">Ver Representantes</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recentOrders = orders.slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1.5">Bem-vinda de volta!</h2>
        <p className="text-sm text-muted-foreground">Aqui está um resumo das suas atividades</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        <DashboardMetricCard
          title="Total Vendido"
          value={`R$ ${totalVendido.toFixed(2)}`}
          subtitle="Este mês"
          icon={<DollarSign className="h-4 w-4 shrink-0 text-secondary" />}
          onClick={() => onNavigate('commissions')}
        />
        <DashboardMetricCard
          title="Novos Pedidos"
          value={pedidosPendentes}
          subtitle="Aguardando ação"
          icon={<ShoppingBag className="h-4 w-4 shrink-0 text-primary" />}
          onClick={() => onNavigate('orders')}
        />
        <DashboardMetricCard
          title="Comissão Estimada"
          value={`R$ ${comissaoEstimada.toFixed(2)}`}
          subtitle="Este mês"
          valueClassName="text-secondary"
          icon={<TrendingUp className="h-4 w-4 shrink-0 text-secondary" />}
          onClick={() => onNavigate('commissions')}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 pt-0">
          <Button
            onClick={() => onNavigate('catalog')}
            className="flex h-auto flex-col gap-2 bg-primary py-4 hover:bg-primary/90"
          >
            <Package className="h-6 w-6" />
            <span className="text-sm">Ver Catálogo</span>
          </Button>
          <Button
            onClick={() => onNavigate('orders')}
            className="relative flex h-auto flex-col gap-2 bg-secondary py-4 hover:bg-secondary/90"
          >
            <ShoppingBag className="h-6 w-6" />
            <span className="text-sm">Ver Pedidos</span>
            {pedidosNaoLidos > 0 && (
              <Badge className="absolute right-2 top-2 flex h-5 min-w-[20px] items-center justify-center bg-red-500 px-1">
                {pedidosNaoLidos}
              </Badge>
            )}
          </Button>
          <Button
            onClick={() => onNavigate('clients')}
            variant="outline"
            className="flex h-auto flex-col gap-2 py-4"
          >
            <Users className="h-6 w-6" />
            <span className="text-sm">Meus Clientes</span>
          </Button>
          <Button
            onClick={() => onNavigate('commissions')}
            variant="outline"
            className="flex h-auto flex-col gap-2 py-4"
          >
            <TrendingUp className="h-6 w-6" />
            <span className="text-sm">Ver Comissões</span>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Pedidos Recentes</CardTitle>
          {orders.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onNavigate('orders')}>
              Ver todos
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum pedido ainda.{' '}
              <button
                type="button"
                onClick={() => onNavigate('catalog')}
                className="text-primary underline-offset-4 hover:underline"
              >
                Ver catálogo
              </button>
            </p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => {
                const statusConfig: Record<string, { label: string; className: string }> = {
                  rascunho: { label: 'Rascunho', className: 'bg-gray-500' },
                  aberto: { label: 'Em Aberto', className: 'bg-blue-500' },
                  faturado: { label: 'Faturado', className: 'bg-green-500' },
                  cancelado: { label: 'Cancelado', className: 'bg-red-500' },
                };
                const config = statusConfig[order.status] || statusConfig.rascunho;

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => onNavigate('orders')}
                    className="flex w-full items-center justify-between rounded-lg bg-muted p-3 text-left transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="truncate text-sm font-medium">{order.clienteName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.importadoraName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium">R$ {order.total.toFixed(2)}</p>
                      <Badge className={config.className}>{config.label}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
