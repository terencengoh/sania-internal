import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { useStore } from '../store';
import { go, useRoute } from '../router';
import { clientView } from '../access';
import { Badge, DemoTag, Empty, PageHead, Stat } from '../components/ui';
import { InvoiceDocument, ReportDocument } from '../components/Documents';
import { derivedKpis, fmtDate, invoiceStatus, invoiceTotal, money, monthLabel, num, today } from '../utils';

/** Read-only portal for a client user. Everything shown comes from clientView() (and, live, from RLS). */
export default function Portal() {
  const auth = useAuth();
  const { data: all } = useStore();
  const { parts } = useRoute();
  const [menu, setMenu] = useState(false);
  const clientId = auth.user?.clientId ?? '';
  const data = useMemo(() => clientView(all, clientId), [all, clientId]);
  const client = data.clients[0];
  const [section, id] = parts;
  const t = today();

  if (!client) {
    return (
      <div className="center-screen"><div className="card narrow">
        <h2>Client account not found</h2><p className="muted">This login isn't linked to an active client record.</p>
        <button className="btn" onClick={() => auth.signOut()}>Sign out</button>
      </div></div>
    );
  }

  const nav = [['', 'Overview'], ['invoices', 'Invoices'], ['reports', 'Reports'], ['account', 'Account']] as const;
  let page;
  if (section === 'invoices' && id) {
    const inv = data.invoices.find((i) => i.id === id);
    page = inv ? (
      <>
        <div className="crumbs no-print"><a href="#/invoices">Invoices</a> /</div>
        <PageHead title={`Invoice ${inv.number}`} sub={money(invoiceTotal(inv), true)}>
          <Badge>{invoiceStatus(inv, t)}</Badge>
          <button className="btn primary" onClick={() => window.print()}>Print / Save PDF</button>
        </PageHead>
        <div className="portal-doc"><InvoiceDocument invoice={inv} client={client} settings={data.settings} /></div>
      </>
    ) : <Empty>Invoice not found. <a href="#/invoices">Back</a></Empty>;
  } else if (section === 'reports' && id) {
    const r = data.reports.find((x) => x.id === id);
    page = r ? (
      <>
        <div className="crumbs no-print"><a href="#/reports">Reports</a> /</div>
        <PageHead title={`${monthLabel(r.month)} report`}><button className="btn primary" onClick={() => window.print()}>Print / Save PDF</button></PageHead>
        <div className="portal-doc"><ReportDocument report={r} client={client} settings={data.settings} campaigns={data.campaigns.filter((c) => c.status === 'Active')} /></div>
      </>
    ) : <Empty>Report not found. <a href="#/reports">Back</a></Empty>;
  } else if (section === 'invoices') {
    page = <InvoiceList />;
  } else if (section === 'reports') {
    page = <ReportList />;
  } else if (section === 'account') {
    page = <Account />;
  } else {
    page = <Overview />;
  }

  function Overview() {
    const open = data.invoices.filter((i) => invoiceStatus(i, t) !== 'Paid');
    const due = open.reduce((s, i) => s + invoiceTotal(i), 0);
    const overdue = open.filter((i) => invoiceStatus(i, t) === 'Overdue');
    const latest = [...data.reports].sort((a, b) => b.month.localeCompare(a.month))[0];
    const active = data.campaigns.filter((c) => c.status !== 'Completed');
    return (
      <>
        <PageHead title={`Welcome, ${client.contactName || client.company}`} sub={client.company} />
        <div className="stats">
          <Stat label="Active campaigns" value={data.campaigns.filter((c) => c.status === 'Active').length} />
          <Stat label="Balance due" value={money(due, true)} sub={overdue.length ? <span className="warn-text">{overdue.length} overdue</span> : `${open.length} open invoice${open.length === 1 ? '' : 's'}`} tone={overdue.length ? 'warn' : undefined} onClick={() => go('/invoices')} />
          <Stat label="Latest report" value={latest ? monthLabel(latest.month) : '—'} sub={latest ? `${num(latest.kpis.leads)} leads · ${num(latest.kpis.calls)} calls` : 'None published yet'} onClick={latest ? () => go(`/reports/${latest.id}`) : undefined} />
        </div>
        <h2 className="section-title">Your campaigns</h2>
        {active.length ? (
          <div className="cards">
            {active.map((c) => {
              const done = c.deliverables.filter((x) => x.done).length;
              const total = c.deliverables.length;
              return (
                <div key={c.id} className="card">
                  <div className="camp-top"><span className="channel">{c.channel}</span><Badge>{c.status}</Badge></div>
                  <h3>{c.name} <DemoTag show={c.demo} /></h3>
                  {c.goal && <div className="small">Goal: {c.goal}</div>}
                  <div className="progress" title={`${done}/${total}`}><div style={{ width: total ? `${(done / total) * 100}%` : 0 }} /></div>
                  <div className="small muted">{done} of {total} deliverables complete</div>
                  <ul className="checklist ro">
                    {c.deliverables.map((x) => <li key={x.id}><span aria-hidden>{x.done ? '✅' : '⬜'}</span> <span className={x.done ? 'done' : ''}>{x.text}</span><span className="sr-only">{x.done ? ' (done)' : ' (in progress)'}</span></li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : <Empty>No active campaigns right now.</Empty>}
      </>
    );
  }

  function InvoiceList() {
    const rows = [...data.invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    return (
      <>
        <PageHead title="Invoices" sub="Open an invoice to print it or save it as a PDF." />
        {rows.length ? (
          <div className="card flush"><table className="table">
            <thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Status</th><th className="num">Amount</th></tr></thead>
            <tbody>{rows.map((i) => { const st = invoiceStatus(i, t); return (
              <tr key={i.id} className="clickable" onClick={() => go(`/invoices/${i.id}`)}>
                <td><strong>{i.number}</strong> <DemoTag show={i.demo} /></td><td>{fmtDate(i.issueDate)}</td>
                <td className={st === 'Overdue' ? 'warn-text' : ''}>{fmtDate(i.dueDate)}</td><td><Badge>{st}</Badge></td><td className="num">{money(invoiceTotal(i), true)}</td>
              </tr>); })}</tbody>
          </table></div>
        ) : <Empty>No invoices yet.</Empty>}
      </>
    );
  }

  function ReportList() {
    const rows = [...data.reports].sort((a, b) => b.month.localeCompare(a.month));
    return (
      <>
        <PageHead title="Monthly reports" />
        {rows.length ? (
          <div className="card flush"><table className="table">
            <thead><tr><th>Month</th><th className="num">Leads</th><th className="num">Calls</th><th className="num">Cost / lead</th><th className="num">Booked jobs</th></tr></thead>
            <tbody>{rows.map((r) => { const d = derivedKpis(r.kpis); return (
              <tr key={r.id} className="clickable" onClick={() => go(`/reports/${r.id}`)}>
                <td><strong>{monthLabel(r.month)}</strong> <DemoTag show={r.demo} /></td><td className="num">{num(r.kpis.leads)}</td><td className="num">{num(r.kpis.calls)}</td>
                <td className="num">{Number.isFinite(d.cpl) ? money(d.cpl, true) : '—'}</td><td className="num">{num(r.kpis.bookedJobs)}</td>
              </tr>); })}</tbody>
          </table></div>
        ) : <Empty>No reports published yet.</Empty>}
      </>
    );
  }

  return (
    <div className="portal">
      <header className="portal-top no-print">
        <a className="portal-brand" href="#/"><img src="./favicon.svg" alt="" width={32} height={32} /><span><strong>SANIA</strong> Client Portal</span></a>
        <button className="icon-btn portal-menu" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>☰</button>
        <nav className={menu ? 'open' : ''} aria-label="Portal">
          {nav.map(([p, l]) => <a key={p} href={`#/${p}`} className={(section ?? '') === p ? 'active' : ''} onClick={() => setMenu(false)}>{l}</a>)}
          <button className="btn small-btn" onClick={() => auth.signOut()}>Sign out</button>
        </nav>
      </header>
      {auth.user?.demo && <div className="demo-banner no-print">Demo client view — fictional data, no real login. <button className="link" onClick={() => auth.signOut()}>Exit demo</button></div>}
      <main className="content portal-content">{page}</main>
    </div>
  );
}

function Account() {
  const auth = useAuth();
  const { data: all } = useStore();
  const v = clientView(all, auth.user?.clientId ?? '');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setMsg(''); setErr('');
    if (pw !== pw2) { setErr("Passwords don't match."); return; }
    try { await auth.updatePassword(pw); setPw(''); setPw2(''); setMsg('Password updated.'); } catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); }
  };
  const c = v.clients[0];
  return (
    <>
      <PageHead title="Account" />
      <div className="grid-2">
        <section className="card">
          <h3>Your login</h3>
          <p><strong>{auth.user?.email}</strong><br /><span className="muted small">Client user · {c?.company}</span></p>
          <h4>Change password</h4>
          {auth.mode === 'demo' ? <p className="muted small">Not available in demo mode (there are no real passwords).</p> : (
            <form onSubmit={submit} className="auth-form">
              <label className="field"><span>New password (8+ characters)</span><input type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
              <label className="field"><span>Repeat</span><input type="password" autoComplete="new-password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
              {err && <p className="warn-text small" role="alert">{err}</p>}
              {msg && <p className="green-text small" role="status">{msg}</p>}
              <button className="btn primary">Update password</button>
            </form>
          )}
          <hr />
          <button className="btn" onClick={() => auth.signOut()}>Sign out</button>
        </section>
        <section className="card">
          <h3>Company on file</h3>
          {c && <p>{c.company}<br />{c.contactName}<br /><span className="muted small">{[c.email, c.phone].filter(Boolean).join(' · ')}</span></p>}
          {v.contacts.length > 0 && <><h4>Other contacts</h4><ul className="list compact">{v.contacts.map((x) => <li key={x.id}><span>{x.name}{x.title ? ` — ${x.title}` : ''}</span><span className="muted small">{x.email}</span></li>)}</ul></>}
          <p className="muted small">Need to change something? Contact SANIA Growth Partner{v.settings.email ? ` at ${v.settings.email}` : ''}.</p>
        </section>
      </div>
    </>
  );
}
