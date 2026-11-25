import { useState } from 'react';
import { useRoute } from './router';
import { useStore } from './store';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Clients, { ClientDetail } from './pages/Clients';
import Campaigns from './pages/Campaigns';
import Tasks from './pages/Tasks';
import Invoices, { InvoiceEditor } from './pages/Invoices';
import Revenue from './pages/Revenue';
import Reports, { ReportEditor } from './pages/Reports';
import SettingsPage from './pages/Settings';
import { today } from './utils';
import { useAuth } from './auth';

const NAV = [
  { path: '', label: 'Dashboard', icon: '◧' },
  { group: 'Sales' },
  { path: 'leads', label: 'Leads & pipeline', icon: '◎' },
  { path: 'clients', label: 'Clients', icon: '◉' },
  { group: 'Delivery' },
  { path: 'campaigns', label: 'Campaigns', icon: '◆' },
  { path: 'tasks', label: 'Task board', icon: '▤' },
  { group: 'Money' },
  { path: 'invoices', label: 'Invoices', icon: '▭' },
  { path: 'revenue', label: 'Revenue', icon: '▲' },
  { path: 'reports', label: 'Client reports', icon: '▦' },
  { group: '' },
  { path: 'settings', label: 'Settings & backup', icon: '⚙' },
] as const;

export default function App() {
  const { parts } = useRoute();
  const { data, hasDemo, saveError, saving, backendKind } = useStore();
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [section, id] = parts;
  const t = today();
  const overdueTasks = data.tasks.filter((x) => x.status !== 'Done' && x.due && x.due < t).length;
  const dueFollowUps = data.leads.filter((l) => l.followUp && l.followUp <= t && l.stage !== 'Won' && l.stage !== 'Lost').length;
  const counts: Record<string, number> = { tasks: overdueTasks, leads: dueFollowUps };

  let page;
  switch (section) {
    case 'leads': page = <Leads />; break;
    case 'clients': page = id ? <ClientDetail id={id} /> : <Clients />; break;
    case 'campaigns': page = <Campaigns />; break;
    case 'tasks': page = <Tasks />; break;
    case 'invoices': page = id ? <InvoiceEditor id={id} /> : <Invoices />; break;
    case 'revenue': page = <Revenue />; break;
    case 'reports': page = id ? <ReportEditor id={id} /> : <Reports />; break;
    case 'settings': page = <SettingsPage />; break;
    default: page = <Dashboard />;
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <a className="brand" href="#/" onClick={() => setMenuOpen(false)}>
          <img src="./favicon.svg" alt="" width={36} height={36} />
          <div>
            <strong>SANIA</strong>
            <span>Growth Partner · Ops</span>
          </div>
        </a>
        <nav>
          {NAV.map((n, i) =>
            'group' in n ? (
              n.group ? <div key={i} className="nav-group">{n.group}</div> : <hr key={i} />
            ) : (
              <a key={n.path} href={`#/${n.path}`} className={(section ?? '') === n.path ? 'active' : ''} onClick={() => setMenuOpen(false)}>
                <span className="nav-icon" aria-hidden>{n.icon}</span>
                {n.label}
                {counts[n.path] ? <span className="nav-count" title="Needs attention">{counts[n.path]}</span> : null}
              </a>
            ),
          )}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-email" title={auth.user?.email}>{auth.user?.email}</div>
          <div className="sidebar-user-role">{auth.user?.role}{auth.user?.demo ? ' · demo' : ''}{saving ? ' · saving…' : ''}</div>
          <button className="btn sidebar-signout" onClick={() => auth.signOut()}>Sign out</button>
        </div>
        <div className="sidebar-foot">{backendKind === 'local' ? 'DEMO mode: data lives in this browser only. Back it up from Settings.' : 'Connected to Supabase. Access is controlled per user.'}</div>
      </aside>
      <div className="main">
        <header className="topbar no-print">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">☰</button>
          <span className="topbar-title">{data.settings.agencyName} — Internal</span>
        </header>
        {hasDemo && (
          <div className="demo-banner no-print">
            You're looking at <strong>fictional demo data</strong> (records tagged DEMO). Remove it anytime in{' '}
            <a href="#/settings">Settings → Clear demo data</a>.
          </div>
        )}
        {saveError && <div className="error-banner no-print">Couldn't save to browser storage: {saveError}. Export a backup now.</div>}
        <main className="content">{page}</main>
      </div>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
