import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { go, useRoute } from '../router';
import type { Data, EffectiveInvoiceStatus, Invoice } from '../types';
import { Badge, DemoTag, Empty, Field, Modal, NumberInput, PageHead, Select, Text, TextArea, confirmDo } from '../components/ui';
import { addDays, clientById, clientName, fmtDate, invoiceStatus, invoiceTotal, money, monthKey, monthLabel, nowIso, shiftMonth, today, uid } from '../utils';

const FILTERS: EffectiveInvoiceStatus[] = ['Draft', 'Sent', 'Overdue', 'Paid', 'Void'];

/** Creates draft invoice(s), consuming invoice numbers. Returns created ids. */
function createInvoices(data: Data, update: (fn: (d: Data) => Data) => void, specs: { clientId: string; month?: string }[]) {
  let n = data.settings.nextInvoiceNumber;
  const t = today();
  const created: Invoice[] = specs.map(({ clientId, month }) => {
    const c = data.clients.find((x) => x.id === clientId);
    return {
      id: uid(), createdAt: nowIso(), number: `${data.settings.invoicePrefix}${n++}`, clientId, issueDate: t, dueDate: addDays(t, data.settings.paymentTermsDays),
      status: 'Draft', notes: '', paidDate: '', retainerMonth: month,
      items: c && c.retainer > 0
        ? [{ id: uid(), description: `Monthly marketing retainer${month ? ` — ${monthLabel(month)}` : ''}`, qty: 1, rate: c.retainer }]
        : [{ id: uid(), description: '', qty: 1, rate: 0 }],
    };
  });
  update((d) => ({ ...d, invoices: [...created, ...d.invoices], settings: { ...d.settings, nextInvoiceNumber: Math.max(n, d.settings.nextInvoiceNumber) } }));
  return created.map((c) => c.id);
}

