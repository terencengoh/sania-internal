import { StrictMode, useMemo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Portal from './pages/Portal';
import { LoginPage, NoAccessPage, SetPasswordPage } from './pages/Login';
import { AuthProvider, useAuth } from './auth';
import { StoreProvider } from './store';
import { localBackend } from './backend/local';
import { supabaseBackend } from './backend/supabase';
import './styles.css';

/** Chooses login / staff app / client portal from the signed-in user's role. */
function Gate() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  if (user.role === 'client') return <Portal />;
  return <App />;
}

function Root() {
  const auth = useAuth();
  const { sb, user } = auth;
  const live = useMemo(() => (sb ? supabaseBackend(sb) : null), [sb]);
  let body: ReactNode;
  if (!auth.ready) body = <div className="center-screen muted">Loading…</div>;
  else if (auth.mode === 'demo') {
    body = <StoreProvider backend={localBackend} readOnly={user?.role === 'client'}><Gate /></StoreProvider>;
  } else if (!user) body = <LoginPage />;
  else if (auth.needsPassword) body = <SetPasswordPage />;
  else if (!user.role || (user.role === 'client' && !user.clientId)) body = <NoAccessPage />;
  else body = <StoreProvider key={user.id} backend={live!} readOnly={user.role === 'client'}><Gate /></StoreProvider>;
  return body;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
);
