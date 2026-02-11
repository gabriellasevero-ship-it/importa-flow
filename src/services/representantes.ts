import { supabase } from '@/lib/supabase';

export type RepresentativeStatus = 'active' | 'pending' | 'suspended';

export interface Representative {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  cpf?: string;
  cnpj?: string;
  company?: string;
  importerId?: string;
  status: RepresentativeStatus;
  createdAt: string;
  totalSales?: number;
}

type DbRepresentative = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string | null;
  cnpj: string | null;
  company: string | null;
  importer_id: string | null;
  status: RepresentativeStatus;
  total_sales: number | null;
  created_at: string;
};

function mapRepresentative(row: DbRepresentative): Representative {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    cpf: row.cpf ?? undefined,
    cnpj: row.cnpj ?? undefined,
    company: row.company ?? undefined,
    importerId: row.importer_id ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    totalSales: row.total_sales ?? undefined,
  };
}

export async function fetchRepresentatives(): Promise<Representative[]> {
  const { data, error } = await supabase
    .from('representantes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as DbRepresentative[] | null ?? []).map(mapRepresentative);
}

export async function createRepresentative(input: {
  userId: string;
  name: string;
  email: string;
  phone: string;
  cpf?: string;
  cnpj?: string;
  company?: string;
  importerId?: string;
}): Promise<Representative> {
  const { data, error } = await supabase
    .from('representantes')
    .insert({
      user_id: input.userId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      cpf: input.cpf ?? null,
      cnpj: input.cnpj ?? null,
      company: input.company ?? null,
      importer_id: input.importerId ?? null,
      status: 'pending' as RepresentativeStatus,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepresentative(data as DbRepresentative);
}

export async function updateRepresentative(
  id: string,
  updates: Partial<Omit<Representative, 'id' | 'userId' | 'createdAt'>>
): Promise<Representative> {
  const db: Record<string, unknown> = {};
  if (updates.name != null) db.name = updates.name;
  if (updates.email != null) db.email = updates.email;
  if (updates.phone != null) db.phone = updates.phone;
  if (updates.cpf !== undefined) db.cpf = updates.cpf ?? null;
  if (updates.cnpj !== undefined) db.cnpj = updates.cnpj ?? null;
  if (updates.company !== undefined) db.company = updates.company ?? null;
  if (updates.importerId !== undefined) db.importer_id = updates.importerId ?? null;
  if (updates.status != null) db.status = updates.status;
  if (updates.totalSales !== undefined) db.total_sales = updates.totalSales ?? null;

  const { data, error } = await supabase
    .from('representantes')
    .update(db)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapRepresentative(data as DbRepresentative);
}

export async function updateRepresentativeStatus(
  id: string,
  status: RepresentativeStatus
): Promise<Representative> {
  const { data, error } = await supabase
    .from('representantes')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapRepresentative(data as DbRepresentative);
}

export async function deleteRepresentative(id: string): Promise<void> {
  const { error } = await supabase.from('representantes').delete().eq('id', id);
  if (error) throw error;
}

