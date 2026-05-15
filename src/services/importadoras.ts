import { supabase, isSupabaseConfigured, syncAuthBeforeDbRead } from '@/lib/supabase';
import { mapImportadora } from './mappers';
import type { Importadora } from '@/types';

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
  if (error) throw error;
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
  if (error) throw error;
  return mapImportadora(data);
}

export async function deleteImportadora(id: string): Promise<void> {
  const { error } = await supabase.from('importadoras').delete().eq('id', id);
  if (error) throw error;
}
