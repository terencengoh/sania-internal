import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from './types';
import { LIVE_MODE, SUPABASE_ANON_KEY, SUPABASE_URL, siteUrl } from './config';

export interface SessionUser {
  id: string;
  email: string;
  role: Role | null; // null = signed in but no profile (no access)
  clientId: string | null;
  demo: boolean;
}

interface Auth {
  mode: 'demo' | 'live';
  ready: boolean;
  user: SessionUser | null;
  sb: SupabaseClient | null;
  /** true after following an invite or password-reset link: user must choose a password */
  needsPassword: boolean;
  linkError: string;
  signInPassword: (email: string, password: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  demoSignIn: (role: Role, clientId?: string) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthCtx = createContext<Auth | null>(null);
const DEMO_KEY = 'sania-internal:demo-session';

// Read Supabase email-link info before anything rewrites the hash.
const initialHash = typeof window !== 'undefined' ? window.location.hash : '';
const linkType = /[#&]type=(invite|recovery|magiclink|signup)/.exec(initialHash)?.[1] ?? '';
const linkErr = /[#&]error_description=([^&]+)/.exec(initialHash)?.[1];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [needsPassword, setNeedsPassword] = useState(LIVE_MODE && (linkType === 'invite' || linkType === 'recovery'));
  const linkError = linkErr ? decodeURIComponent(linkErr.replace(/\+/g, ' ')) : '';

  const loadProfile = useCallback(async (client: SupabaseClient, id: string, email: string) => {
    const { data } = await client.from('profiles').select('role, client_id').eq('id', id).maybeSingle();
    setUser({ id, email, role: (data?.role as Role) ?? null, clientId: (data?.client_id as string) ?? null, demo: false });
  }, []);

  useEffect(() => {
    if (!LIVE_MODE) {
      try {
        const s = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
        if (s?.role) setUser({ id: `demo-${s.role}`, email: s.role === 'client' ? 'client@demo.example' : 'owner@demo.example', role: s.role, clientId: s.clientId ?? null, demo: true });
      } catch { /* ignore */ }
      setReady(true);
      return;
    }
    let unsub: (() => void) | undefined;
    (async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      setSb(client);
      const { data } = await client.auth.getSession();
      if (data.session) await loadProfile(client, data.session.user.id, data.session.user.email ?? '');
      if (/access_token|error_description/.test(window.location.hash)) window.history.replaceState(null, '', window.location.pathname + '#/');
      const { data: sub } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true);
        if (event === 'SIGNED_OUT' || !session) { setUser(null); return; }
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          // defer DB calls out of the auth callback (supabase-js recommendation)
          setTimeout(() => loadProfile(client, session.user.id, session.user.email ?? ''), 0);
        }
      });
      unsub = () => sub.subscription.unsubscribe();
      setReady(true);
    })();
    return () => unsub?.();
  }, [loadProfile]);

  const need = () => { if (!sb) throw new Error('Not connected'); return sb; };

  const value = useMemo<Auth>(() => ({
    mode: LIVE_MODE ? 'live' : 'demo',
    ready, user, sb, needsPassword, linkError,
    async signInPassword(email, password) {
      const { error } = await need().auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
    },
    async sendMagicLink(email) {
      const { error } = await need().auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: siteUrl() } });
      if (error) throw new Error(error.message);
    },
    async sendPasswordReset(email) {
      const { error } = await need().auth.resetPasswordForEmail(email, { redirectTo: siteUrl() });
      if (error) throw new Error(error.message);
    },
    async updatePassword(password) {
      if (password.length < 8) throw new Error('Use at least 8 characters.');
      const { error } = await need().auth.updateUser({ password });
      if (error) throw new Error(error.message);
      setNeedsPassword(false);
    },
    demoSignIn(role, clientId) {
      localStorage.setItem(DEMO_KEY, JSON.stringify({ role, clientId: clientId ?? null }));
      setUser({ id: `demo-${role}`, email: role === 'client' ? 'client@demo.example' : 'owner@demo.example', role, clientId: clientId ?? null, demo: true });
      window.location.hash = '#/';
    },
    async signOut() {
      if (LIVE_MODE) await sb?.auth.signOut();
      localStorage.removeItem(DEMO_KEY);
      setUser(null);
      setNeedsPassword(false);
      window.location.hash = '#/';
    },
    async refreshProfile() {
      if (sb && user && !user.demo) await loadProfile(sb, user.id, user.email);
    },
  }), [ready, user, sb, needsPassword, linkError, loadProfile]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const a = useContext(AuthCtx);
  if (!a) throw new Error('useAuth outside provider');
  return a;
}
