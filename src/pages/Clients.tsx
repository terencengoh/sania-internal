import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { go } from '../router';
import { CHANNELS, CLIENT_STATUSES, type Client, type Contact } from '../types';
import { Badge, DemoTag, Empty, Field, Modal, MultiCheck, NumberInput, PageHead, Select, Text, confirmDo } from '../components/ui';
import { Notes } from '../components/Notes';
import { InviteModal } from '../components/UsersAccess';
import { download, fmtDate, invoiceStatus, invoiceTotal, money, monthLabel, nowIso, today, toCsv, uid } from '../utils';

const blank = (): Client => ({
  id: uid(), createdAt: nowIso(), company: '', contactName: '', email: '', phone: '', city: '', state: '', website: '',
  status: 'Active', retainer: 0, startDate: today(), services: [], notes: [],
});

export default function Clients() {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const t = today();

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.clients.filter((c) => (!status || c.status === status) && (!s || [c.company, c.contactName, c.city, c.state].join(' ').toLowerCase().includes(s)));
  }, [data.clients, q, status]);

  const balance = (id: string) => data.invoices.filter((i) => i.clientId === id && ['Sent', 'Overdue'].includes(invoiceStatus(i, t))).reduce((s, i) => s + invoiceTotal(i), 0);

  return (
    <>
      <PageHead title="Clients" sub="Signed HVAC companies and their retainers.">
        <button className="btn" disabled={!data.clients.length} onClick={() => download(`sania-clients-${t}.csv`, toCsv(data.clients.map((c) => ({
          company: c.company, contact: c.contactName, email: c.email, phone: c.phone, city: c.city, state: c.state, status: c.status,
          monthly_retainer: c.retainer, start_date: c.startDate, services: c.services.join('; '), demo: c.demo ? 'yes' : '',
        }))), 'text/csv')}>Export CSV</button>
        <button className="btn primary" onClick={() => setEditing(blank())}>+ New client</button>
      </PageHead>
      <div className="toolbar">
        <input className="search" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onChange={setStatus} options={CLIENT_STATUSES} placeholder="All statuses" />
      </div>
      {rows.length ? (
        <div className="card flush">
          <table className="table">
            <thead><tr><th>Company</th><th>Contact</th><th>Services</th><th>Status</th><th className="num">Retainer/mo</th><th className="num">Balance due</th><th>Since</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => go(`/clients/${c.id}`)}>
                  <td><strong>{c.company}</strong> <DemoTag show={c.demo} /><div className="muted small">{[c.city, c.state].filter(Boolean).join(', ')}</div></td>
                  <td>{c.contactName}<div className="muted small">{c.phone}</div></td>
                  <td className="small">{c.services.join(', ') || '—'}</td>
                  <td><Badge>{c.status}</Badge></td>
                  <td className="num">{money(c.retainer)}</td>
                  <td className="num">{money(balance(c.id))}</td>
                  <td>{fmtDate(c.startDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No clients yet. Win a lead and click “convert to client”, or add one directly.</Empty>}
      {editing && <ClientModal client={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export function ClientModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const { data, upsert, remove } = useStore();
  const [c, setC] = useState(client);
  const isNew = !data.clients.some((x) => x.id === client.id);
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setC((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={isNew ? 'New client' : `Edit ${c.company}`} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Company *"><Text value={c.company} onChange={(v) => set('company', v)} autoFocus /></Field>
        <Field label="Contact name"><Text value={c.contactName} onChange={(v) => set('contactName', v)} /></Field>
        <Field label="Email"><Text type="email" value={c.email} onChange={(v) => set('email', v)} /></Field>
        <Field label="Phone"><Text type="tel" value={c.phone} onChange={(v) => set('phone', v)} /></Field>
        <Field label="City"><Text value={c.city} onChange={(v) => set('city', v)} /></Field>
        <Field label="State"><Text value={c.state} onChange={(v) => set('state', v.toUpperCase().slice(0, 2))} /></Field>
        <Field label="Website"><Text value={c.website} onChange={(v) => set('website', v)} /></Field>
        <Field label="Status"><Select value={c.status} onChange={(v) => set('status', v)} options={CLIENT_STATUSES} /></Field>
        <Field label="Monthly retainer (USD)" hint="Counts toward MRR while Active"><NumberInput min={0} value={c.retainer} onChange={(v) => set('retainer', v)} /></Field>
        <Field label="Start date"><Text type="date" value={c.startDate} onChange={(v) => set('startDate', v)} /></Field>
        <Field label="Services" full><MultiCheck options={CHANNELS} value={c.services} onChange={(v) => set('services', v)} /></Field>
      </div>
      <div className="modal-foot">
        {!isNew && <button className="btn danger" onClick={() => confirmDo(`Delete "${c.company}"? This also deletes its campaigns and reports (invoices are kept).`, () => { remove('clients', c.id); onClose(); go('/clients'); })}>Delete</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!c.company.trim()} onClick={() => { upsert('clients', c); onClose(); if (isNew) go(`/clients/${c.id}`); }}>Save</button>
      </div>
    </Modal>
  );
}

export function ClientDetail({ id }: { id: string }) {
  const { data, upsert, remove } = useStore();
  const [edit, setEdit] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const c = data.clients.find((x) => x.id === id);
  const t = today();
  if (!c) return <Empty>Client not found. <a href="#/clients">Back to clients</a></Empty>;
  const campaigns = data.campaigns.filter((x) => x.clientId === id);
  const tasks = data.tasks.filter((x) => x.clientId === id && x.status !== 'Done').sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  const invoices = data.invoices.filter((x) => x.clientId === id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const reports = data.reports.filter((x) => x.clientId === id).sort((a, b) => b.month.localeCompare(a.month));
  const lead = c.leadId ? data.leads.find((l) => l.id === c.leadId) : undefined;
  const billed = invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + invoiceTotal(i), 0);
  const due = invoices.filter((i) => ['Sent', 'Overdue'].includes(invoiceStatus(i, t))).reduce((s, i) => s + invoiceTotal(i), 0);

  return (
    <>
      <div className="crumbs"><a href="#/clients">Clients</a> /</div>
      <PageHead title={c.company} sub={[c.contactName, c.email, c.phone, [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}>
        <button className="btn" onClick={() => setEdit(true)}>Edit</button>
        <button className="btn" onClick={() => setInviting(true)}>Invite client user</button>
        <button className="btn" onClick={() => go(`/campaigns?new=1&client=${c.id}`)}>+ Campaign</button>
        <button className="btn" onClick={() => go(`/reports?new=1&client=${c.id}`)}>+ Report</button>
        <button className="btn primary" onClick={() => go(`/invoices?new=1&client=${c.id}`)}>+ Invoice</button>
      </PageHead>
      {c.demo && <p className="muted small">Fictional demo client.</p>}
      <div className="stats">
        <div className="stat"><div className="stat-label">Status</div><div className="stat-value"><Badge>{c.status}</Badge></div></div>
        <div className="stat"><div className="stat-label">Retainer</div><div className="stat-value">{money(c.retainer)}<small>/mo</small></div></div>
        <div className="stat"><div className="stat-label">Paid to date</div><div className="stat-value">{money(billed)}</div></div>
        <div className="stat"><div className="stat-label">Balance due</div><div className="stat-value">{money(due)}</div></div>
        <div className="stat"><div className="stat-label">Client since</div><div className="stat-value small-val">{fmtDate(c.startDate)}</div></div>
      </div>
      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h3>Campaigns</h3><a href={`#/campaigns?client=${c.id}`}>All →</a></div>
          {campaigns.length ? <ul className="list">{campaigns.map((x) => {
            const done = x.deliverables.filter((d) => d.done).length;
            return <li key={x.id} className="clickable" onClick={() => go(`/campaigns?open=${x.id}`)}>
              <div><strong>{x.name}</strong><div className="muted small">{x.channel} · {done}/{x.deliverables.length} deliverables</div></div>
              <Badge>{x.status}</Badge></li>;
          })}</ul> : <Empty>No campaigns.</Empty>}
        </section>
        <section className="card">
          <div className="card-head"><h3>Open tasks</h3><a href={`#/tasks?client=${c.id}`}>Board →</a></div>
          {tasks.length ? <ul className="list">{tasks.map((x) => (
            <li key={x.id} className="clickable" onClick={() => go(`/tasks?open=${x.id}`)}>
              <div><strong>{x.title}</strong><div className="muted small">{x.assignee}</div></div>
              <div className="right"><Badge>{x.status}</Badge><div className={`small ${x.due && x.due < t ? 'warn-text' : 'muted'}`}>{fmtDate(x.due)}</div></div></li>
          ))}</ul> : <Empty>No open tasks.</Empty>}
        </section>
        <section className="card">
          <div className="card-head"><h3>Invoices</h3><a href={`#/invoices?client=${c.id}`}>All →</a></div>
          {invoices.length ? <table className="table"><tbody>{invoices.map((i) => (
            <tr key={i.id} className="clickable" onClick={() => go(`/invoices/${i.id}`)}>
              <td>{i.number}</td><td>{fmtDate(i.issueDate)}</td><td><Badge>{invoiceStatus(i, t)}</Badge></td><td className="num">{money(invoiceTotal(i), true)}</td></tr>
          ))}</tbody></table> : <Empty>No invoices.</Empty>}
        </section>
        <section className="card">
          <div className="card-head"><h3>Monthly reports</h3><a href={`#/reports?client=${c.id}`}>All →</a></div>
          {reports.length ? <ul className="list">{reports.map((r) => (
            <li key={r.id} className="clickable" onClick={() => go(`/reports/${r.id}`)}><strong>{monthLabel(r.month)}</strong><span className="muted small">{r.kpis.leads} leads · {money(r.kpis.spend)} spend</span></li>
          ))}</ul> : <Empty>No reports yet.</Empty>}
        </section>
      </div>
      <section className="card">
        <div className="card-head"><h3>Contacts</h3><button className="btn" onClick={() => setContact({ id: uid(), createdAt: nowIso(), clientId: c.id, name: '', email: '', phone: '', title: '', demo: c.demo })}>+ Contact</button></div>
        <p className="muted small">Primary: {c.contactName || '—'} {c.email && `· ${c.email}`} {c.phone && `· ${c.phone}`}</p>
        {data.contacts.filter((x) => x.clientId === c.id).length ? (
          <ul className="list compact">{data.contacts.filter((x) => x.clientId === c.id).map((x) => (
            <li key={x.id} className="clickable" onClick={() => setContact(x)}><span><strong>{x.name}</strong>{x.title ? ` — ${x.title}` : ''}</span><span className="muted small">{[x.email, x.phone].filter(Boolean).join(' · ')}</span></li>
          ))}</ul>
        ) : null}
      </section>
      <section className="card">
        <div className="card-head"><h3>Internal notes <span className="muted small">(never shown to the client)</span></h3>{lead && <a href={`#/leads?open=${lead.id}`}>Original lead →</a>}</div>
        <Notes notes={c.notes} onChange={(n) => upsert('clients', { ...c, notes: n })} />
      </section>
      {edit && <ClientModal client={c} onClose={() => setEdit(false)} />}
      {inviting && <InviteModal clientId={c.id} defaultEmail={c.email} onClose={() => setInviting(false)} />}
      {contact && (
        <Modal title={data.contacts.some((x) => x.id === contact.id) ? 'Edit contact' : 'New contact'} onClose={() => setContact(null)}>
          <div className="form-grid">
            <Field label="Name *"><Text value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} autoFocus /></Field>
            <Field label="Title"><Text value={contact.title} onChange={(v) => setContact({ ...contact, title: v })} placeholder="e.g. Office manager" /></Field>
            <Field label="Email"><Text type="email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} /></Field>
            <Field label="Phone"><Text type="tel" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} /></Field>
          </div>
          <div className="modal-foot">
            {data.contacts.some((x) => x.id === contact.id) && <button className="btn danger" onClick={() => { remove('contacts', contact.id); setContact(null); }}>Delete</button>}
            <span className="spacer" />
            <button className="btn" onClick={() => setContact(null)}>Cancel</button>
            <button className="btn primary" disabled={!contact.name.trim()} onClick={() => { upsert('contacts', contact); setContact(null); }}>Save</button>
          </div>
        </Modal>
      )}
    </>
  );
}
