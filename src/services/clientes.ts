import { supabase } from '@/lib/supabase';
import { mapCliente, toDbCliente } from './mappers';
import type { Cliente } from '@/types';

export async function fetchClientes(representanteId: string): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('representante_id', representanteId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapCliente);
}

export async function getCliente(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapCliente(data) : null;
}

export async function createCliente(
  input: Partial<Cliente> & { representanteId: string; name: string; phone: string }
): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .insert(toDbCliente(input))
    .select()
    .single();
  if (error) throw error;
  return mapCliente(data);
}

export async function updateCliente(
  id: string,
  updates: Partial<Omit<Cliente, 'id' | 'representanteId' | 'createdAt'>>
): Promise<Cliente> {
  const db: Record<string, unknown> = {};
  if (updates.name != null) db.name = updates.name;
  if (updates.businessName != null) db.business_name = updates.businessName;
  if (updates.cnpj != null) db.cnpj = updates.cnpj;
  if (updates.stateRegistration != null) db.state_registration = updates.stateRegistration;
  if (updates.email != null) db.email = updates.email;
  if (updates.phone != null) db.phone = updates.phone;
  if (updates.cep != null) db.cep = updates.cep;
  if (updates.street != null) db.street = updates.street;
  if (updates.number != null) db.number = updates.number;
  if (updates.complement != null) db.complement = updates.complement;
  if (updates.neighborhood != null) db.neighborhood = updates.neighborhood;
  if (updates.city != null) db.city = updates.city;
  if (updates.state != null) db.state = updates.state;
  const { data, error } = await supabase
    .from('clientes')
    .update(db)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapCliente(data);
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from('clientes').delete().eq('id', id);
  if (error) throw error;
}
