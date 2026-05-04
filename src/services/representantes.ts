import { supabase, isSupabaseConfigured, syncAuthBeforeDbRead } from '@/lib/supabase';

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
  user_id: string | null;
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

function throwIfMutationDeniedByRls(error: unknown): never {
  if (error && typeof error === 'object') {
    const e = error as { code?: string; message?: string };
    const msg = (e.message ?? '').toLowerCase();
    if (
      e.code === '42501' ||
      msg.includes('row-level security') ||
      msg.includes('violates row-level security')
    ) {
      throw new Error(
        'O banco negou o salvamento (segurança em nível de linha). Confirme que está logado no sistema e que as migrations do Supabase foram aplicadas na tabela representantes (incluindo políticas para o role authenticated). No painel: SQL Editor ou supabase db push.'
      );
    }
  }
  throw error;
}

/** INSERT/UPDATE/DELETE não são permitidos como anon; SELECT pode ser (catálogo público). */
async function requireAuthenticatedSessionForMutation(): Promise<void> {
  await syncAuthBeforeDbRead();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(
      'Sessão inválida ou expirada. Para cadastrar ou editar representantes é preciso estar logado com uma conta válida. Faça login novamente e tente de novo.'
    );
  }
}

function mapRepresentative(row: DbRepresentative): Representative {
  return {
    id: row.id,
    userId: row.user_id ?? '',
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

const DEMO_REPRESENTATIVES: Representative[] = [
  {
    id: 'demo-rep-1',
    userId: 'demo-user-1',
    name: 'Representante Demo',
    email: 'representante@demo.local',
    phone: '(11) 98765-4321',
    cpf: '123.456.789-00',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
];

export async function fetchRepresentativeById(id: string): Promise<Representative | null> {
  if (!isSupabaseConfigured()) {
    return DEMO_REPRESENTATIVES.find((r) => r.id === id) ?? null;
  }
  const { data, error } = await supabase.from('representantes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapRepresentative(data as DbRepresentative) : null;
}

/** Perfil (auth) do representante logado → linha em representantes (para links do catálogo). */
export async function fetchRepresentativeByUserId(userId: string): Promise<Representative | null> {
  if (!userId) return null;
  if (!isSupabaseConfigured()) {
    return DEMO_REPRESENTATIVES.find((r) => r.userId === userId) ?? null;
  }
  const { data, error } = await supabase
    .from('representantes')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRepresentative(data as DbRepresentative) : null;
}

export async function fetchRepresentatives(): Promise<Representative[]> {
  if (!isSupabaseConfigured()) {
    return [...DEMO_REPRESENTATIVES];
  }
  await syncAuthBeforeDbRead();
  const { data, error } = await supabase
    .from('representantes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as DbRepresentative[] | null ?? []).map(mapRepresentative);
}

export async function createRepresentative(input: {
  userId?: string;
  name: string;
  email: string;
  phone: string;
  cpf?: string;
  cnpj?: string;
  company?: string;
  importerId?: string;
  status?: RepresentativeStatus;
}): Promise<Representative> {
  const uid = input.userId?.trim();
  const userIdForDb = uid && uid.length > 0 ? uid : null;

  if (!isSupabaseConfigured()) {
    return {
      id: `demo-rep-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      userId: userIdForDb ?? '',
      name: input.name,
      email: input.email,
      phone: input.phone,
      cpf: input.cpf,
      cnpj: input.cnpj,
      company: input.company,
      importerId: input.importerId,
      status: input.status ?? 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  await requireAuthenticatedSessionForMutation();
  const { data, error } = await supabase
    .from('representantes')
    .insert({
      user_id: userIdForDb,
      name: input.name,
      email: input.email,
      phone: input.phone,
      cpf: input.cpf ?? null,
      cnpj: input.cnpj ?? null,
      company: input.company ?? null,
      importer_id: input.importerId ?? null,
      status: (input.status ?? 'pending') as RepresentativeStatus,
    })
    .select()
    .single();
  if (error) throwIfMutationDeniedByRls(error);
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

  await requireAuthenticatedSessionForMutation();
  const { data, error } = await supabase
    .from('representantes')
    .update(db)
    .eq('id', id)
    .select()
    .single();
  if (error) throwIfMutationDeniedByRls(error);
  return mapRepresentative(data as DbRepresentative);
}

export async function updateRepresentativeStatus(
  id: string,
  status: RepresentativeStatus
): Promise<Representative> {
  await requireAuthenticatedSessionForMutation();
  const { data, error } = await supabase
    .from('representantes')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throwIfMutationDeniedByRls(error);
  return mapRepresentative(data as DbRepresentative);
}

export async function deleteRepresentative(id: string): Promise<void> {
  await requireAuthenticatedSessionForMutation();
  const { error } = await supabase.from('representantes').delete().eq('id', id);
  if (error) throwIfMutationDeniedByRls(error);
}

