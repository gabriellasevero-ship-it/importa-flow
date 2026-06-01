import type { Category } from '@/types';

const MIN_DB_MATCH_SCORE = 55;

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
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

function scoreDbCategoryMatch(productCategory: string, dbName: string): number {
  const productKey = normalizeCategoryKey(productCategory);
  const dbKey = normalizeCategoryKey(dbName);
  if (!productKey || !dbKey) return 0;
  if (productKey === dbKey) return 100;

  const productGroup = normalizeCategoryGroupKey(productCategory);
  const dbGroup = normalizeCategoryGroupKey(dbName);
  if (productGroup === dbGroup) return 95;
  if (productGroup.startsWith(dbGroup) || dbGroup.startsWith(productGroup)) return 88;

  if (productKey.startsWith(dbKey) || dbKey.startsWith(productKey)) return 85;
  if (productKey.includes(dbKey) || dbKey.includes(productKey)) return 72;

  const productWords = productKey.split(' ');
  const dbWords = dbKey.split(' ');
  let score = 0;
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
  return score;
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
    const groupKey = normalizeCategoryKey(resolved);

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
