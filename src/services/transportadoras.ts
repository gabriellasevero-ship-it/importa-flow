import { supabase } from '@/lib/supabase';
import { mapTransportadora } from './mappers';
import type { Transportadora } from '@/types';

export async function fetchTransportadoras(): Promise<Transportadora[]> {
  const { data, error } = await supabase
    .from('transportadoras')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapTransportadora);
}

export async function getTransportadora(id: string): Promise<Transportadora | null> {
  const { data, error } = await supabase
    .from('transportadoras')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapTransportadora(data) : null;
}

export async function createTransportadora(input: {
  name: string;
  cnpj: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}): Promise<Transportadora> {
  const { data, error } = await supabase
    .from('transportadoras')
    .insert({
      name: input.name,
      cnpj: input.cnpj,
      phone: input.phone,
      cep: input.cep,
      street: input.street,
      number: input.number,
      complement: input.complement ?? null,
      neighborhood: input.neighborhood,
      city: input.city,
      state: input.state,
    })
    .select()
    .single();
  if (error) throw error;
  return mapTransportadora(data);
}

export async function updateTransportadora(
  id: string,
  updates: Partial<Omit<Transportadora, 'id' | 'createdAt'>>
): Promise<Transportadora> {
  const db: Record<string, unknown> = {};
  if (updates.name != null) db.name = updates.name;
  if (updates.cnpj != null) db.cnpj = updates.cnpj;
  if (updates.phone != null) db.phone = updates.phone;
  if (updates.cep != null) db.cep = updates.cep;
  if (updates.street != null) db.street = updates.street;
  if (updates.number != null) db.number = updates.number;
  if (updates.complement != null) db.complement = updates.complement;
  if (updates.neighborhood != null) db.neighborhood = updates.neighborhood;
  if (updates.city != null) db.city = updates.city;
  if (updates.state != null) db.state = updates.state;
  const { data, error } = await supabase
    .from('transportadoras')
    .update(db)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapTransportadora(data);
}

export async function deleteTransportadora(id: string): Promise<void> {
  const { error } = await supabase.from('transportadoras').delete().eq('id', id);
  if (error) throw error;
}
