/**
 * Identificador curto do pedido para exibição (primeiros 8 hex do UUID, sem hífens).
 * O UUID completo permanece como chave em API, busca e banco.
 */
export function formatOrderDisplayId(orderId: string): string {
  if (!orderId?.trim()) return orderId;
  const compact = orderId.replace(/-/g, '');
  if (compact.length < 8) return orderId;
  return compact.slice(0, 8).toUpperCase();
}

export function formatOrderLabel(orderId: string): string {
  return `Pedido #${formatOrderDisplayId(orderId)}`;
}
