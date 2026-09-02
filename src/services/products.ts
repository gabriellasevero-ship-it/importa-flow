import { isSupabaseConfigured, supabase, syncAuthBeforeDbRead } from '@/lib/supabase';
import { mapProduct } from './mappers';
import type { Product } from '@/types';

/** PostgREST/Supabase limita cada resposta a 1000 linhas por padrão. */
export const PRODUCTS_PAGE_SIZE = 1000;

export type ProductFilters = {
  importadoraId?: string;
  category?: string;
  active?: boolean;
};

function assertSupabaseConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase não configurado. Crie um arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY e reinicie o servidor.'
    );
  }
}

type FilterableQuery = {
  eq: (column: string, value: unknown) => FilterableQuery;
};

function applyProductFilters<T extends FilterableQuery>(q: T, filters?: ProductFilters): T {
  let next: FilterableQuery = q;
  if (filters?.importadoraId) next = next.eq('importadora_id', filters.importadoraId);
  if (filters?.category) next = next.eq('category', filters.category);
  if (filters?.active != null) next = next.eq('active', filters.active);
  return next as T;
}

/**
 * Busca todos os produtos, paginando além do limite padrão do Supabase (1000).
 */
export async function fetchProducts(filters?: ProductFilters): Promise<Product[]> {
  await syncAuthBeforeDbRead();
  const all: Product[] = [];
  let from = 0;

  for (;;) {
    let q = supabase
      .from('products')
      .select('*, importadoras(name)')
      .order('name')
      .order('id');
    q = applyProductFilters(q, filters);
    const { data, error } = await q.range(from, from + PRODUCTS_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows.map(mapProduct));
    if (rows.length < PRODUCTS_PAGE_SIZE) break;
    from += PRODUCTS_PAGE_SIZE;
  }

  return all;
}

/** Contagem exata no banco (não sujeita ao limite de 1000 linhas do select). */
export async function countProducts(filters?: ProductFilters): Promise<number> {
  await syncAuthBeforeDbRead();
  let q = supabase.from('products').select('id', { count: 'exact', head: true });
  q = applyProductFilters(q, filters);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Contagem de produtos por importadora, paginando só o campo necessário.
 * Evita subcontar quando há mais de 1000 produtos no total.
 */
export async function fetchProductCountsByImportadora(): Promise<Record<string, number>> {
  await syncAuthBeforeDbRead();
  const counts: Record<string, number> = {};
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('products')
      .select('importadora_id')
      .order('id')
      .range(from, from + PRODUCTS_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      const id = String(row.importadora_id ?? '');
      if (!id) continue;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    if (rows.length < PRODUCTS_PAGE_SIZE) break;
    from += PRODUCTS_PAGE_SIZE;
  }

  return counts;
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, importadoras(name)')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapProduct(data) : null;
}

export type CreateProductInput = {
  importadoraId: string;
  code: string;
  name: string;
  description?: string;
  price: number;
  minOrder: number;
  category: string;
  subcategory?: string;
  image?: string;
  observations?: string;
  active?: boolean;
  outOfStock?: boolean;
  material?: string;
  detalhe1?: string;
  detalhe2?: string;
  detalhe3?: string;
  dimensions?: string;
};

export type UpdateProductInput = Partial<{
  name: string;
  description: string;
  price: number;
  minOrder: number;
  category: string;
  subcategory: string;
  image: string | null;
  observations: string;
  active: boolean;
  outOfStock: boolean;
  material: string;
  detalhe1: string;
  detalhe2: string;
  detalhe3: string;
  dimensions: string;
}>;

function toProductInsertRow(input: CreateProductInput) {
  return {
    importadora_id: input.importadoraId,
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    price: input.price,
    min_order: input.minOrder,
    category: input.category,
    subcategory: input.subcategory ?? null,
    image: input.image ?? null,
    observations: input.observations ?? null,
    active: input.active ?? true,
    out_of_stock: input.outOfStock ?? false,
    material: input.material ?? null,
    detalhe1: input.detalhe1 ?? null,
    detalhe2: input.detalhe2 ?? null,
    detalhe3: input.detalhe3 ?? null,
    dimensions: input.dimensions ?? null,
  };
}

function toProductUpdateRow(updates: UpdateProductInput): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (updates.name != null) db.name = updates.name;
  if (updates.description != null) db.description = updates.description;
  if (updates.price != null) db.price = updates.price;
  if (updates.minOrder != null) db.min_order = updates.minOrder;
  if (updates.category != null) db.category = updates.category;
  if (updates.subcategory != null) db.subcategory = updates.subcategory;
  if (updates.image !== undefined) db.image = updates.image;
  if (updates.observations != null) db.observations = updates.observations;
  if (updates.active != null) db.active = updates.active;
  if (updates.outOfStock != null) db.out_of_stock = updates.outOfStock;
  if (updates.material != null) db.material = updates.material;
  if (updates.detalhe1 != null) db.detalhe1 = updates.detalhe1;
  if (updates.detalhe2 != null) db.detalhe2 = updates.detalhe2;
  if (updates.detalhe3 != null) db.detalhe3 = updates.detalhe3;
  if (updates.dimensions != null) db.dimensions = updates.dimensions;
  return db;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from('products')
    .insert(toProductInsertRow(input))
    .select('*, importadoras(name)')
    .single();
  if (error) throw error;
  return mapProduct(data);
}

