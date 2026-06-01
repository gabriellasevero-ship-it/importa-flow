import { supabase } from '@/lib/supabase';

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

export async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: NotificationRow) => ({
    ...row,
    createdAt: new Date(row.created_at),
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function createNotification(input: {
  userId: string;
  title: string;
  body?: string;
}): Promise<NotificationRow> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: input.userId,
      title: input.title,
      body: input.body ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
