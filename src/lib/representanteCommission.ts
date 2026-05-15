import type { Commission, Importadora } from '@/types';

/**
 * Percentual efetivo de comissão da representante para uma importadora:
 * se existir linha em `commissions`, usa o valor negociado; senão, o padrão da importadora.
 */
export function getRepresentanteCommissionPercent(
  importadoraId: string,
  commissions: Commission[],
  importadoras: Importadora[]
): number {
  const row = commissions.find((c) => c.importadoraId === importadoraId);
  if (row) return row.percentage;
  const imp = importadoras.find((i) => i.id === importadoraId);
  return imp?.representanteCommissionPct ?? 0;
}
