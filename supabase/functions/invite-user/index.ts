// Supabase Edge Function: invite-user
// Staff call this from the app to invite a client user (or, owner only, a staff user).
// It records the invitation (which decides the role on sign-up) and asks Supabase Auth to
// email an invite link. The service-role key stays server-side in this function.
//
// Deploy:  npx supabase functions deploy invite-user
// Env (set automatically by Supabase): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Optional secret: SITE_URL (where the invite link should land, e.g. https://terencengoh.github.io/sania-internal/)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // 1) Who is calling? Use their JWT so RLS applies to the invitation insert.
  const asCaller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Not signed in' }, 401);
  const { data: me } = await asCaller.from('profiles').select('role').eq('id', userData.user.id).single();
  if (!me || (me.role !== 'owner' && me.role !== 'staff')) return json({ error: 'Only SANIA staff can invite users' }, 403);

  let body: { email?: string; role?: string; clientId?: string | null; redirectTo?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = body.role === 'staff' ? 'staff' : 'client';
  const clientId = role === 'client' ? String(body.clientId ?? '') : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'Enter a valid email' }, 400);
  if (role === 'client' && !clientId) return json({ error: 'Pick the client this user belongs to' }, 400);
  if (role === 'staff' && me.role !== 'owner') return json({ error: 'Only the owner can invite staff' }, 403);

  // 2) Record the invitation as the caller (RLS enforces who may invite what).
  await asCaller.from('invitations').delete().ilike('email', email).is('accepted_at', null);
  const { error: invErr } = await asCaller.from('invitations').insert({ email, role, client_id: clientId, invited_by: userData.user.id });
  if (invErr) return json({ error: invErr.message }, 400);

  // 3) Send the invite email (service role, server-side only).
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const redirectTo = Deno.env.get('SITE_URL') || body.redirectTo || undefined;
  const { error: sendErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (sendErr) {
    const exists = /already been registered|already exists/i.test(sendErr.message);
    return json({
      error: exists
        ? 'That email already has an account. The owner can link it under Settings → Users & access.'
        : sendErr.message,
    }, 400);
  }
  return json({ ok: true, email, role, clientId });
});
