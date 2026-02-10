import { supabase } from '@/lib/supabase';
import { mapProduct } from './mappers';
import type { Product } from '@/types';

export async function fetchProducts(filters?: {
  importadoraId?: string;
  category?: string;
  active?: boolean;
}): Promise<Product[]> {
  let q = supabase
    .from('products')
    .select('*, importadoras(name)')
    .order('name');
  if (filters?.importadoraId) q = q.eq('importadora_id', filters.importadoraId);
  if (filters?.category) q = q.eq('category', filters.category);
  if (filters?.active != null) q = q.eq('active', filters.active);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapProduct);
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

export async function createProduct(input: {
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
  material?: string;
  detalhe1?: string;
  detalhe2?: string;
  detalhe3?: string;
  dimensions?: string;
}): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
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
      material: input.material ?? null,
      detalhe1: input.detalhe1 ?? null,
      detalhe2: input.detalhe2 ?? null,
      detalhe3: input.detalhe3 ?? null,
      dimensions: input.dimensions ?? null,
    })
    .select('*, importadoras(name)')
    .single();
  if (error) throw error;
  return mapProduct(data);
}

export async function updateProduct(
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    price: number;
    minOrder: number;
    category: string;
    subcategory: string;
    image: string;
    observations: string;
    active: boolean;
    material: string;
    detalhe1: string;
    detalhe2: string;
    detalhe3: string;
    dimensions: string;
  }>
): Promise<Product> {
  const db: Record<string, unknown> = {};
  if (updates.name != null) db.name = updates.name;
  if (updates.description != null) db.description = updates.description;
  if (updates.price != null) db.price = updates.price;
  if (updates.minOrder != null) db.min_order = updates.minOrder;
  if (updates.category != null) db.category = updates.category;
  if (updates.subcategory != null) db.subcategory = updates.subcategory;
  if (updates.image != null) db.image = updates.image;
  if (updates.observations != null) db.observations = updates.observations;
  if (updates.active != null) db.active = updates.active;
  if (updates.material != null) db.material = updates.material;
  if (updates.detalhe1 != null) db.detalhe1 = updates.detalhe1;
  if (updates.detalhe2 != null) db.detalhe2 = updates.detalhe2;
  if (updates.detalhe3 != null) db.detalhe3 = updates.detalhe3;
  if (updates.dimensions != null) db.dimensions = updates.dimensions;
  const { data, error } = await supabase
    .from('products')
    .update(db)
    .eq('id', id)
    .select('*, importadoras(name)')
    .single();
  if (error) throw error;
  return mapProduct(data);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}
