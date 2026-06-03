import type { Category, Product } from '@/types';
import { inferCategoryFromCatalog } from '@/lib/catalogParser';

const MIN_DB_MATCH_SCORE = 55;

const GENERIC_CATEGORY_KEYS = new Set(['', 'catalogo', 'sem categoria']);

/**
 * Famílias padrão quando a tabela categories está vazia ou o rótulo da IA não bate no cadastro.
 * Ordem importa: entradas mais específicas primeiro (ex.: Brinquedos antes de Infláveis).
 */
const BUILTIN_CATEGORY_FAMILIES: { label: string; re: RegExp }[] = [
  { label: 'Brinquedos', re: /^brinquedo\b|\bbrinquedos\b/i },
  { label: 'Ferramentas', re: /\bferramenta|\balicate|\bfuradeira|\bparafuso\b/i },
  { label: 'Mergulho', re: /\bmergulho|\bmaskara de mergulho|\boculos de mergulho/i },
  { label: 'Papelaria', re: /\bpapelaria|\bcaderno|\bestojo\b/i },
  { label: 'Utilidades', re: /\butilidade|\butilidades\b/i },
  {
    label: 'Infláveis',
    re: /\binflav|\bboia\b|\bboias\b|artigos infl|colchao infl|bola infl|flutuador|piscina infl/i,
  },
];

/** Nomes usados na inferência por nome do produto quando não há cadastro no banco. */
export const BUILTIN_CATEGORY_LABELS = BUILTIN_CATEGORY_FAMILIES.map((f) => f.label);

function resolveBuiltinFamily(rawCategory: string): string | null {
  const key = normalizeCategoryKey(rawCategory);
  if (!key || GENERIC_CATEGORY_KEYS.has(key)) return null;
  for (const family of BUILTIN_CATEGORY_FAMILIES) {
    if (family.re.test(key)) return family.label;
  }
  return null;
}

function pickDbNameForBuiltin(
  builtinLabel: string,
  dbCategories: readonly Pick<Category, 'name'>[]
): string {
  const target = normalizeCategoryKey(builtinLabel);
  const match = dbCategories.find((c) => normalizeCategoryKey(c.name) === target);
  return match?.name.trim() ?? builtinLabel;
}

