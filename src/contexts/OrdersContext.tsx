import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Order } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import * as ordersApi from '@/services/orders';

interface OrdersContextType {
  orders: Order[];
  loading: boolean;
  addOrder: (order: Order) => Promise<void>;
  updateOrder: (orderId: string, updates: Partial<Order>, replaceItems?: Order['items']) => Promise<void>;
  refetch: () => Promise<void>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error('useOrders must be used within OrdersProvider');
  }
  return context;
};

interface OrdersProviderProps {
  children: ReactNode;
}

export const OrdersProvider: React.FC<OrdersProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await ordersApi.fetchOrders(user.id);
      setOrders(list);
    } catch (e) {
      console.error('Erro ao carregar pedidos:', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const addOrder = async (order: Order) => {
    const repId = user?.id ?? order.representanteId;
    if (!repId) return;
    const created = await ordersApi.createOrder({
      ...order,
      representanteId: repId,
      importadoraId: order.importadoraId,
      items: order.items,
      clienteId: order.clienteId,
      clienteName: order.clienteName,
      importadoraName: order.importadoraName,
      representanteName: order.representanteName,
      status: order.status ?? 'rascunho',
      total: order.total,
      observations: order.observations,
      notaFiscal: order.notaFiscal,
      paymentTerm: order.paymentTerm,
      transportadoraId: order.transportadoraId,
      linkId: order.linkId,
      origin: order.origin ?? 'representante',
      isRead: order.isRead ?? false,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    });
    setOrders(prev => [created, ...prev]);
  };

  const updateOrder = async (
    orderId: string,
    updates: Partial<Order>,
    replaceItems?: Order['items']
  ) => {
    const updated = await ordersApi.updateOrder(orderId, updates, replaceItems);
    setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)));
  };

  return (
    <OrdersContext.Provider value={{ orders, loading, addOrder, updateOrder, refetch }}>
      {children}
    </OrdersContext.Provider>
  );
};