export default function Invoices() {
  const { data, update } = useStore();
  const { query } = useRoute();
  const [status, setStatus] = useState(query.get('status') ?? '');
  const [client, setClient] = useState(query.get('client') ?? '');
  const [picker, setPicker] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const t = today();
  const handled = useRef('');

  useEffect(() => {
    if (query.get('new') && handled.current !== query.toString()) {
      handled.current = query.toString();
      const cid = query.get('client');
      if (cid) { const [id] = createInvoices(data, update, [{ clientId: cid }]); go(`/invoices/${id}`); }
      else setPicker(true);
    }
    if (query.get('status')) setStatus(query.get('status')!);
    if (query.get('client')) setClient(query.get('client')!);
  }, [query.toString()]);

  const rows = useMemo(() => data.invoices
    .filter((i) => (!status || invoiceStatus(i, t) === status) && (!client || i.clientId === client))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number)), [data.invoices, status, client, t]);
  const sum = rows.filter((i) => i.status !== 'Void').reduce((s, i) => s + invoiceTotal(i), 0);

  return (
    <>
      <PageHead title="Invoices" sub="Create, print to PDF, and track payment. Nothing is emailed from here.">
        <button className="btn" onClick={() => setGenOpen(true)} disabled={!data.clients.some((c) => c.status === 'Active')}>Generate retainer invoices…</button>
        <button className="btn primary" onClick={() => setPicker(true)} disabled={!data.clients.length}>+ New invoice</button>
      </PageHead>
      <div className="toolbar">
        <div className="seg">
          <button className={!status ? 'on' : ''} onClick={() => setStatus('')}>All</button>
          {FILTERS.map((f) => <button key={f} className={status === f ? 'on' : ''} onClick={() => setStatus(f)}>{f}</button>)}
        </div>
        <Select value={client} onChange={setClient} options={data.clients.map((c) => ({ value: c.id, label: c.company }))} placeholder="All clients" />
      </div>
      {rows.length ? (
        <div className="card flush">
          <table className="table">
            <thead><tr><th>Number</th><th>Client</th><th>Issued</th><th>Due</th><th>Status</th><th className="num">Total</th></tr></thead>
            <tbody>
              {rows.map((i) => {
                const st = invoiceStatus(i, t);
                return (
                  <tr key={i.id} className="clickable" onClick={() => go(`/invoices/${i.id}`)}>
                    <td><strong>{i.number}</strong> <DemoTag show={i.demo} /></td>
                    <td>{clientName(data, i.clientId)}</td>
                    <td>{fmtDate(i.issueDate)}</td>
                    <td className={st === 'Overdue' ? 'warn-text' : ''}>{fmtDate(i.dueDate)}</td>
                    <td><Badge>{st}</Badge></td>
                    <td className="num">{money(invoiceTotal(i), true)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr><td colSpan={5}>{rows.length} invoice{rows.length === 1 ? '' : 's'} (excl. void)</td><td className="num"><strong>{money(sum, true)}</strong></td></tr></tfoot>
          </table>
        </div>
      ) : <Empty>No invoices{status ? ` with status ${status}` : ''}.</Empty>}

      {picker && (
        <Modal title="New invoice — choose client" onClose={() => { setPicker(false); if (query.get('new')) go('/invoices'); }}>
          <ul className="list">
            {data.clients.map((c) => (
              <li key={c.id} className="clickable" onClick={() => { const [id] = createInvoices(data, update, [{ clientId: c.id }]); setPicker(false); go(`/invoices/${id}`); }}>
                <span><strong>{c.company}</strong> <DemoTag show={c.demo} /></span><span className="muted small">{money(c.retainer)}/mo</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {genOpen && <GenerateModal onClose={() => setGenOpen(false)} onCreate={(specs) => { createInvoices(data, update, specs); setGenOpen(false); setStatus('Draft'); }} />}
    </>
  );
}

function GenerateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (s: { clientId: string; month: string }[]) => void }) {
  const { data } = useStore();
  const [month, setMonth] = useState(monthKey());
  const months = [-1, 0, 1].map((d) => shiftMonth(monthKey(), d));
  const eligible = data.clients.filter((c) => c.status === 'Active' && c.retainer > 0);
  const already = (cid: string) => data.invoices.some((i) => i.clientId === cid && i.retainerMonth === month && i.status !== 'Void');
  const todo = eligible.filter((c) => !already(c.id));
  return (
    <Modal title="Generate retainer invoices" onClose={onClose}>
      <Field label="Billing month"><Select value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} /></Field>
      <p className="muted small">Creates one <strong>Draft</strong> invoice per active client with a retainer, skipping clients already invoiced for that month. Review each draft before marking it sent.</p>
      <ul className="list compact">
        {eligible.map((c) => <li key={c.id}><span>{c.company}</span><span>{already(c.id) ? <span className="muted small">already invoiced</span> : money(c.retainer)}</span></li>)}
      </ul>
      <div className="modal-foot"><span className="spacer" /><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!todo.length} onClick={() => onCreate(todo.map((c) => ({ clientId: c.id, month })))}>Create {todo.length} draft{todo.length === 1 ? '' : 's'}</button></div>
    </Modal>
  );
}

export function InvoiceEditor({ id }: { id: string }) {
  const { data, upsert, remove, update } = useStore();
  const inv = data.invoices.find((i) => i.id === id);
  const [paidModal, setPaidModal] = useState(false);
  const [paidDate, setPaidDate] = useState(today());
  if (!inv) return <Empty>Invoice not found. <a href="#/invoices">Back to invoices</a></Empty>;
  const t = today();
  const st = invoiceStatus(inv, t);
  const c = clientById(data, inv.clientId);
  const s = data.settings;
  const total = invoiceTotal(inv);
  const save = (patch: Partial<Invoice>) => upsert('invoices', { ...inv, ...patch });
  const setItem = (iid: string, patch: Partial<Invoice['items'][number]>) => save({ items: inv.items.map((x) => (x.id === iid ? { ...x, ...patch } : x)) });
  const locked = inv.status === 'Paid' || inv.status === 'Void';

  return (
    <>
      <div className="crumbs no-print"><a href="#/invoices">Invoices</a> /</div>
      <PageHead title={`Invoice ${inv.number}`} sub={`${c?.company ?? 'Unknown client'} · ${money(total, true)}`}>
        <Badge>{st}</Badge>
        <button className="btn" onClick={() => window.print()}>Print / Save PDF</button>
        {inv.status === 'Draft' && <button className="btn primary" onClick={() => confirmDo('Mark as sent? (This app does not email anything — send the PDF yourself.)', () => save({ status: 'Sent' }))}>Mark sent</button>}
        {(inv.status === 'Sent') && <button className="btn green" onClick={() => setPaidModal(true)}>Mark paid</button>}
        {inv.status === 'Paid' && <button className="btn" onClick={() => save({ status: 'Sent', paidDate: '' })}>Undo paid</button>}
      </PageHead>
      {inv.demo && <p className="muted small no-print">Fictional demo invoice.</p>}

      <div className="invoice-layout">
        <section className="card no-print">
          <h3>Details</h3>
          <div className="form-grid">
            <Field label="Number"><Text value={inv.number} onChange={(v) => save({ number: v })} disabled={locked} /></Field>
            <Field label="Client"><Select value={inv.clientId} onChange={(v) => save({ clientId: v })} options={data.clients.map((x) => ({ value: x.id, label: x.company }))} /></Field>
            <Field label="Issue date"><Text type="date" value={inv.issueDate} onChange={(v) => save({ issueDate: v })} disabled={locked} /></Field>
            <Field label="Due date"><Text type="date" value={inv.dueDate} onChange={(v) => save({ dueDate: v })} disabled={locked} /></Field>
            {inv.status === 'Paid' && <Field label="Paid on"><Text type="date" value={inv.paidDate} onChange={(v) => save({ paidDate: v })} /></Field>}
          </div>
          <h4>Line items</h4>
          <table className="table items-edit">
            <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th><th /></tr></thead>
            <tbody>
              {inv.items.map((it) => (
                <tr key={it.id}>
                  <td><input value={it.description} disabled={locked} onChange={(e) => setItem(it.id, { description: e.target.value })} placeholder="e.g. Google Ads management" /></td>
                  <td className="num"><NumberInput value={it.qty} disabled={locked} onChange={(v) => setItem(it.id, { qty: v })} /></td>
                  <td className="num"><NumberInput value={it.rate} disabled={locked} onChange={(v) => setItem(it.id, { rate: v })} /></td>
                  <td className="num">{money(it.qty * it.rate, true)}</td>
                  <td>{!locked && <button className="link danger" onClick={() => save({ items: inv.items.filter((x) => x.id !== it.id) })}>×</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!locked && <button className="btn" onClick={() => save({ items: [...inv.items, { id: uid(), description: '', qty: 1, rate: 0 }] })}>+ Line item</button>}
          <Field label="Notes on invoice" full><TextArea value={inv.notes} onChange={(v) => save({ notes: v })} /></Field>
          <div className="modal-foot">
            <button className="btn danger" onClick={() => confirmDo(`Delete invoice ${inv.number}?`, () => { remove('invoices', inv.id); go('/invoices'); })}>Delete</button>
            {inv.status !== 'Void' && inv.status !== 'Paid' && <button className="btn" onClick={() => confirmDo('Void this invoice?', () => save({ status: 'Void' }))}>Void</button>}
            <span className="spacer" />
            <button className="btn" onClick={() => {
              const [nid] = createInvoices(data, update, [{ clientId: inv.clientId }]);
              update((d) => ({ ...d, invoices: d.invoices.map((x) => (x.id === nid ? { ...x, items: inv.items.map((i) => ({ ...i, id: uid() })), notes: inv.notes } : x)) }));
              go(`/invoices/${nid}`);
            }}>Duplicate</button>
          </div>
        </section>

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
      </div>

      {paidModal && (
        <Modal title="Record payment" onClose={() => setPaidModal(false)}>
          <Field label="Payment date"><Text type="date" value={paidDate} onChange={setPaidDate} /></Field>
          <p className="muted small">Records that {money(total, true)} was received. No payment is processed by this app.</p>
          <div className="modal-foot"><span className="spacer" /><button className="btn" onClick={() => setPaidModal(false)}>Cancel</button>
            <button className="btn green" onClick={() => { save({ status: 'Paid', paidDate }); setPaidModal(false); }}>Mark paid</button></div>
        </Modal>
      )}
    </>
  );
}
