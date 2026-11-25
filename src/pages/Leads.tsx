import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { go, useRoute } from '../router';
import { CHANNELS, LEAD_SOURCES, LEAD_STAGES, type Client, type Lead, type LeadStage } from '../types';
import { Badge, DemoTag, Empty, Field, Modal, MultiCheck, NumberInput, PageHead, Select, Text, confirmDo } from '../components/ui';
import { Notes } from '../components/Notes';
import { download, fmtDate, money, nowIso, today, toCsv, uid } from '../utils';

const blank = (): Lead => ({
  id: uid(), createdAt: nowIso(), company: '', contactName: '', email: '', phone: '', city: '', state: '', source: 'Website form',
  stage: 'New', value: 0, followUp: today(), services: [], notes: [],
});

export default function Leads() {
  const { data, upsert } = useStore();
  const { query } = useRoute();
  const [view, setView] = useState<'board' | 'table'>(() => (localStorage.getItem('sania:leadsView') as 'board' | 'table') || 'board');
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [editing, setEditing] = useState<Lead | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const t = today();

  useEffect(() => localStorage.setItem('sania:leadsView', view), [view]);
  useEffect(() => {
    if (query.get('new')) setEditing(blank());
    const id = query.get('open');
    if (id) { const l = data.leads.find((x) => x.id === id); if (l) setEditing(l); }
  }, [query.toString()]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.leads.filter((l) =>
      (!source || l.source === source) &&
      (!s || [l.company, l.contactName, l.email, l.city, l.state, l.phone].join(' ').toLowerCase().includes(s)));
  }, [data.leads, q, source]);

  const close = () => { setEditing(null); if (query.toString()) go('/leads'); };
  const moveTo = (id: string, stage: LeadStage) => {
    const l = data.leads.find((x) => x.id === id);
    if (l && l.stage !== stage) upsert('leads', { ...l, stage, notes: [{ id: uid(), date: nowIso(), text: `Stage: ${l.stage} → ${stage}` }, ...l.notes] });
  };
  const exportCsv = () => download(`sania-leads-${t}.csv`, toCsv(data.leads.map((l) => ({
    company: l.company, contact: l.contactName, email: l.email, phone: l.phone, city: l.city, state: l.state, source: l.source,
    stage: l.stage, monthly_value: l.value, follow_up: l.followUp, services: l.services.join('; '), demo: l.demo ? 'yes' : '',
  }))), 'text/csv');

  return (
    <>
      <PageHead title="Leads & pipeline" sub="HVAC companies you're talking to. Drag cards between stages.">
        <button className="btn" onClick={exportCsv} disabled={!data.leads.length}>Export CSV</button>
        <button className="btn primary" onClick={() => setEditing(blank())}>+ New lead</button>
      </PageHead>
      <div className="toolbar">
        <input className="search" placeholder="Search company, contact, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={source} onChange={setSource} options={LEAD_SOURCES} placeholder="All sources" />
        <div className="seg">
          <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
          <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button>
        </div>
      </div>

      {view === 'board' ? (
        <div className="kanban">
          {LEAD_STAGES.map((stage) => {
            const items = filtered.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="kcol" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) moveTo(dragId, stage); setDragId(null); }}>
                <div className="kcol-head"><Badge>{stage}</Badge><span className="muted small">{items.length} · {money(items.reduce((s, l) => s + l.value, 0))}/mo</span></div>
                {items.map((l) => (
                  <div key={l.id} className="kcard" draggable onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)} onClick={() => setEditing(l)}>
                    <div className="kcard-title">{l.company || '(no name)'} <DemoTag show={l.demo} /></div>
                    <div className="muted small">{l.contactName}{l.city ? ` · ${l.city}, ${l.state}` : ''}</div>
                    <div className="kcard-foot">
                      <span>{money(l.value)}/mo</span>
                      {l.followUp && stage !== 'Won' && stage !== 'Lost' && <span className={l.followUp < t ? 'warn-text' : l.followUp === t ? 'copper-text' : 'muted'}>↻ {fmtDate(l.followUp)}</span>}
                      {l.clientId && <span className="green-text">Client ✓</span>}
                    </div>
                  </div>
                ))}
                {!items.length && <div className="kempty">Drop here</div>}
              </div>
            );
          })}
        </div>
      ) : filtered.length ? (
        <div className="card flush">
          <table className="table">
            <thead><tr><th>Company</th><th>Contact</th><th>Location</th><th>Source</th><th>Stage</th><th className="num">Value/mo</th><th>Follow-up</th></tr></thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="clickable" onClick={() => setEditing(l)}>
                  <td><strong>{l.company}</strong> <DemoTag show={l.demo} /></td>
                  <td>{l.contactName}<div className="muted small">{l.email}</div></td>
                  <td>{[l.city, l.state].filter(Boolean).join(', ')}</td>
                  <td>{l.source}</td>
                  <td><Badge>{l.stage}</Badge></td>
                  <td className="num">{money(l.value)}</td>
                  <td className={l.followUp && l.followUp < t && l.stage !== 'Won' && l.stage !== 'Lost' ? 'warn-text' : ''}>{fmtDate(l.followUp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No leads match.</Empty>}

      {editing && <LeadModal lead={editing} onClose={close} />}
    </>
  );
}

function LeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { data, upsert, remove } = useStore();
  const [l, setL] = useState<Lead>(lead);
  const isNew = !data.leads.some((x) => x.id === lead.id);
  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setL((p) => ({ ...p, [k]: v }));
  const save = () => { upsert('leads', l); onClose(); };
  const linkedClient = l.clientId ? data.clients.find((c) => c.id === l.clientId) : undefined;

  const convert = () => {
    const client: Client = {
      id: uid(), createdAt: nowIso(), company: l.company, contactName: l.contactName, email: l.email, phone: l.phone, city: l.city, state: l.state,
      website: '', status: 'Active', retainer: l.value, startDate: today(), services: l.services,
      notes: [{ id: uid(), date: nowIso(), text: `Converted from lead (source: ${l.source}).` }, ...l.notes], leadId: l.id, demo: l.demo,
    };
    upsert('clients', client);
    upsert('leads', { ...l, stage: 'Won', clientId: client.id, followUp: '' });
    onClose();
    go(`/clients/${client.id}`);
  };

  return (
    <Modal title={isNew ? 'New lead' : l.company || 'Lead'} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Company *"><Text value={l.company} onChange={(v) => set('company', v)} placeholder="e.g. Acme Heating & Cooling" autoFocus /></Field>
        <Field label="Contact name"><Text value={l.contactName} onChange={(v) => set('contactName', v)} /></Field>
        <Field label="Email"><Text type="email" value={l.email} onChange={(v) => set('email', v)} /></Field>
        <Field label="Phone"><Text type="tel" value={l.phone} onChange={(v) => set('phone', v)} /></Field>
        <Field label="City"><Text value={l.city} onChange={(v) => set('city', v)} /></Field>
        <Field label="State"><Text value={l.state} onChange={(v) => set('state', v.toUpperCase().slice(0, 2))} placeholder="MD" /></Field>
        <Field label="Source"><Select value={l.source} onChange={(v) => set('source', v)} options={LEAD_SOURCES} /></Field>
        <Field label="Stage"><Select value={l.stage} onChange={(v) => set('stage', v)} options={LEAD_STAGES} /></Field>
        <Field label="Est. monthly value (USD)" hint="Expected retainer if won"><NumberInput min={0} value={l.value} onChange={(v) => set('value', v)} /></Field>
        <Field label="Next follow-up"><Text type="date" value={l.followUp} onChange={(v) => set('followUp', v)} /></Field>
        {l.stage === 'Lost' && <Field label="Lost reason" full><Text value={l.lostReason ?? ''} onChange={(v) => set('lostReason', v)} /></Field>}
        <Field label="Services of interest" full><MultiCheck options={CHANNELS} value={l.services} onChange={(v) => set('services', v)} /></Field>
      </div>
      <h4>Notes & activity</h4>
      <Notes notes={l.notes} onChange={(n) => set('notes', n)} />
      <div className="modal-foot">
        {!isNew && <button className="btn danger" onClick={() => confirmDo(`Delete lead "${l.company}"?`, () => { remove('leads', l.id); onClose(); })}>Delete</button>}
        <span className="spacer" />
        {linkedClient ? (
          <button className="btn" onClick={() => { onClose(); go(`/clients/${linkedClient.id}`); }}>Open client →</button>
        ) : (
          l.stage !== 'Lost' && <button className="btn green" disabled={!l.company.trim()} onClick={() => confirmDo(`Mark "${l.company}" as Won and create a client record?`, convert)}>Won → convert to client</button>
        )}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!l.company.trim()}>Save</button>
      </div>
      {l.demo && <p className="muted small">This is a fictional demo record.</p>}
    </Modal>
  );
}
