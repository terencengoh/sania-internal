import { useStore } from '../store';
import { go } from '../router';
import { monthlySeries, revenueMetrics } from '../metrics';
import { DemoTag, Empty, PageHead, Stat } from '../components/ui';
import { MonthBars } from '../components/Bars';
import { invoiceStatus, invoiceTotal, money, monthLabel, today } from '../utils';

export default function Revenue() {
  const { data } = useStore();
  const r = revenueMetrics(data);
  const series = monthlySeries(data, 12);
  const t = today();
  const byClient = data.clients.map((c) => {
    const inv = data.invoices.filter((i) => i.clientId === c.id && i.status !== 'Void');
    const paid = inv.filter((i) => i.status === 'Paid').reduce((s, i) => s + invoiceTotal(i), 0);
    const open = inv.filter((i) => ['Sent', 'Overdue'].includes(invoiceStatus(i, t))).reduce((s, i) => s + invoiceTotal(i), 0);
    const overdue = inv.filter((i) => invoiceStatus(i, t) === 'Overdue').reduce((s, i) => s + invoiceTotal(i), 0);
    return { c, paid, open, overdue };
  }).sort((a, b) => b.c.retainer - a.c.retainer);
  const collected = r.paidAllTime + r.outstanding > 0 ? r.paidAllTime / (r.paidAllTime + r.outstanding) : NaN;

  return (
    <>
      <PageHead title="Revenue" sub="Computed only from the clients and invoices you've entered." />
      <div className="stats">
        <Stat label="MRR" value={money(r.mrr)} sub={`Sum of active retainers · ${r.activeClients} clients`} />
        <Stat label="Run-rate (MRR × 12)" value={money(r.arr)} />
        <Stat label="Paid this month" value={money(r.paidThisMonth)} tone="good" />
        <Stat label="Outstanding (sent + overdue)" value={money(r.outstanding)} onClick={() => go('/invoices?status=Sent')} />
        <Stat label="Overdue" value={money(r.overdue)} sub={`${r.overdueCount} invoice${r.overdueCount === 1 ? '' : 's'}`} tone={r.overdue ? 'warn' : undefined} onClick={() => go('/invoices?status=Overdue')} />
        <Stat label="Paid vs billed (all time)" value={Number.isFinite(collected) ? `${Math.round(collected * 100)}%` : '—'} sub={`${money(r.paidAllTime)} paid · ${money(r.draft)} in drafts`} />
      </div>
      <section className="card">
        <div className="card-head"><h3>Last 12 months</h3><div className="legend"><span className="sw invoiced" /> Invoiced (by issue date) <span className="sw paid" /> Paid (by payment date)</div></div>
        <MonthBars series={series} />
        <table className="table compact-table">
          <thead><tr><th>Month</th><th className="num">Invoiced</th><th className="num">Paid</th></tr></thead>
          <tbody>{[...series].reverse().map((s) => <tr key={s.month}><td>{monthLabel(s.month)}</td><td className="num">{money(s.invoiced)}</td><td className="num">{money(s.paid)}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="card flush">
        <div className="card-head pad"><h3>By client</h3></div>
        {byClient.length ? (
          <table className="table">
            <thead><tr><th>Client</th><th>Status</th><th className="num">Retainer/mo</th><th className="num">Paid to date</th><th className="num">Outstanding</th><th className="num">Overdue</th></tr></thead>
            <tbody>{byClient.map(({ c, paid, open, overdue }) => (
              <tr key={c.id} className="clickable" onClick={() => go(`/clients/${c.id}`)}>
                <td>{c.company} <DemoTag show={c.demo} /></td><td>{c.status}</td><td className="num">{money(c.retainer)}</td><td className="num">{money(paid)}</td><td className="num">{money(open)}</td><td className={`num ${overdue ? 'warn-text' : ''}`}>{money(overdue)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <Empty>No clients yet.</Empty>}
      </section>
    </>
  );
}
