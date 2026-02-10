import { supabase } from '@/lib/supabase';
import { mapImportadora } from './mappers';
import type { Importadora } from '@/types';

export async function fetchImportadoras(): Promise<Importadora[]> {
  const { data, error } = await supabase
    .from('importadoras')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapImportadora);
}

export async function getImportadora(id: string): Promise<Importadora | null> {
  const { data, error } = await supabase
    .from('importadoras')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapImportadora(data) : null;
}

export async function createImportadora(input: {
  name: string;
  cnpj: string;
  logo?: string;
  active?: boolean;
}): Promise<Importadora> {
  const { data, error } = await supabase
    .from('importadoras')
    .insert({
      name: input.name,
      cnpj: input.cnpj,
      logo: input.logo ?? null,
      active: input.active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return mapImportadora(data);
}

export async function updateImportadora(
  id: string,
  updates: Partial<{ name: string; cnpj: string; logo: string; active: boolean }>
): Promise<Importadora> {
  const { data, error } = await supabase
    .from('importadoras')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapImportadora(data);
}

export async function deleteImportadora(id: string): Promise<void> {
  const { error } = await supabase.from('importadoras').delete().eq('id', id);
  if (error) throw error;
}
