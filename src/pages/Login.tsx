import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../auth';
import { useStore } from '../store';
import { DemoTag } from '../components/ui';

function AuthShell({ children, demo }: { children: ReactNode; demo?: boolean }) {
  return (
    <div className="auth-screen">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-logo"><img src="./favicon.svg" alt="" width={52} height={52} /><div><strong>SANIA</strong><span>Growth Partner</span></div></div>
          <h1>Operations &amp; client portal</h1>
          <p>Leads, campaigns, invoices and monthly reports for SANIA's HVAC clients — in one place.</p>
          <ul>
            <li>Team: pipeline, delivery board, billing, reporting</li>
            <li>Clients: campaign progress, invoices, published reports</li>
          </ul>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          {demo && <div className="auth-demo-flag">DEMO MODE — not real security</div>}
          {children}
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const auth = useAuth();
  return auth.mode === 'demo' ? <DemoLogin /> : <LiveLogin />;
}

function DemoLogin() {
  const { demoSignIn } = useAuth();
  const { data } = useStore();
  const [clientId, setClientId] = useState(data.clients[0]?.id ?? '');
  return (
    <AuthShell demo>
      <h2>Sign in (demo)</h2>
      <p className="notice small">
        This copy of the app isn't connected to a database, so there are <strong>no real accounts or passwords</strong>.
        Anyone who opens this page can enter either view below, and all data stays in <strong>this browser only</strong>.
        Real logins turn on once Supabase is connected (see SETUP.md in the repo).
      </p>
      <button className="btn primary block" onClick={() => demoSignIn('owner')}>Enter as Demo staff (owner)</button>
      <div className="auth-or"><span>or preview the client portal</span></div>
      {data.clients.length ? (
        <>
          <label className="field">
            <span>Client to view as</span>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {data.clients.map((c) => <option key={c.id} value={c.id}>{c.company}{c.demo ? ' (demo)' : ''}</option>)}
            </select>
          </label>
          <button className="btn block" disabled={!clientId} onClick={() => demoSignIn('client', clientId)}>Enter as Demo client</button>
          {data.clients.find((c) => c.id === clientId)?.demo && <p className="muted small">Viewing a fictional client <DemoTag show /></p>}
        </>
      ) : <p className="muted small">Add a client as staff first to preview the client portal.</p>}
    </AuthShell>
  );
}

function LiveLogin() {
  const auth = useAuth();
  const [mode, setMode] = useState<'password' | 'magic' | 'reset'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState(auth.linkError);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(''); setMsg('');
    try {
      if (mode === 'password') await auth.signInPassword(email.trim(), password);
      else if (mode === 'magic') { await auth.sendMagicLink(email.trim()); setMsg('If that email has access, a sign-in link is on its way. Check your inbox.'); }
      else { await auth.sendPasswordReset(email.trim()); setMsg('If that email has an account, a password-reset link is on its way.'); }
    } catch (e2) {
      const m = e2 instanceof Error ? e2.message : String(e2);
      setErr(/failed to fetch|network/i.test(m) ? "Couldn't reach the login server. Check your connection and try again." : m);
    } finally { setBusy(false); }
  };

  return (
    <AuthShell>
      <h2>{mode === 'reset' ? 'Reset your password' : 'Sign in'}</h2>
      <form onSubmit={submit} className="auth-form">
        <label className="field"><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
        {mode === 'password' && (
          <label className="field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        )}
        {err && <p className="warn-text small" role="alert">{err}</p>}
        {msg && <p className="green-text small" role="status">{msg}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'password' ? 'Sign in' : mode === 'magic' ? 'Email me a sign-in link' : 'Send reset link'}
        </button>
      </form>
      <div className="auth-links">
        {mode !== 'password' && <button className="link" onClick={() => setMode('password')}>Sign in with password</button>}
        {mode !== 'magic' && <button className="link" onClick={() => setMode('magic')}>Email me a sign-in link instead</button>}
        {mode !== 'reset' && <button className="link" onClick={() => setMode('reset')}>Forgot password?</button>}
      </div>
      <p className="muted small">Access is by invitation only. Clients: use the invite email SANIA sent you. No account? Contact SANIA Growth Partner.</p>
    </AuthShell>
  );
}

export function SetPasswordPage() {
  const auth = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { setErr("Passwords don't match."); return; }
    setBusy(true); setErr('');
    try { await auth.updatePassword(pw); } catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); } finally { setBusy(false); }
  };
  return (
    <AuthShell>
      <h2>Choose your password</h2>
      <p className="muted small">Signed in as {auth.user?.email}. Set a password to finish setting up your account.</p>
      <form onSubmit={submit} className="auth-form">
        <label className="field"><span>New password (8+ characters)</span><input type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></label>
        <label className="field"><span>Repeat password</span><input type="password" autoComplete="new-password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        {err && <p className="warn-text small" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </AuthShell>
  );
}

export function NoAccessPage() {
  const auth = useAuth();
  return (
    <AuthShell>
      <h2>No access yet</h2>
      <p>You're signed in as <strong>{auth.user?.email}</strong>, but this account hasn't been given access{auth.user?.role === 'client' ? ' to a client account' : ''}.</p>
      <p className="muted small">Ask SANIA Growth Partner to invite or link your email.</p>
      <button className="btn block" onClick={() => auth.signOut()}>Sign out</button>
    </AuthShell>
  );
}
