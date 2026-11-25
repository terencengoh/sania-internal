import type { Client, Data, EffectiveInvoiceStatus, Invoice, ReportKpis } from './types';

export const uid = (): string =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

export const nowIso = () => new Date().toISOString();

/** Local date as YYYY-MM-DD */
export const ymd = (d: Date = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const today = () => ymd();
export const addDays = (base: string, days: number): string => {
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return ymd(d);
};
export const monthKey = (d: Date = new Date()) => ymd(d).slice(0, 7);
export const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
};
export const monthLabel = (month: string) => {
  if (!month) return '';
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n: number, cents = false) => (cents ? usd2 : usd0).format(Number.isFinite(n) ? n : 0);
export const num = (n: number) => new Intl.NumberFormat('en-US').format(Number.isFinite(n) ? n : 0);
export const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—');

export const fmtDate = (s: string) => {
  if (!s) return '—';
  const d = new Date(s.length === 10 ? s + 'T12:00:00' : s);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);

export const invoiceTotal = (inv: Invoice) =>
  inv.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);

export const invoiceStatus = (inv: Invoice, ref = today()): EffectiveInvoiceStatus =>
  inv.status === 'Sent' && inv.dueDate && inv.dueDate < ref ? 'Overdue' : inv.status;

export const clientName = (data: Data, id: string) => data.clients.find((c) => c.id === id)?.company ?? '—';
export const clientById = (data: Data, id: string): Client | undefined => data.clients.find((c) => c.id === id);

export const safeDiv = (a: number, b: number) => (b > 0 ? a / b : NaN);

export const derivedKpis = (k: ReportKpis) => ({
  ctr: safeDiv(k.clicks, k.impressions),
  cpc: safeDiv(k.spend, k.clicks),
  cpl: safeDiv(k.spend, k.leads),
  convRate: safeDiv(k.leads, k.clicks),
  costPerJob: safeDiv(k.spend, k.bookedJobs),
  roas: safeDiv(k.revenue, k.spend),
});

export const download = (filename: string, text: string, type = 'application/json') => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const csvEscape = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\n');
};
