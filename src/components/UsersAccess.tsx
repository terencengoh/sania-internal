import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { useStore } from '../store';
import { cancelInvitation, inviteUser, listInvitations, listProfiles, removeAccess, updateProfile, type Invitation, type Profile } from '../backend/admin';
import { Badge, Field, Modal, Select, Text, confirmDo } from './ui';
import { fmtDate } from '../utils';

/** Invite a client user (any staff) or a staff user (owner only). */
export function InviteModal({ onClose, clientId: fixedClient, defaultEmail = '', onDone }: { onClose: () => void; clientId?: string; defaultEmail?: string; onDone?: () => void }) {
  const auth = useAuth();
  const { data } = useStore();
  const [email, setEmail] = useState(defaultEmail);
  const [role, setRole] = useState<'client' | 'staff'>('client');
  const [clientId, setClientId] = useState(fixedClient ?? data.clients[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const isOwner = auth.user?.role === 'owner';
  const send = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      if (auth.mode === 'demo' || !auth.sb) {
        setMsg(`Demo mode: nothing was sent. With Supabase connected, ${email} would get an invite email and could only see ${role === 'client' ? (data.clients.find((c) => c.id === clientId)?.company ?? 'their company') : 'the staff app'}.`);
      } else {
        const r = await inviteUser(auth.sb, { email, role, clientId: role === 'client' ? clientId : undefined });
        setMsg(r.message);
        onDone?.();
      }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && (role === 'staff' || !!clientId);
  return (
    <Modal title={fixedClient ? 'Invite client user' : 'Invite a user'} onClose={onClose}>
      <p className="muted small">Access is invite-only. A client user can sign in to the Client Portal and see only their own company's campaigns, sent/paid invoices and published reports.</p>
      <div className="form-grid">
        <Field label="Email" full><Text type="email" value={email} onChange={setEmail} placeholder="name@company.com" autoFocus /></Field>
        {!fixedClient && isOwner && <Field label="Role"><Select value={role} onChange={(v) => setRole(v as 'client' | 'staff')} options={[{ value: 'client', label: 'Client (portal)' }, { value: 'staff', label: 'Staff (full internal app)' }]} /></Field>}
        {role === 'client' && !fixedClient && <Field label="Client company"><Select value={clientId} onChange={setClientId} options={data.clients.map((c) => ({ value: c.id, label: c.company }))} /></Field>}
      </div>
      {err && <p className="warn-text small" role="alert">{err}</p>}
      {msg && <p className="notice small" role="status">{msg}</p>}
      <div className="modal-foot"><span className="spacer" /><button className="btn" onClick={onClose}>{msg ? 'Close' : 'Cancel'}</button>
        <button className="btn primary" disabled={!valid || busy} onClick={send}>{busy ? 'Sending…' : auth.mode === 'demo' ? 'Invite (demo — sends nothing)' : 'Send invite'}</button></div>
    </Modal>
  );
}

export function UsersAccess() {
  const auth = useAuth();
  const { data } = useStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [err, setErr] = useState('');
  const [inviting, setInviting] = useState(false);
  const isOwner = auth.user?.role === 'owner';
  const clientLabel = (id: string | null) => data.clients.find((c) => c.id === id)?.company ?? '—';

  const refresh = useCallback(async () => {
    if (!auth.sb) return;
    try { setProfiles(await listProfiles(auth.sb)); setInvites(await listInvitations(auth.sb)); setErr(''); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, [auth.sb]);
  useEffect(() => { refresh(); }, [refresh]);

  const act = async (fn: () => Promise<void>) => { try { await fn(); await refresh(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };

  if (auth.mode === 'demo') {
    return (
      <section className="card">
        <h3>Users &amp; access</h3>
        <p className="notice small"><strong>Demo mode:</strong> there are no real user accounts. The login page lets anyone enter as “Demo staff” or “Demo client”. Real email + password logins, roles (owner / staff / client) and invite-only client access turn on when Supabase is connected — see <code>SETUP.md</code>.</p>
        <table className="table compact-table">
          <thead><tr><th>Demo user</th><th>Role</th><th>Sees</th></tr></thead>
          <tbody>
            <tr><td>owner@demo.example</td><td><Badge>owner</Badge></td><td>Everything (internal app)</td></tr>
            {data.clients.map((c) => <tr key={c.id}><td>client@demo.example</td><td><Badge>client</Badge></td><td>{c.company} only (portal)</td></tr>)}
          </tbody>
        </table>
        <button className="btn" onClick={() => setInviting(true)}>Invite user (demo)</button>
        {inviting && <InviteModal onClose={() => setInviting(false)} />}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-head"><h3>Users &amp; access</h3><button className="btn primary" onClick={() => setInviting(true)}>+ Invite user</button></div>
      {!isOwner && <p className="muted small">Only the owner can change roles or remove access. Staff can invite client users.</p>}
      {err && <p className="warn-text small">{err}</p>}
      <table className="table compact-table">
        <thead><tr><th>Email</th><th>Role</th><th>Client</th><th>Since</th><th /></tr></thead>
        <tbody>
          {profiles.map((p) => {
            const me = p.id === auth.user?.id;
            return (
              <tr key={p.id}>
                <td>{p.email}{me ? ' (you)' : ''}</td>
                <td>{isOwner && !me ? (
                  <select value={p.role} onChange={(e) => act(() => updateProfile(auth.sb!, p.id, { role: e.target.value as Profile['role'] }))}>
                    <option value="owner">owner</option><option value="staff">staff</option><option value="client">client</option>
                  </select>) : <Badge>{p.role}</Badge>}</td>
                <td>{p.role === 'client' ? (isOwner ? (
                  <select value={p.client_id ?? ''} onChange={(e) => act(() => updateProfile(auth.sb!, p.id, { client_id: e.target.value || null }))}>
                    <option value="">— no access —</option>
                    {data.clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
                  </select>) : clientLabel(p.client_id)) : 'All (staff)'}</td>
                <td>{fmtDate(p.created_at)}</td>
                <td>{isOwner && !me && <button className="link danger" onClick={() => confirmDo(`Remove ${p.email}'s access? They will no longer see any data.`, () => act(() => removeAccess(auth.sb!, p.id)))}>remove</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {invites.length > 0 && (
        <>
          <h4>Pending invitations</h4>
          <ul className="list compact">
            {invites.map((i) => (
              <li key={i.id}><span>{i.email} <Badge>{i.role}</Badge> {i.role === 'client' && <span className="muted small">{clientLabel(i.client_id)}</span>}</span>
                <span><span className="muted small">{fmtDate(i.created_at)}</span> <button className="link danger" onClick={() => act(() => cancelInvitation(auth.sb!, i.id))}>cancel</button></span></li>
            ))}
          </ul>
        </>
      )}
      {inviting && <InviteModal onClose={() => setInviting(false)} onDone={refresh} />}
    </section>
  );
}
