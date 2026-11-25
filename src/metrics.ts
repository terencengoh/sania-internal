import type { Data } from './types';
import { invoiceStatus, invoiceTotal, monthKey, shiftMonth, today } from './utils';

export function revenueMetrics(data: Data) {
  const t = today();
  const thisMonth = monthKey();
  const active = data.clients.filter((c) => c.status === 'Active');
  const mrr = active.reduce((s, c) => s + (Number(c.retainer) || 0), 0);
  let paidThisMonth = 0, outstanding = 0, overdue = 0, overdueCount = 0, draft = 0, paidAllTime = 0;
  for (const inv of data.invoices) {
    const total = invoiceTotal(inv);
    const st = invoiceStatus(inv, t);
    if (st === 'Paid') {
      paidAllTime += total;
      if ((inv.paidDate || inv.issueDate).slice(0, 7) === thisMonth) paidThisMonth += total;
    } else if (st === 'Sent') outstanding += total;
    else if (st === 'Overdue') { outstanding += total; overdue += total; overdueCount++; }
    else if (st === 'Draft') draft += total;
  }
  return { mrr, arr: mrr * 12, activeClients: active.length, paidThisMonth, outstanding, overdue, overdueCount, draft, paidAllTime };
}

/** Paid vs invoiced per month for the last `n` months (oldest first). */
export function monthlySeries(data: Data, n = 6) {
  const cur = monthKey();
  const months = Array.from({ length: n }, (_, i) => shiftMonth(cur, i - (n - 1)));
  return months.map((m) => {
    let invoiced = 0, paid = 0;
    for (const inv of data.invoices) {
      if (inv.status === 'Void' || inv.status === 'Draft') continue;
      const total = invoiceTotal(inv);
      if (inv.issueDate.slice(0, 7) === m) invoiced += total;
      if (inv.status === 'Paid' && (inv.paidDate || inv.issueDate).slice(0, 7) === m) paid += total;
    }
    return { month: m, invoiced, paid };
  });
}

export function pipelineMetrics(data: Data) {
  const open = data.leads.filter((l) => l.stage !== 'Won' && l.stage !== 'Lost');
  const won = data.leads.filter((l) => l.stage === 'Won').length;
  const lost = data.leads.filter((l) => l.stage === 'Lost').length;
  return {
    openCount: open.length,
    openValue: open.reduce((s, l) => s + (Number(l.value) || 0), 0),
    winRate: won + lost > 0 ? won / (won + lost) : NaN,
  };
}
