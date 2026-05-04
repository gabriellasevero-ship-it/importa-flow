import { supabase } from '@/lib/supabase';
import { mapOrder, mapOrderItem, toDbOrder } from './mappers';
import type { Order, CartItem } from '@/types';

type CreateOrderCatalogoResult = { order_id: string; total: number };

/**
 * Pedido pelo link do catálogo: sessão Supabase é `anon` — insert direto em `orders` é bloqueado pelo RLS.
 * Usa RPC SECURITY DEFINER (migration 012).
 */
export async function createOrderCatalogo(
  representanteRowId: string,
  order: Partial<Order> & { clienteId: string; importadoraId: string; items: CartItem[] }
): Promise<CreateOrderCatalogoResult> {
  if (!order.clienteId) {
    throw new Error('cliente_id_required');
  }
  const itemsPayload = order.items.map((i) => ({
    product_id: i.productId,
    quantity: i.quantity,
    observations: i.observations ?? null,
  }));

  const { data, error } = await supabase.rpc('create_order_catalogo', {
    p_representante_row_id: representanteRowId,
    p_cliente_id: order.clienteId,
    p_importadora_id: order.importadoraId,
    p_items: itemsPayload,
    p_link_id: order.linkId ?? null,
    p_observations: order.observations ?? null,
    p_transportadora_id: order.transportadoraId ?? null,
  });

  if (error) throw error;

  const raw = data as { order_id?: string; total?: string | number } | null;
  if (!raw?.order_id) {
    throw new Error('create_order_catalogo_unexpected_response');
  }

  return {
    order_id: raw.order_id,
    total: Number(raw.total ?? 0),
  };
}

export async function fetchOrders(representanteId: string): Promise<Order[]> {
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select(`
      *,
      profiles(name),
      clientes(name),
      importadoras(name)
    `)
    .eq('representante_id', representanteId)
    .order('created_at', { ascending: false });
  if (ordersError) throw ordersError;
  if (!ordersData?.length) return [];

  const orderIds = ordersData.map(o => o.id);
  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('*, products(id, importadora_id, code, name, description, price, min_order, category, subcategory, image, observations, active, material, detalhe1, detalhe2, detalhe3, dimensions, created_at, importadoras(name))')
    .in('order_id', orderIds);
  if (itemsError) throw itemsError;

  const itemsByOrderId = new Map<string, CartItem[]>();
  (itemsData ?? []).forEach((item: Record<string, unknown>) => {
    const orderId = item.order_id as string;
    if (!itemsByOrderId.has(orderId)) itemsByOrderId.set(orderId, []);
    itemsByOrderId.get(orderId)!.push(mapOrderItem(item as never));
  });

  return ordersData.map(row => mapOrder(row as never, itemsByOrderId.get(row.id) ?? []));
}

export async function getOrder(id: string, representanteId?: string): Promise<Order | null> {
  let q = supabase
    .from('orders')
    .select(`
      *,
      profiles(name),
      clientes(name),
      importadoras(name)
    `)
    .eq('id', id);
  if (representanteId) q = q.eq('representante_id', representanteId);
  const { data: orderRow, error: orderError } = await q.single();
  if (orderError) {
    if (orderError.code === 'PGRST116') return null;
    throw orderError;
  }
  if (!orderRow) return null;

  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('*, products(*, importadoras(name))')
    .eq('order_id', id);
  if (itemsError) throw itemsError;
  const items = (itemsData ?? []).map((item: Record<string, unknown>) => mapOrderItem(item as never));
  return mapOrder(orderRow as never, items);
}

export async function createOrder(
  order: Partial<Order> & { representanteId: string; importadoraId: string; items: CartItem[] }
): Promise<Order> {
  const total = order.items.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );
  const { data: inserted, error: orderError } = await supabase
    .from('orders')
    .insert({
      ...toDbOrder({ ...order, total }),
      total,
    })
    .select(`
      *,
      profiles(name),
      clientes(name),
      importadoras(name)
    `)
    .single();
  if (orderError) throw orderError;

  const orderId = inserted.id;
  const rows = order.items.map(item => ({
    order_id: orderId,
    product_id: item.productId,
    product_code: item.product.code,
    product_name: item.product.name,
    product_price: item.product.price,
    quantity: item.quantity,
    observations: item.observations ?? null,
  }));
  const { error: itemsError } = await supabase.from('order_items').insert(rows);
  if (itemsError) throw itemsError;

  const { data: itemsData } = await supabase
    .from('order_items')
    .select('*, products(*, importadoras(name))')
    .eq('order_id', orderId);
  const items = (itemsData ?? []).map((i: Record<string, unknown>) => mapOrderItem(i as never));
  return mapOrder(inserted as never, items);
}

export async function updateOrder(
  orderId: string,
  updates: Partial<Order>,
  replaceItems?: CartItem[]
): Promise<Order> {
  const db: Record<string, unknown> = {};
  if (updates.status != null) db.status = updates.status;
  if (updates.total != null) db.total = updates.total;
  if (updates.observations != null) db.observations = updates.observations;
  if (updates.notaFiscal != null) db.nota_fiscal = updates.notaFiscal;
  if (updates.paymentTerm != null) db.payment_term = updates.paymentTerm;
  if (updates.transportadoraId != null) db.transportadora_id = updates.transportadoraId;
  if (updates.notes != null) db.notes = updates.notes;
  if (updates.isRead != null) db.is_read = updates.isRead;
  if (Object.keys(db).length > 0) {
    const { error } = await supabase.from('orders').update(db).eq('id', orderId);
    if (error) throw error;
  }
  if (replaceItems && replaceItems.length >= 0) {
    await supabase.from('order_items').delete().eq('order_id', orderId);
    if (replaceItems.length > 0) {
      const rows = replaceItems.map(item => ({
        order_id: orderId,
        product_id: item.productId,
        product_code: item.product.code,
        product_name: item.product.name,
        product_price: item.product.price,
        quantity: item.quantity,
        observations: item.observations ?? null,
      }));
      const { error } = await supabase.from('order_items').insert(rows);
      if (error) throw error;
    }
  }
  const order = await getOrder(orderId);
  if (!order) throw new Error('Order not found after update');
  return order;
}

export async function deleteOrder(orderId: string): Promise<void> {
  const { error } = await supabase.from('orders').delete().eq('id', orderId);
  if (error) throw error;
}
