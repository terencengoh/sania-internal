import type { ReactNode } from 'react';
import type { Campaign, Client, Invoice, Report, Settings } from '../types';
import { derivedKpis, fmtDate, invoiceStatus, invoiceTotal, money, monthLabel, num, pct, today } from '../utils';

/** Printable, client-facing invoice (used by staff editor and client portal). */
export function InvoiceDocument({ invoice: inv, client: c, settings: s }: { invoice: Invoice; client?: Client; settings: Settings }) {
  const st = invoiceStatus(inv, today());
  const total = invoiceTotal(inv);
  return (
    <section className="doc printable">
      <div className="doc-head">
        <div className="doc-brand">
          <img src="./favicon.svg" alt="" width={44} height={44} />
          <div><div className="doc-agency">{s.agencyName}</div><div className="muted small">{s.tagline}</div></div>
        </div>
        <div className="doc-title">
          <div className="doc-kind">INVOICE</div>
          <div>{inv.number}</div>
          {st !== 'Draft' && <div className={`doc-stamp s-${st.toLowerCase()}`}>{st}</div>}
        </div>
      </div>
      <div className="doc-meta">
        <div>
          <div className="label">From</div>
          <strong>{s.agencyName}</strong>
          {s.address && <div className="pre">{s.address}</div>}
          {s.email && <div>{s.email}</div>}
          {s.phone && <div>{s.phone}</div>}
        </div>
        <div>
          <div className="label">Bill to</div>
          <strong>{c?.company ?? '—'}</strong>
          {c?.contactName && <div>Attn: {c.contactName}</div>}
          {c && (c.city || c.state) && <div>{[c.city, c.state].filter(Boolean).join(', ')}</div>}
          {c?.email && <div>{c.email}</div>}
        </div>
        <div className="right">
          <div><span className="label">Issued</span> {fmtDate(inv.issueDate)}</div>
          <div><span className="label">Due</span> {fmtDate(inv.dueDate)}</div>
          {inv.status === 'Paid' && <div><span className="label">Paid</span> {fmtDate(inv.paidDate)}</div>}
        </div>
      </div>
      <table className="doc-table">
        <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
        <tbody>{inv.items.map((it) => <tr key={it.id}><td>{it.description || '—'}</td><td className="num">{it.qty}</td><td className="num">{money(it.rate, true)}</td><td className="num">{money(it.qty * it.rate, true)}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={3} className="num">Total due (USD)</td><td className="num total">{money(inv.status === 'Paid' ? 0 : total, true)}</td></tr>
          {inv.status === 'Paid' && <tr><td colSpan={3} className="num muted">Invoice total (paid)</td><td className="num muted">{money(total, true)}</td></tr>}</tfoot>
      </table>
      {inv.notes && <div className="doc-notes pre">{inv.notes}</div>}
      <div className="doc-foot">{s.invoiceFooter}{s.paymentTermsDays ? ` Payment terms: net ${s.paymentTermsDays} days.` : ''}</div>
      {inv.demo && <div className="doc-demo">DEMO — FICTIONAL INVOICE</div>}
    </section>
  );
}

function delta(cur: number, prev: number | undefined, lowerIsBetter = false): ReactNode {
  if (prev === undefined || !Number.isFinite(prev) || !Number.isFinite(cur) || prev === 0) return null;
  const ch = (cur - prev) / prev;
  const good = lowerIsBetter ? ch < 0 : ch > 0;
  return <span className={`delta ${ch === 0 ? '' : good ? 'up' : 'down'}`}>{ch > 0 ? '▲' : ch < 0 ? '▼' : '•'} {Math.abs(ch * 100).toFixed(0)}% vs last month</span>;
}

/** Printable, client-facing monthly report. */
export function ReportDocument({ report: r, client: c, settings: s, campaigns }: { report: Report; client?: Client; settings: Settings; campaigns: Campaign[] }) {
  const d = derivedKpis(r.kpis);
  const p = r.previous ? derivedKpis(r.previous) : undefined;
  const fmtMoney = (n: number) => (Number.isFinite(n) ? money(n, n < 100) : '—');
  const tiles: { label: string; value: string; d: ReactNode }[] = [
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
  );
}
