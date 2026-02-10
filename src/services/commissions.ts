import { supabase } from '@/lib/supabase';
import { mapCommission } from './mappers';
import type { Commission } from '@/types';

export async function fetchCommissions(representanteId: string): Promise<Commission[]> {
  const { data, error } = await supabase
    .from('commissions')
    .select('*')
    .eq('representante_id', representanteId);
  if (error) throw error;
  return (data ?? []).map(mapCommission);
}

export async function upsertCommission(input: {
  representanteId: string;
  importadoraId: string;
  percentage: number;
  isExclusive?: boolean;
}): Promise<Commission> {
  const { data, error } = await supabase
    .from('commissions')
    .upsert(
      {
        representante_id: input.representanteId,
        importadora_id: input.importadoraId,
        percentage: input.percentage,
        is_exclusive: input.isExclusive ?? false,
      },
      { onConflict: ['representante_id', 'importadora_id'] }
    )
    .select()
    .single();
  if (error) throw error;
  return mapCommission(data);
}

export async function deleteCommission(id: string): Promise<void> {
  const { error } = await supabase.from('commissions').delete().eq('id', id);
  if (error) throw error;
}
