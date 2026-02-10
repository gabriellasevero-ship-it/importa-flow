import { supabase } from '@/lib/supabase';
import { mapCategory } from './mappers';
import type { Category } from '@/types';

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapCategory);
}

export async function createCategory(input: {
  name: string;
  subcategories?: string[];
}): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: input.name,
      subcategories: input.subcategories ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  return mapCategory(data);
}
