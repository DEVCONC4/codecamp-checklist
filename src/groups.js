// Groups — the one thing on the facilitator side that writes.
//
// The desk is otherwise a read: it queries the room and says where to walk.
// Which group somebody is in is the exception, and it is here rather than in
// facilitator.js so that the exception stays one small named module instead of
// leaking into a file whose whole point is that it does not mutate anything.
//
// RLS does the real gatekeeping — groups_insert/update/delete all require
// is_facilitator(), and freeze_group() stops a participant moving themselves.
// Nothing below is a permission check; it is just the four verbs.
import { supabase } from './supabase.js';

// Ordered by code rather than by name, because the code is what is stable: a
// group can be renamed mid-camp and everyone's mental index of the list should
// not reshuffle underneath them.
export async function listGroups() {
  const { data, error } = await supabase.from('groups').select('*').order('code');
  if (error) throw error;
  return data || [];
}

// The code is not sent — the column default generates it, so it is one round
// trip and there is no window where two facilitators pick the same one.
export async function createGroup(name) {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name: String(name || '').trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameGroup(id, name) {
  const { error } = await supabase
    .from('groups')
    .update({ name: String(name || '').trim() })
    .eq('id', id);
  if (error) throw error;
}

// The foreign key is `on delete set null`, so members survive this and simply
// stop having a group. Nobody disappears from the roster.
export async function deleteGroup(id) {
  const { error } = await supabase.from('groups').delete().eq('id', id);
  if (error) throw error;
}

// `groupId` may be null, which is how somebody leaves a group without joining
// another one.
export async function assignGroup(userId, groupId) {
  const { error } = await supabase
    .from('profiles')
    .update({ group_id: groupId || null })
    .eq('id', userId);
  if (error) throw error;
}
