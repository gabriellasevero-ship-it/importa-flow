/** Apenas dígitos (ex.: CNPJ sem máscara). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Máscara progressiva de CNPJ (até 14 dígitos). */
export function formatCnpjInput(value: string): string {
  const cleaned = onlyDigits(value).slice(0, 14);
  return cleaned
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
