import { supabase, isSupabaseConfigured, syncAuthBeforeDbRead } from '@/lib/supabase';
import { mapImportadora } from './mappers';
import type { Importadora } from '@/types';

function supabaseUserMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    const o = err as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [o.message, o.details, o.hint].filter(
      (x) => typeof x === 'string' && (x as string).trim()
    ) as string[];
    if (parts.length) return parts.join(' — ');
  }
  return 'Erro desconhecido ao falar com o servidor.';
}

function isMissingRepresentanteCommissionColumn(err: unknown): boolean {
  const msg = supabaseUserMessage(err).toLowerCase();
  if (!msg.includes('representante_commission')) return false;
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find') ||
    msg.includes('unknown') ||
    msg.includes('column')
  );
}

/** Mesmo padrão de representantes.ts: sem .env o SELECT falha no host placeholder; evita lista vazia no backoffice/demo. */
const DEMO_IMPORTADORAS: Importadora[] = [
  {
    id: 'demo-importadora-1',
    name: 'Importadora Demo',
    cnpj: '12.345.678/0001-90',
    representanteCommissionPct: 5,
    active: true,
    createdAt: new Date(),
  },
];

export async function fetchImportadoras(): Promise<Importadora[]> {
  if (!isSupabaseConfigured()) {
    return DEMO_IMPORTADORAS;
  }
  await syncAuthBeforeDbRead();
  const { data, error } = await supabase
    .from('importadoras')
    .select('*')
    .order('name');
  if (error) throw new Error(supabaseUserMessage(error));
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
    throw new Error(supabaseUserMessage(error));
  }
  return data ? mapImportadora(data) : null;
}

export async function createImportadora(input: {
  name: string;
  cnpj: string;
  representanteCommissionPct?: number;
  logo?: string;
  active?: boolean;
}): Promise<Importadora> {
  const { data, error } = await supabase
    .from('importadoras')
    .insert({
      name: input.name,
      cnpj: input.cnpj,
      representante_commission_pct: input.representanteCommissionPct ?? 0,
      logo: input.logo ?? null,
      active: input.active ?? true,
    })
    .select()
    .single();
  if (error) {
    let msg = supabaseUserMessage(error);
    if (isMissingRepresentanteCommissionColumn(error)) {
      msg =
        'A coluna de comissão ainda não existe no Supabase. Rode o SQL da migration 016 (arquivo supabase/migrations/016_importadora_representante_commission_pct.sql) no SQL Editor e aguarde ~1 minuto. Detalhe: ' +
        msg;
    }
    throw new Error(msg);
  }
  return mapImportadora(data);
}

export async function updateImportadora(
  id: string,
  updates: Partial<{
    name: string;
    cnpj: string;
    representanteCommissionPct: number;
    logo: string;
    active: boolean;
  }>
): Promise<Importadora> {
  const db: Record<string, unknown> = {};
  if (updates.name != null) db.name = updates.name;
  if (updates.cnpj != null) db.cnpj = updates.cnpj;
  if (updates.representanteCommissionPct !== undefined) {
    db.representante_commission_pct = updates.representanteCommissionPct;
  }
  if (updates.logo !== undefined) db.logo = updates.logo;
  if (updates.active !== undefined) db.active = updates.active;

  const { data, error } = await supabase
    .from('importadoras')
    .update(db)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    let msg = supabaseUserMessage(error);
    if (isMissingRepresentanteCommissionColumn(error)) {
      msg =
        'A coluna de comissão ainda não existe no Supabase. Rode o SQL da migration 016 (arquivo supabase/migrations/016_importadora_representante_commission_pct.sql) no SQL Editor e aguarde ~1 minuto. Detalhe: ' +
        msg;
    }
    throw new Error(msg);
  }
  return mapImportadora(data);
}

export async function deleteImportadora(id: string): Promise<void> {
  const { error } = await supabase.from('importadoras').delete().eq('id', id);
  if (error) throw new Error(supabaseUserMessage(error));
}
