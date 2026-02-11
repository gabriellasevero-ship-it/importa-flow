import React from 'react';
import { TrendingUp, Package, ShoppingBag, DollarSign, Users, Building2, UserCheck, BarChart3, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useImportadoras, useCategories, useProducts, useCommissions } from '@/hooks/useData';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  mode?: 'admin' | 'representante';
}

// Mock de representantes (quantidade)
const mockRepresentatives = [
  { id: '1', status: 'active' },
  { id: '2', status: 'active' },
  { id: '3', status: 'pending' },
  { id: '4', status: 'suspended' },
];

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, mode }) => {
  const { user } = useAuth();
  const { orders } = useOrders();
  const { importadoras } = useImportadoras();
  const { products } = useProducts();
  const { commissions } = useCommissions();

  // Métricas para representante
  const totalVendido = orders
    .filter(order => order.status === 'faturado')
    .reduce((sum, order) => sum + order.total, 0);

  const pedidosPendentes = orders.filter(
    order => order.status === 'aberto'
  ).length;

  const comissaoEstimada = orders
    .filter(order => order.status === 'faturado')
    .reduce((sum, order) => {
      const commission = commissions.find(c => c.importadoraId === order.importadoraId);
      return sum + (order.total * (commission?.percentage || 0) / 100);
    }, 0);

  // Definimos o papel efetivo apenas com base no `mode` vindo da aplicação.
  // Isso garante que o toggle Representante/Backoffice controle 100% o layout.
  const effectiveRole: 'admin' | 'representante' = mode ?? 'representante';

  // Estatísticas para admin
  const totalImportadoras = importadoras.length;
  const importadorasAtivas = importadoras.filter(i => i.active).length;
  const totalRepresentantes = mockRepresentatives.length;
  const representantesAtivos = mockRepresentatives.filter(r => r.status === 'active').length;
  const totalProdutos = products.length;
  const produtosAtivos = products.filter(p => p.active).length;
  const totalPedidos = orders.length;

  // Dashboard para Admin
  if (effectiveRole === 'admin') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-2">Bem-vinda de volta!</h2>
          <p className="text-muted-foreground">
            Aqui está um resumo das suas atividades
          </p>
        </div>

        {/* Estatísticas da Plataforma (Admin) */}
        <div>
          <h3 className="mb-4">Visão Geral da Plataforma</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Importadoras</p>
                    <p className="text-2xl font-bold text-primary">
                      {totalImportadoras}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {importadorasAtivas} ativas
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Representantes</p>
                    <p className="text-2xl font-bold text-primary">
                      {totalRepresentantes}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {representantesAtivos} ativos
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Produtos</p>
                    <p className="text-2xl font-bold text-primary">
                      {totalProdutos}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {produtosAtivos} no catálogo
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total de Pedidos</p>
                    <p className="text-2xl font-bold text-primary">
                      {totalPedidos}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Todos os períodos
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions - Admin */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => onNavigate('importers')}
              className="h-auto py-4 flex flex-col gap-2 bg-primary hover:bg-primary/90"
            >
              <Building2 className="w-6 h-6" />
              <span className="text-sm">Ver Importadoras</span>
            </Button>
            <Button
              onClick={() => onNavigate('representatives')}
              className="h-auto py-4 flex flex-col gap-2 bg-secondary hover:bg-secondary/90"
            >
              <Users className="w-6 h-6" />
              <span className="text-sm">Ver Representantes</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard para Representante
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2">Bem-vinda de volta!</h2>
        <p className="text-muted-foreground">
          Aqui está um resumo das suas atividades
        </p>
      </div>

      {/* Stats Cards - Representante */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Total Vendido</CardTitle>
            <DollarSign className="w-4 h-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl mb-1 text-primary">
              R$ {totalVendido.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Novos Pedidos</CardTitle>
            <ShoppingBag className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl mb-1 text-primary">
              {pedidosPendentes}
            </div>
            <p className="text-xs text-muted-foreground">Aguardando ação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Comissão Estimada</CardTitle>
            <TrendingUp className="w-4 h-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl mb-1 text-secondary">
              R$ {comissaoEstimada.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Representante */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => onNavigate('catalog')}
            className="h-auto py-4 flex flex-col gap-2 bg-primary hover:bg-primary/90"
          >
            <Package className="w-6 h-6" />
            <span className="text-sm">Ver Catálogo</span>
          </Button>
          <Button
            onClick={() => onNavigate('orders')}
            className="h-auto py-4 flex flex-col gap-2 bg-secondary hover:bg-secondary/90 relative"
          >
            <ShoppingBag className="w-6 h-6" />
            <span className="text-sm">Ver Pedidos</span>
            {orders.filter(o => !o.isRead).length > 0 && (
              <Badge className="absolute top-2 right-2 bg-red-500 min-w-[20px] h-5 flex items-center justify-center px-1">
                {orders.filter(o => !o.isRead).length}
              </Badge>
            )}
          </Button>
          <Button
            onClick={() => onNavigate('clients')}
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
          >
            <Users className="w-6 h-6" />
            <span className="text-sm">Meus Clientes</span>
          </Button>
          <Button
            onClick={() => onNavigate('commissions')}
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-sm">Ver Comissões</span>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Orders - Representante */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orders.slice(0, 3).map(order => {
              const statusConfig: Record<string, { label: string; className: string }> = {
                rascunho: { label: 'Rascunho', className: 'bg-gray-500' },
                aberto: { label: 'Em Aberto', className: 'bg-blue-500' },
                faturado: { label: 'Faturado', className: 'bg-green-500' },
                cancelado: { label: 'Cancelado', className: 'bg-red-500' },
              };
              const config = statusConfig[order.status] || statusConfig.rascunho;
              
              return (
              <div key={order.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{order.clienteName}</p>
                  <p className="text-xs text-muted-foreground">{order.importadoraName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">R$ {order.total.toFixed(2)}</p>
                  <Badge className={config.className}>
                    {config.label}
                  </Badge>
                </div>
              </div>
            )})}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};