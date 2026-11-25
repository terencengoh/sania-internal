import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { go, useRoute } from '../router';
import type { Report, ReportKpis } from '../types';
import { ReportDocument } from '../components/Documents';
import { Badge, DemoTag, Empty, Field, Modal, NumberInput, PageHead, Select, TextArea, confirmDo } from '../components/ui';
import { clientById, clientName, derivedKpis, money, monthKey, monthLabel, nowIso, num, shiftMonth, uid } from '../utils';

const zero = (): ReportKpis => ({ spend: 0, impressions: 0, clicks: 0, leads: 0, calls: 0, bookedJobs: 0, revenue: 0 });

const KPI_FIELDS: { key: keyof ReportKpis; label: string; money?: boolean; hint?: string }[] = [
  { key: 'spend', label: 'Ad spend', money: true },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'leads', label: 'Leads (forms + calls)', hint: 'Total qualified leads' },
  { key: 'calls', label: 'Phone calls' },
  { key: 'bookedJobs', label: 'Booked jobs', hint: 'From the client' },
  { key: 'revenue', label: 'Revenue from booked jobs', money: true, hint: 'Client-reported; leave 0 if unknown' },
];

export default function Reports() {
  const { data, upsert } = useStore();
  const { query } = useRoute();
  const [client, setClient] = useState(query.get('client') ?? '');
  const [creating, setCreating] = useState(false);
  const handled = useRef('');

  useEffect(() => {
    if (query.get('new') && handled.current !== query.toString()) { handled.current = query.toString(); setCreating(true); }
    if (query.get('client')) setClient(query.get('client')!);
  }, [query.toString()]);

  const rows = useMemo(() => data.reports.filter((r) => !client || r.clientId === client).sort((a, b) => b.month.localeCompare(a.month)), [data.reports, client]);

  return (
    <>
      <PageHead title="Client reports" sub="Enter the month's KPIs, then print or save a branded PDF for the client.">
        <button className="btn primary" onClick={() => setCreating(true)} disabled={!data.clients.length}>+ New report</button>
      </PageHead>
      <div className="toolbar"><Select value={client} onChange={setClient} options={data.clients.map((c) => ({ value: c.id, label: c.company }))} placeholder="All clients" /></div>
      {rows.length ? (
        <div className="card flush">
          <table className="table">
            <thead><tr><th>Month</th><th>Client</th><th className="num">Spend</th><th className="num">Leads</th><th className="num">Calls</th><th className="num">Cost / lead</th><th className="num">Booked jobs</th><th>Portal</th></tr></thead>
            <tbody>{rows.map((r) => {
              const d = derivedKpis(r.kpis);
              return (
                <tr key={r.id} className="clickable" onClick={() => go(`/reports/${r.id}`)}>
                  <td><strong>{monthLabel(r.month)}</strong> <DemoTag show={r.demo} /></td><td>{clientName(data, r.clientId)}</td>
                  <td className="num">{money(r.kpis.spend)}</td><td className="num">{num(r.kpis.leads)}</td><td className="num">{num(r.kpis.calls)}</td>
                  <td className="num">{Number.isFinite(d.cpl) ? money(d.cpl, true) : '—'}</td><td className="num">{num(r.kpis.bookedJobs)}</td>
                  <td><Badge>{r.published ? 'Published' : 'Draft'}</Badge></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : <Empty>No reports yet.</Empty>}
      {creating && <NewReportModal defaultClient={client || query.get('client') || ''} onClose={() => { setCreating(false); if (query.get('new')) go('/reports'); }}
        onCreate={(r) => { upsert('reports', r); setCreating(false); go(`/reports/${r.id}`); }} />}
    </>
  );
}

function NewReportModal({ defaultClient, onClose, onCreate }: { defaultClient: string; onClose: () => void; onCreate: (r: Report) => void }) {
  const { data } = useStore();
  const [clientId, setClientId] = useState(defaultClient);
  const [month, setMonth] = useState(shiftMonth(monthKey(), -1));
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(monthKey(), -i));
  const exists = data.reports.find((r) => r.clientId === clientId && r.month === month);
  const prev = data.reports.find((r) => r.clientId === clientId && r.month === shiftMonth(month, -1));
  return (
    <Modal title="New monthly report" onClose={onClose}>
      <div className="form-grid">
        <Field label="Client"><Select value={clientId} onChange={setClientId} options={data.clients.map((c) => ({ value: c.id, label: c.company }))} placeholder="Choose…" /></Field>
        <Field label="Month"><Select value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} /></Field>
      </div>
      {exists && <p className="warn-text small">A report for this client and month already exists. <a href={`#/reports/${exists.id}`}>Open it</a></p>}
      {prev && <p className="muted small">Last month's numbers ({monthLabel(prev.month)}) will be filled in for comparison.</p>}
      <div className="modal-foot"><span className="spacer" /><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!clientId || !!exists} onClick={() => onCreate({
          id: uid(), createdAt: nowIso(), clientId, month, kpis: zero(), previous: prev ? { ...prev.kpis } : undefined, highlights: '', nextSteps: '', published: false,
        })}>Create</button></div>
    </Modal>
  );
}

export function ReportEditor({ id }: { id: string }) {
  const { data, upsert, remove } = useStore();
  const r = data.reports.find((x) => x.id === id);
  const [showPrev, setShowPrev] = useState(false);
  if (!r) return <Empty>Report not found. <a href="#/reports">Back</a></Empty>;
  const c = clientById(data, r.clientId);
  const s = data.settings;
  const save = (patch: Partial<Report>) => upsert('reports', { ...r, ...patch });
  const setK = (k: keyof ReportKpis, v: number) => save({ kpis: { ...r.kpis, [k]: v } });
  const setP = (k: keyof ReportKpis, v: number) => save({ previous: { ...(r.previous ?? zero()), [k]: v } });
  const campaigns = data.campaigns.filter((x) => x.clientId === r.clientId && x.status === 'Active');

  return (
    <>
      <div className="crumbs no-print"><a href="#/reports">Reports</a> /</div>
      <PageHead title={`${monthLabel(r.month)} report`} sub={c?.company}>
        <Badge>{r.published ? 'Published' : 'Draft'}</Badge>
        {r.published
          ? <button className="btn" onClick={() => save({ published: false })}>Unpublish</button>
          : <button className="btn green" onClick={() => confirmDo('Publish this report to the client portal? The client will be able to see it.', () => save({ published: true }))}>Publish to client portal</button>}
        <button className="btn primary" onClick={() => window.print()}>Print / Save PDF</button>
      </PageHead>
      <div className="invoice-layout">
        <section className="card no-print">
          <h3>KPIs for {monthLabel(r.month)}</h3>
          <div className="form-grid">
            {KPI_FIELDS.map((f) => <Field key={f.key} label={f.label + (f.money ? ' ($)' : '')} hint={f.hint}><NumberInput min={0} value={r.kpis[f.key]} onChange={(v) => setK(f.key, v)} /></Field>)}
          </div>
          <button className="link" onClick={() => setShowPrev((x) => !x)}>{showPrev ? 'Hide' : 'Edit'} last month's numbers (for comparison)</button>
          {showPrev && (
            <div className="form-grid sub-grid">
              {KPI_FIELDS.map((f) => <Field key={f.key} label={`Prev: ${f.label}`}><NumberInput min={0} value={r.previous?.[f.key] ?? 0} onChange={(v) => setP(f.key, v)} /></Field>)}
              <button className="link danger" onClick={() => save({ previous: undefined })}>Remove comparison</button>
            </div>
          )}
          <Field label="Highlights / what we did" full><TextArea rows={5} value={r.highlights} onChange={(v) => save({ highlights: v })} /></Field>
          <Field label="Next month's plan" full><TextArea rows={4} value={r.nextSteps} onChange={(v) => save({ nextSteps: v })} /></Field>
          <div className="modal-foot"><button className="btn danger" onClick={() => confirmDo('Delete this report?', () => { remove('reports', r.id); go('/reports'); })}>Delete</button></div>
        </section>

        <ReportDocument report={r} client={c} settings={s} campaigns={campaigns} />
      </div>
    </>
  );
}
