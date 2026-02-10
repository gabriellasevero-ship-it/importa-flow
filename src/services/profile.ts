import { supabase } from '@/lib/supabase';
import { mapProfile } from './mappers';

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function updateProfile(
  userId: string,
  updates: { name?: string; phone?: string; avatar_url?: string; role?: 'representante' | 'admin' }
) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...(updates.name != null && { name: updates.name }),
      ...(updates.phone != null && { phone: updates.phone }),
      ...(updates.avatar_url != null && { avatar_url: updates.avatar_url }),
      ...(updates.role != null && { role: updates.role }),
    })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}