const CREATE_PRODUCTS_CHUNK = 50;

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '23505' || /duplicate|unique/i.test(error.message ?? '');
}

export type CreateProductsResult = {
  created: number;
  /** Linhas que não entraram (duplicata ou erro). */
  failed: number;
};

/**
 * Insere vários produtos em lotes. Se um lote falhar (ex.: 1 código duplicado),
 * tenta linha a linha para não perder o restante do catálogo.
 */
export async function createProducts(inputs: CreateProductInput[]): Promise<CreateProductsResult> {
  if (inputs.length === 0) return { created: 0, failed: 0 };
  assertSupabaseConfigured();

  const rows = inputs.map(toProductInsertRow);
  let created = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += CREATE_PRODUCTS_CHUNK) {
    const chunk = rows.slice(i, i + CREATE_PRODUCTS_CHUNK);
    const { error } = await supabase.from('products').insert(chunk);
    if (!error) {
      created += chunk.length;
      continue;
    }

    for (const row of chunk) {
      const { error: rowError } = await supabase.from('products').insert(row);
      if (!rowError) {
        created += 1;
        continue;
      }
      if (!isUniqueViolation(rowError)) {
        console.warn('Falha ao inserir produto do catálogo:', row.code, rowError);
      }
      failed += 1;
    }
  }

  return { created, failed };
}

/**
 * Mapa código→id dos produtos já cadastrados na importadora (para dedup no upload).
 */
export async function fetchProductCodesByImportadora(
  importadoraId: string
): Promise<Map<string, string>> {
  assertSupabaseConfigured();

  const map = new Map<string, string>();
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('products')
      .select('id, code')
      .eq('importadora_id', importadoraId)
      .order('id')
      .range(from, from + PRODUCTS_PAGE_SIZE - 1);
    if (error) throw error;

    const rows = data ?? [];
    for (const row of rows) {
      const key = String(row.code ?? '')
        .trim()
        .toUpperCase();
      if (key && !map.has(key)) {
        map.set(key, row.id as string);
      }
    }
    if (rows.length < PRODUCTS_PAGE_SIZE) break;
    from += PRODUCTS_PAGE_SIZE;
  }

  return map;
}

export async function updateProduct(
  id: string,
  updates: UpdateProductInput
): Promise<Product> {
  assertSupabaseConfigured();

  const db = toProductUpdateRow(updates);
  const { data, error } = await supabase
    .from('products')
    .update(db)
    .eq('id', id)
    .select('*, importadoras(name)')
    .single();
  if (error) throw error;
  return mapProduct(data);
}

/**
 * Atualiza um produto sem select/join — mais rápido no upload de catálogo.
 */
export async function updateProductFast(
  id: string,
  updates: UpdateProductInput
): Promise<void> {
  assertSupabaseConfigured();

  const db = toProductUpdateRow(updates);
  if (Object.keys(db).length === 0) return;
  const { error } = await supabase.from('products').update(db).eq('id', id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

const DELETE_BY_IDS_CHUNK = 150;

export async function deleteProductsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  assertSupabaseConfigured();

  for (let i = 0; i < ids.length; i += DELETE_BY_IDS_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_BY_IDS_CHUNK);
    const { error } = await supabase.from('products').delete().in('id', chunk);
    if (error) throw error;
  }
}

export async function deleteProductsByImportadoraId(importadoraId: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('importadora_id', importadoraId);
  if (error) throw error;
}
