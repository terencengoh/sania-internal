import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { go, useRoute } from '../router';
import type { Report, ReportKpis } from '../types';
import { DemoTag, Empty, Field, Modal, NumberInput, PageHead, Select, TextArea, confirmDo } from '../components/ui';
import { clientById, clientName, derivedKpis, money, monthKey, monthLabel, nowIso, num, pct, shiftMonth, uid } from '../utils';

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
            <thead><tr><th>Month</th><th>Client</th><th className="num">Spend</th><th className="num">Leads</th><th className="num">Calls</th><th className="num">Cost / lead</th><th className="num">Booked jobs</th></tr></thead>
            <tbody>{rows.map((r) => {
              const d = derivedKpis(r.kpis);
              return (
                <tr key={r.id} className="clickable" onClick={() => go(`/reports/${r.id}`)}>
                  <td><strong>{monthLabel(r.month)}</strong> <DemoTag show={r.demo} /></td><td>{clientName(data, r.clientId)}</td>
                  <td className="num">{money(r.kpis.spend)}</td><td className="num">{num(r.kpis.leads)}</td><td className="num">{num(r.kpis.calls)}</td>
                  <td className="num">{Number.isFinite(d.cpl) ? money(d.cpl, true) : '—'}</td><td className="num">{num(r.kpis.bookedJobs)}</td>
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
          id: uid(), createdAt: nowIso(), clientId, month, kpis: zero(), previous: prev ? { ...prev.kpis } : undefined, highlights: '', nextSteps: '',
        })}>Create</button></div>
    </Modal>
  );
}

function delta(cur: number, prev: number | undefined, lowerIsBetter = false) {
  if (prev === undefined || !Number.isFinite(prev) || !Number.isFinite(cur) || prev === 0) return null;
  const ch = (cur - prev) / prev;
  const good = lowerIsBetter ? ch < 0 : ch > 0;
  return <span className={`delta ${ch === 0 ? '' : good ? 'up' : 'down'}`}>{ch > 0 ? '▲' : ch < 0 ? '▼' : '•'} {Math.abs(ch * 100).toFixed(0)}% vs last month</span>;
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
  const d = derivedKpis(r.kpis);
  const p = r.previous ? derivedKpis(r.previous) : undefined;
  const campaigns = data.campaigns.filter((x) => x.clientId === r.clientId && x.status === 'Active');
  const fmtMoney = (n: number) => (Number.isFinite(n) ? money(n, n < 100) : '—');

  const tiles: { label: string; value: string; d: ReturnType<typeof delta> }[] = [
    { label: 'Leads', value: num(r.kpis.leads), d: delta(r.kpis.leads, r.previous?.leads) },
    { label: 'Phone calls', value: num(r.kpis.calls), d: delta(r.kpis.calls, r.previous?.calls) },
    { label: 'Cost per lead', value: fmtMoney(d.cpl), d: delta(d.cpl, p?.cpl, true) },
    { label: 'Ad spend', value: money(r.kpis.spend), d: delta(r.kpis.spend, r.previous?.spend) },
    { label: 'Booked jobs', value: num(r.kpis.bookedJobs), d: delta(r.kpis.bookedJobs, r.previous?.bookedJobs) },
    { label: 'Cost per booked job', value: fmtMoney(d.costPerJob), d: delta(d.costPerJob, p?.costPerJob, true) },
    { label: 'Clicks', value: num(r.kpis.clicks), d: delta(r.kpis.clicks, r.previous?.clicks) },
    { label: 'Click-through rate', value: pct(d.ctr), d: delta(d.ctr, p?.ctr) },
    { label: 'Click → lead rate', value: pct(d.convRate), d: delta(d.convRate, p?.convRate) },
  ];
  if (r.kpis.revenue > 0) tiles.push({ label: 'Return on ad spend', value: Number.isFinite(d.roas) ? `${d.roas.toFixed(1)}×` : '—', d: delta(d.roas, p?.roas) });

  return (
    <>
      <div className="crumbs no-print"><a href="#/reports">Reports</a> /</div>
      <PageHead title={`${monthLabel(r.month)} report`} sub={c?.company}>
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

        <section className="doc printable report-doc">
          <div className="doc-head">
            <div className="doc-brand">
              <img src="./favicon.svg" alt="" width={44} height={44} />
              <div><div className="doc-agency">{s.agencyName}</div><div className="muted small">{s.tagline}</div></div>
            </div>
            <div className="doc-title"><div className="doc-kind">MONTHLY REPORT</div><div>{monthLabel(r.month)}</div></div>
          </div>
          <h2 className="report-client">{c?.company ?? 'Client'}</h2>
          {campaigns.length > 0 && <div className="muted small">Active: {campaigns.map((x) => `${x.name} (${x.channel})`).join(' · ')}</div>}
          <div className="kpi-grid">
            {tiles.map((x) => <div className="kpi" key={x.label}><div className="kpi-label">{x.label}</div><div className="kpi-value">{x.value}</div>{x.d}</div>)}
          </div>
          {r.highlights && <><h3>Highlights</h3><div className="pre">{r.highlights}</div></>}
          {r.nextSteps && <><h3>Next month</h3><div className="pre">{r.nextSteps}</div></>}
          <div className="doc-foot">Prepared by {s.agencyName}{s.email ? ` · ${s.email}` : ''}{s.phone ? ` · ${s.phone}` : ''}. Figures as entered for {monthLabel(r.month)}.</div>
          {r.demo && <div className="doc-demo">DEMO — FICTIONAL NUMBERS</div>}
        </section>
      </div>
    </>
  );
}
