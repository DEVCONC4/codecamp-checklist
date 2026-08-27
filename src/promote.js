// Promoting a participant to facilitator.
//
// One call, and deliberately thin: the passphrase is not compared here. It is
// posted to `promote_to_facilitator`, which checks it inside the database —
// see 0008. Nothing in this file is a permission check, and there is no copy
// of the word in the bundle to read out of devtools.
//
// The messages come back from the RPC too ("That passphrase is not right."),
// so the desk can show what Postgres said rather than guessing at it.
import { supabase } from './supabase.js';

export async function promoteToFacilitator(userId, passphrase) {
  const { data, error } = await supabase.rpc('promote_to_facilitator', {
    target: userId,
    passphrase: String(passphrase || ''),
  });
  if (error) throw error;
  return data;
}
