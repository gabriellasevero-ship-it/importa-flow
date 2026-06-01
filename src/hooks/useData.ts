import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as importadorasApi from '@/services/importadoras';
import * as categoriesApi from '@/services/categories';
import * as productsApi from '@/services/products';
import * as clientesApi from '@/services/clientes';
import * as transportadorasApi from '@/services/transportadoras';
import * as commissionsApi from '@/services/commissions';
import * as notificationsApi from '@/services/notifications';
import * as representantesApi from '@/services/representantes';
import type { Importadora, Category, Product, Cliente, Transportadora, Commission } from '@/types';

function messageFromFetchError(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  if (e instanceof Error && e.message.trim()) return e.message.trim();
  return 'Não foi possível carregar as importadoras.';
}

export function useImportadoras() {
  const { user } = useAuth();
  const [list, setList] = useState<Importadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await importadorasApi.fetchImportadoras();
      setList(data);
    } catch (e) {
      console.error(e);
      setList([]);
      setError(messageFromFetchError(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refetch();
  }, [refetch, user?.id]);
  return { importadoras: list, loading, error, refetch };
}

export function useCategories() {
  const [list, setList] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await categoriesApi.fetchCategories();
      setList(data);
    } catch (e) {
      console.error(e);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { categories: list, loading, refetch };
}

export function useProducts(filters?: { importadoraId?: string; category?: string; active?: boolean }) {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async (): Promise<Product[]> => {
    setLoading(true);
    try {
      const data = await productsApi.fetchProducts(filters);
      setList(data);
      return data;
    } catch (e) {
      console.error(e);
      setList([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [filters?.importadoraId, filters?.category, filters?.active]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { products: list, loading, refetch };
}

export function useClientes() {
  const { user } = useAuth();
  const [list, setList] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    if (!user?.id) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await clientesApi.fetchClientes(user.id);
      setList(data);
    } catch (e) {
      console.error(e);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { clientes: list, loading, refetch };
}

export function useTransportadoras() {
  const [list, setList] = useState<Transportadora[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await transportadorasApi.fetchTransportadoras();
      setList(data);
    } catch (e) {
      console.error(e);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { transportadoras: list, loading, refetch };
}

export function useCommissions() {
  const { user } = useAuth();
  const [list, setList] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    if (!user?.id) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await commissionsApi.fetchCommissions(user.id);
      setList(data);
    } catch (e) {
      console.error(e);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { commissions: list, loading, refetch };
}

export function useRepresentatives() {
  const [list, setList] = useState<representantesApi.Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await representantesApi.fetchRepresentatives();
      setList(data);
    } catch (e) {
      console.error(e);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { representatives: list, loading, refetch };
}

export function useNotifications() {
  const { user } = useAuth();
  const [list, setList] = useState<notificationsApi.NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    if (!user?.id) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await notificationsApi.fetchNotifications(user.id);
      setList(data);
    } catch (e) {
      console.error(e);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  const unreadCount = list.filter(n => !n.read).length;
  return { notifications: list, loading, refetch, unreadCount };
}
