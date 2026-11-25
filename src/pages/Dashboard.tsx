import { useStore } from '../store';
import { go } from '../router';
import { LEAD_STAGES } from '../types';
import { monthlySeries, pipelineMetrics, revenueMetrics } from '../metrics';
import { Badge, DemoTag, Empty, PageHead, Stat } from '../components/ui';
import { HBars, MonthBars } from '../components/Bars';
import { addDays, clientName, fmtDate, invoiceStatus, invoiceTotal, money, pct, today } from '../utils';

export default function Dashboard() {
  const { data } = useStore();
  const t = today();
  const rev = revenueMetrics(data);
  const pipe = pipelineMetrics(data);
  const followUps = data.leads
    .filter((l) => l.followUp && l.followUp <= addDays(t, 3) && l.stage !== 'Won' && l.stage !== 'Lost')
    .sort((a, b) => a.followUp.localeCompare(b.followUp));
  const openTasks = data.tasks.filter((x) => x.status !== 'Done');
  const overdueTasks = openTasks.filter((x) => x.due && x.due < t);
  const upcoming = openTasks.filter((x) => x.due && x.due <= addDays(t, 7)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8);
  const overdueInv = data.invoices.filter((i) => invoiceStatus(i, t) === 'Overdue');
  const activeCampaigns = data.campaigns.filter((c) => c.status === 'Active').length;

  return (
    <>
      <PageHead title="Dashboard" sub={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}>
        <button className="btn" onClick={() => go('/leads?new=1')}>+ Lead</button>
        <button className="btn" onClick={() => go('/tasks?new=1')}>+ Task</button>
        <button className="btn primary" onClick={() => go('/invoices?new=1')}>+ Invoice</button>
      </PageHead>

      <div className="stats">
        <Stat label="MRR (active retainers)" value={money(rev.mrr)} sub={`${rev.activeClients} active client${rev.activeClients === 1 ? '' : 's'}`} onClick={() => go('/revenue')} />
        <Stat label="Paid this month" value={money(rev.paidThisMonth)} tone="good" onClick={() => go('/invoices?status=Paid')} />
        <Stat label="Outstanding" value={money(rev.outstanding)} sub={rev.overdue ? <span className="warn-text">{money(rev.overdue)} overdue</span> : 'none overdue'} tone={rev.overdue ? 'warn' : undefined} onClick={() => go('/invoices?status=Overdue')} />
        <Stat label="Open pipeline" value={money(pipe.openValue)} sub={`${pipe.openCount} open lead${pipe.openCount === 1 ? '' : 's'} · win rate ${pct(pipe.winRate)}`} onClick={() => go('/leads')} />
        <Stat label="Active campaigns" value={activeCampaigns} onClick={() => go('/campaigns?status=Active')} />
        <Stat label="Overdue tasks" value={overdueTasks.length} tone={overdueTasks.length ? 'warn' : 'good'} onClick={() => go('/tasks?view=overdue')} />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h3>Follow-ups due (next 3 days)</h3><a href="#/leads">All leads →</a></div>
          {followUps.length ? (
            <ul className="list">
              {followUps.map((l) => (
                <li key={l.id} onClick={() => go(`/leads?open=${l.id}`)} className="clickable">
                  <div><strong>{l.company}</strong> <DemoTag show={l.demo} /><div className="muted small">{l.contactName} · {l.phone}</div></div>
                  <div className="right"><Badge>{l.stage}</Badge><div className={`small ${l.followUp < t ? 'warn-text' : 'muted'}`}>{l.followUp < t ? 'Overdue · ' : ''}{fmtDate(l.followUp)}</div></div>
                </li>
              ))}
            </ul>
          ) : <Empty>No follow-ups due. Nice.</Empty>}
        </section>

        <section className="card">
          <div className="card-head"><h3>Tasks due this week</h3><a href="#/tasks">Task board →</a></div>
          {upcoming.length ? (
            <ul className="list">
              {upcoming.map((x) => (
                <li key={x.id} onClick={() => go(`/tasks?open=${x.id}`)} className="clickable">
                  <div><strong>{x.title}</strong> <DemoTag show={x.demo} /><div className="muted small">{x.clientId ? clientName(data, x.clientId) : 'Internal'} · {x.assignee || 'Unassigned'}</div></div>
                  <div className="right"><Badge>{x.status}</Badge><div className={`small ${x.due < t ? 'warn-text' : 'muted'}`}>{fmtDate(x.due)}</div></div>
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing due in the next 7 days.</Empty>}
        </section>

        <section className="card">
          <div className="card-head"><h3>Cash: invoiced vs paid (6 months)</h3><a href="#/revenue">Revenue →</a></div>
          <MonthBars series={monthlySeries(data, 6)} />
          <div className="legend"><span className="sw invoiced" /> Invoiced <span className="sw paid" /> Paid</div>
        </section>

        <section className="card">
          <div className="card-head"><h3>Pipeline by stage</h3><a href="#/leads">Board →</a></div>
          <HBars rows={LEAD_STAGES.map((s) => {
            const ls = data.leads.filter((l) => l.stage === s);
            return { label: s, value: ls.length, display: `${ls.length} · ${money(ls.reduce((a, l) => a + l.value, 0))}` };
          })} />
        </section>
      </div>

      {overdueInv.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>Overdue invoices</h3><a href="#/invoices?status=Overdue">View →</a></div>
          <table className="table">
            <thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {overdueInv.map((i) => (
                <tr key={i.id} className="clickable" onClick={() => go(`/invoices/${i.id}`)}>
                  <td>{i.number} <DemoTag show={i.demo} /></td><td>{clientName(data, i.clientId)}</td><td className="warn-text">{fmtDate(i.dueDate)}</td><td className="num">{money(invoiceTotal(i), true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
