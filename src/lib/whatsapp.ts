/**
 * Monta URL wa.me a partir de um telefone em qualquer formato (ex.: (11) 98765-4321).
 * Assume Brasil (55) quando o número tem 10 ou 11 dígitos sem código do país.
 */
export function buildWhatsAppUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  let n = digits;
  if ((n.length === 10 || n.length === 11) && !n.startsWith('55')) {
    n = `55${n}`;
  }

  if (n.length < 12) return null;

  return `https://wa.me/${n}`;
}
