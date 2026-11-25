/* Live-mode user administration (profiles, invitations). All calls run under the signed-in user's
   session, so Row Level Security decides what is allowed (owner vs staff). */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '../types';
import { siteUrl } from '../config';

export interface Profile { id: string; email: string; full_name: string; role: Role; client_id: string | null; created_at: string }
export interface Invitation { id: string; email: string; role: 'staff' | 'client'; client_id: string | null; created_at: string; accepted_at: string | null }

export interface InviteResult { emailSent: boolean; message: string }

export async function inviteUser(sb: SupabaseClient, input: { email: string; role: 'staff' | 'client'; clientId?: string }): Promise<InviteResult> {
  const email = input.email.trim().toLowerCase();
  const { data, error } = await sb.functions.invoke('invite-user', { body: { email, role: input.role, clientId: input.clientId ?? null, redirectTo: siteUrl() } });
  if (!error && data?.ok) return { emailSent: true, message: `Invite email sent to ${email}.` };

  // Edge Function returned a readable error (e.g. "already has an account")
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.status === 'number' && ctx.status !== 404) {
    let msg = error?.message ?? 'Invite failed';
    try { msg = (await ctx.json()).error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  // Function not deployed: record the invitation so the role is applied when the owner
  // sends the invite from the Supabase dashboard.
  await sb.from('invitations').delete().ilike('email', email).is('accepted_at', null);
  const { error: insErr } = await sb.from('invitations').insert({ email, role: input.role, client_id: input.role === 'client' ? input.clientId : null });
  if (insErr) throw new Error(insErr.message);
  return {
    emailSent: false,
    message: `Invitation saved for ${email}, but the invite-user function isn't deployed, so no email was sent. Send it from Supabase → Authentication → Users → "Invite user" with the same email (see SETUP.md).`,
  };
}

export async function listProfiles(sb: SupabaseClient): Promise<Profile[]> {
  const { data, error } = await sb.from('profiles').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}
export async function listInvitations(sb: SupabaseClient): Promise<Invitation[]> {
  const { data, error } = await sb.from('invitations').select('*').is('accepted_at', null).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Invitation[];
}
export async function updateProfile(sb: SupabaseClient, id: string, patch: { role?: Role; client_id?: string | null; full_name?: string }) {
  const { data, error } = await sb.from('profiles').update(patch).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('Not allowed (only the owner can change access).');
}
export async function removeAccess(sb: SupabaseClient, id: string) {
  const { error } = await sb.from('profiles').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
export async function cancelInvitation(sb: SupabaseClient, id: string) {
  const { error } = await sb.from('invitations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
