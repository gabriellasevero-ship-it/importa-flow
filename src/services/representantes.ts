import {
  getConfiguredSupabaseHost,
  isSupabaseConfigured,
  supabase,
  syncAuthBeforeDbRead,
} from '@/lib/supabase';

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

async function fetchRepresentanteRowsByEmail(trimmed: string): Promise<DbRepresentative[]> {
  const { data: exactRows, error: exactErr } = await supabase
    .from('representantes')
    .select('*')
    .eq('email', trimmed);
  if (exactErr) throw exactErr;

  let rows = (exactRows ?? []) as DbRepresentative[];
  if (rows.length === 0) {
    const { data: ilikeRows, error: ilikeErr } = await supabase
      .from('representantes')
      .select('*')
      .ilike('email', trimmed);
    if (ilikeErr) throw ilikeErr;
    rows = (ilikeRows ?? []) as DbRepresentative[];
  }
  return rows;
}

/**
 * Pré-cadastro no backoffice (user_id nulo) ou convite por magic link: associa a linha em
 * `representantes` ao usuário autenticado quando o e-mail confere.
 */
export async function linkRepresentanteByEmailIfUnlinked(
  userId: string,
  userEmail: string
): Promise<void> {
  const trimmed = userEmail?.trim() ?? '';
  if (!trimmed || !isSupabaseConfigured()) return;

  const existing = await fetchRepresentativeByUserId(userId);
  if (existing?.id) return;

  await syncAuthBeforeDbRead();
  const rows = await fetchRepresentanteRowsByEmail(trimmed);
  if (rows.length === 0) return;

  const linkedToMe = rows.find((r) => r.user_id === userId);
  if (linkedToMe) return;

  const unlinked = rows.find((r) => !r.user_id);
  if (!unlinked) return;

  await requireAuthenticatedSessionForMutation();
  const { error: updateErr } = await supabase
    .from('representantes')
    .update({ user_id: userId })
    .eq('id', unlinked.id);
  if (updateErr) throwIfMutationDeniedByRls(updateErr);
}

/**
 * Para gerar o link do catálogo: usa `user_id`; se não houver (cadastro feito pelo admin sem vínculo),
 * localiza por e-mail igual ao do perfil e preenche `user_id` automaticamente quando a linha ainda está sem conta.
 */
export async function resolveRepresentativeForCatalogShare(
  userId: string,
  userEmail: string
): Promise<Representative | null> {
  const byUser = await fetchRepresentativeByUserId(userId);
  if (byUser?.id) return byUser;

  const trimmed = userEmail?.trim() ?? '';
  if (!trimmed) return null;

  if (!isSupabaseConfigured()) {
    return DEMO_REPRESENTATIVES.find((r) => r.userId === userId) ?? null;
  }

  await linkRepresentanteByEmailIfUnlinked(userId, trimmed);
  return fetchRepresentativeByUserId(userId);
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

function networkInviteErrorMessage(inner: string): string {
  const host = getConfiguredSupabaseHost();
  return [
    'Não foi possível conectar à Edge Function invite-representative (o pedido nem chegou ao Supabase).',
    inner ? ` Motivo técnico: ${inner}.` : '',
    host ? ` Projeto configurado: ${host}.` : '',
    ' Confirme: função deployada no painel (Edge Functions → invite-representative),',
    ' variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no build (Vercel: redeploy após alterar),',
    ' Tente de novo após o redeploy (o app usa /api/invite-representative no mesmo domínio).',
    ' Se persistir, desative bloqueadores de anúncio e confira F12 → Rede no POST para /api/invite-representative.',
  ].join('');
}

/**
 * Sempre same-origin (/api): o navegador não deve chamar *.supabase.co (CORS / x-region).
 */
function getInviteRepresentativeRequestUrl(): string {
  if (typeof window === 'undefined') {
    throw new Error('Convite por e-mail só pode ser enviado pelo navegador.');
  }
  return `${window.location.origin}/api/invite-representative`;
}

/** POST ao proxy /api (Vercel em produção; Vite proxy em dev). */
async function invokeInviteRepresentativeFetch(
  accessToken: string,
  body: { representativeId: string; siteUrl: string }
): Promise<{ ok?: boolean; error?: string }> {
  const requestUrl = getInviteRepresentativeRequestUrl();

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const inner =
      err instanceof Error ? err.message.trim() : 'Failed to fetch';
    throw new Error(networkInviteErrorMessage(inner));
  }

  const text = await response.text();
  let payload: { ok?: boolean; error?: string } | null = null;
  if (text.trim().startsWith('{')) {
    try {
      payload = JSON.parse(text) as { ok?: boolean; error?: string };
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const raw =
      payload?.error?.trim() ||
      (text.trim().startsWith('{') ? undefined : text.trim()) ||
      '';
    const msg =
      raw && raw.toLowerCase() !== 'internal server error'
        ? raw
        : `Erro HTTP ${response.status} ao enviar o convite. Faça redeploy da Edge Function invite-representative no Supabase (o painel mostra logs em Functions → invite-representative).`;
    throw new Error(msg);
  }

  return payload ?? {};
}

/**
 * Envia convite por e-mail (Edge Function): magic link para entrar sem senha obrigatória.
 * Requer função `invite-representative` deployada e template de Magic Link no painel Auth.
 */
export async function sendRepresentativeInvite(representativeId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Convite por e-mail só funciona com Supabase configurado.');
  }
  await requireAuthenticatedSessionForMutation();
  await syncAuthBeforeDbRead();

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.warn('refreshSession antes do convite:', refreshError.message);
  }

  const session = refreshData.session ?? (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    throw new Error(
      'Não foi possível obter a sessão para enviar o convite. Faça login novamente e tente de novo.'
    );
  }

  const siteUrl =
    typeof window !== 'undefined' ? window.location.origin.trim() : '';
  if (!siteUrl) {
    throw new Error('Não foi possível determinar a URL do site para o convite.');
  }

  const payload = await invokeInviteRepresentativeFetch(session.access_token, {
    representativeId,
    siteUrl,
  });

  if (payload?.error) {
    throw new Error(payload.error);
  }
  if (!payload?.ok) {
    throw new Error('Resposta inválida do servidor ao enviar o convite.');
  }
}

