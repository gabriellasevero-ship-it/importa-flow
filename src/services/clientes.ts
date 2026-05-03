import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapCliente, toDbCliente, type DbCliente } from './mappers';
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

/**
 * Cadastro pelo catálogo público (usuário anon). `representanteRowId` é `representantes.id`;
 * a RPC grava `clientes.representante_id` como `representantes.user_id` (profiles).
 */
export async function registerClienteViaCatalogo(
  representanteRowId: string,
  input: {
    name: string;
    phone: string;
    email?: string;
    businessName?: string;
    cnpj?: string;
    cep?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  }
): Promise<Cliente> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado.');
  }
  const { data, error } = await supabase.rpc('register_cliente_catalogo', {
    p_representante_row_id: representanteRowId,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email ?? null,
    p_business_name: input.businessName ?? null,
    p_cnpj: input.cnpj ?? null,
    p_cep: input.cep ?? null,
    p_street: input.street ?? null,
    p_number: input.number ?? null,
    p_complement: input.complement ?? null,
    p_neighborhood: input.neighborhood ?? null,
    p_city: input.city ?? null,
    p_state: input.state ?? null,
  });
  if (error) throw error;

  const raw = Array.isArray(data) ? data[0] : data;
  if (raw == null) {
    throw new Error('Resposta vazia ao cadastrar cliente. Confira se a função no Supabase retorna jsonb (migration 010 atualizada).');
  }
  const row =
    typeof raw === 'string'
      ? (JSON.parse(raw) as Record<string, unknown>)
      : (raw as Record<string, unknown>);
  return mapCliente(row as unknown as DbCliente);
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