/** Palavras-chave do produto que indicam família de categoria cadastrada. */
const DOMAIN_CATEGORY_HINTS: { re: RegExp; prefer: string[] }[] = [
  {
    re: /\binflav|\bboia\b|\bboias\b|colchao infl|bola infl|piscina infl|flutuador/i,
    prefer: ['Infláveis', 'Brinquedos', 'Piscina', 'Lazer'],
  },
  {
    re: /\bbrinquedo|\bboneca\b|\bboneco\b|\bjogo\b/i,
    prefer: ['Brinquedos', 'Infláveis'],
  },
  {
    re: /\bferramenta|\balicate|\bchave\b|\bfuradeira|\bparafuso/i,
    prefer: ['Ferramentas', 'Construção'],
  },
  {
    re: /\bmergulho|\bmaskara\b|\bóculos de mergulho/i,
    prefer: ['Mergulho', 'Piscina', 'Esporte'],
  },
];

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Chave para comparar categorias ignorando acentos e caixa. */
export function normalizeCategoryKey(name: string): string {
  return stripDiacritics(name).toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Agrupa plural/singular simples (ex.: Brinquedos ↔ Brinquedo). */
export function normalizeCategoryGroupKey(name: string): string {
  const words = normalizeCategoryKey(name).split(' ').filter(Boolean);
  return words.map(singularizePortugueseWord).join(' ');
}

function singularizePortugueseWord(word: string): string {
  if (word.endsWith('oes') && word.length > 4) return `${word.slice(0, -3)}ao`;
  if (word.endsWith('ais') && word.length > 4) return word.slice(0, -1);
  if (word.endsWith('eis') && word.length > 4) return `${word.slice(0, -2)}el`;
  if (word.endsWith('ns') && word.length > 3) return word.slice(0, -1);
  if (word.endsWith('s') && word.length > 3 && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function wordsShareStem(a: string, b: string, minLen = 4): boolean {
  if (a.length < minLen || b.length < minLen) return false;
  const stemLen = Math.min(5, a.length, b.length);
  return a.slice(0, stemLen) === b.slice(0, stemLen);
}

function domainBoost(productCategory: string, dbName: string): number {
  const pool = normalizeCategoryKey(productCategory);
  const dbKey = normalizeCategoryKey(dbName);
  let best = 0;
  for (const hint of DOMAIN_CATEGORY_HINTS) {
    if (!hint.re.test(pool)) continue;
    for (let i = 0; i < hint.prefer.length; i++) {
      const preferKey = normalizeCategoryKey(hint.prefer[i]);
      if (preferKey !== dbKey && !dbKey.includes(preferKey)) continue;
      best = Math.max(best, 90 - i * 5);
    }
  }
  return best;
}

function scoreDbCategoryMatch(productCategory: string, dbName: string): number {
  const productKey = normalizeCategoryKey(productCategory);
  const dbKey = normalizeCategoryKey(dbName);
  if (!productKey || !dbKey) return 0;
  if (productKey === dbKey) return 100;

  let score = 0;
  const productGroup = normalizeCategoryGroupKey(productCategory);
  const dbGroup = normalizeCategoryGroupKey(dbName);
  if (productGroup === dbGroup) score = Math.max(score, 95);
  if (productGroup.startsWith(dbGroup) || dbGroup.startsWith(productGroup)) {
    score = Math.max(score, 88);
  }
  if (productKey.startsWith(dbKey) || dbKey.startsWith(productKey)) {
    score = Math.max(score, 85);
  }
  if (productKey.includes(dbKey) || dbKey.includes(productKey)) {
    score = Math.max(score, 72);
  }

  const productWords = productKey.split(' ').filter(Boolean);
  const dbWords = dbKey.split(' ').filter(Boolean);

  const firstWord = productWords[0];
  if (
    firstWord &&
    singularizePortugueseWord(firstWord) === singularizePortugueseWord(dbKey)
  ) {
    score = Math.max(score, 96);
  }
  for (const productWord of productWords) {
    if (singularizePortugueseWord(productWord) === singularizePortugueseWord(dbKey)) {
      score = Math.max(score, 94);
    }
  }
  for (const productWord of productWords) {
    if (productWord.length < 4) continue;
    for (const dbWord of dbWords) {
      if (dbWord.length < 4) continue;
      if (
        wordsShareStem(productWord, dbWord) ||
        singularizePortugueseWord(productWord) === singularizePortugueseWord(dbWord)
      ) {
        score += productWord === dbWord ? 24 : 18;
        if (wordsShareStem(productWord, dbWord, 5)) {
          score = Math.max(score, 75);
        }
      }
    }
  }

  return Math.max(score, domainBoost(productCategory, dbName));
}

/**
 * Categoria usada no filtro do catálogo: cadastro + consolidação + inferência por nome
 * quando o produto ficou com "Catálogo" ou rótulo granular da IA.
 */
export function getEffectiveProductCategory(
  product: Pick<Product, 'category' | 'name' | 'material'>,
  dbCategories: readonly Pick<Category, 'name'>[] = []
): string {
  const raw = (product.category ?? '').trim();
  const dbNames =
    dbCategories.length > 0
      ? dbCategories.map((c) => c.name.trim()).filter(Boolean)
      : BUILTIN_CATEGORY_LABELS;

  if (raw && !GENERIC_CATEGORY_KEYS.has(normalizeCategoryKey(raw))) {
    return resolveCanonicalCategory(raw, dbCategories);
  }

  if (dbNames.length > 0) {
    const inferred = inferCategoryFromCatalog(
      product.name,
      product.material ?? '',
      dbNames
    );
    const resolved = resolveCanonicalCategory(inferred, dbCategories);
    if (!GENERIC_CATEGORY_KEYS.has(normalizeCategoryKey(resolved))) {
      return resolved;
    }
  }

  if (raw) return resolveCanonicalCategory(raw, dbCategories);
  return '';
}

function pickPreferredLabel(
  variants: string[],
  dbCategories: readonly Pick<Category, 'name'>[]
): string {
  const dbNames = new Set(dbCategories.map((c) => c.name.trim()).filter(Boolean));
  for (const variant of variants) {
    if (dbNames.has(variant)) return variant;
  }

  const counts = new Map<string, number>();
  for (const variant of variants) {
    counts.set(variant, (counts.get(variant) ?? 0) + 1);
  }
  return [...variants].sort((a, b) => {
    const countDiff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (countDiff !== 0) return countDiff;
    return a.localeCompare(b, 'pt-BR');
  })[0];
}

/**
 * Mapeia o rótulo bruto do produto (ex.: "Boia Inflável Infantil") para uma categoria
 * canônica do catálogo (cadastro ou variante consolidada).
 */
export function resolveCanonicalCategory(
  rawCategory: string,
  dbCategories: readonly Pick<Category, 'name'>[] = []
): string {
  const raw = rawCategory.trim();
  if (!raw) return raw;

  let bestDb: string | null = null;
  let bestScore = 0;
  for (const dbCategory of dbCategories) {
    const dbName = dbCategory.name.trim();
    if (!dbName) continue;
    const score = scoreDbCategoryMatch(raw, dbName);
    if (score > bestScore) {
      bestScore = score;
      bestDb = dbName;
    }
  }
  if (bestDb && bestScore >= MIN_DB_MATCH_SCORE) return bestDb;

  const builtin = resolveBuiltinFamily(raw);
  if (builtin) return pickDbNameForBuiltin(builtin, dbCategories);

  return raw;
}

/** Consolida rótulos parecidos (acentos, plural, mapeamento ao cadastro). */
export function consolidateCategoryLabels(
  rawLabels: readonly string[],
  dbCategories: readonly Pick<Category, 'name'>[] = []
): string[] {
  const groups = new Map<string, { labels: string[]; count: number }>();

  for (const rawLabel of rawLabels) {
    const trimmed = rawLabel.trim();
    if (!trimmed) continue;

    const resolved = resolveCanonicalCategory(trimmed, dbCategories);
    const groupKey =
      normalizeCategoryKey(resolved) ||
      normalizeCategoryKey(resolveBuiltinFamily(trimmed) ?? trimmed);

    const existing = groups.get(groupKey);
    if (existing) {
      if (!existing.labels.includes(resolved)) existing.labels.push(resolved);
      existing.count += 1;
    } else {
      groups.set(groupKey, { labels: [resolved], count: 1 });
    }
  }

  return [...groups.values()]
    .map(({ labels, count }) => ({
      label: pickPreferredLabel(labels, dbCategories),
      count,
    }))
    .sort((a, b) => {
      const byName = a.label.localeCompare(b.label, 'pt-BR');
      return byName !== 0 ? byName : b.count - a.count;
    })
    .map((entry) => entry.label);
}

/** Compara subcategorias tolerando acento e plural. */
export function subcategoriesMatch(a: string, b: string): boolean {
  const left = a.trim();
  const right = b.trim();
  if (!left || !right) return true;
  if (left === right) return true;
  return normalizeCategoryGroupKey(left) === normalizeCategoryGroupKey(right);
}

export function consolidateSubcategoryLabels(rawLabels: readonly string[]): string[] {
  const groups = new Map<string, { labels: string[]; count: number }>();
  for (const rawLabel of rawLabels) {
    const trimmed = rawLabel.trim();
    if (!trimmed) continue;
    const groupKey = normalizeCategoryKey(trimmed);
    const existing = groups.get(groupKey);
    if (existing) {
      if (!existing.labels.includes(trimmed)) existing.labels.push(trimmed);
      existing.count += 1;
    } else {
      groups.set(groupKey, { labels: [trimmed], count: 1 });
    }
  }
  return [...groups.values()]
    .map(({ labels, count }) => ({
      label: pickPreferredLabel(labels, []),
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    .map((entry) => entry.label);
}
