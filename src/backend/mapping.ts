/* Maps the app's nested Data shape <-> normalized Supabase rows. Pure functions (unit-tested). */
import type { Campaign, Client, Contact, Data, Invoice, Lead, Note, Report, ReportKpis, Settings, Task } from '../types';
import { defaultSettings } from '../seed';

type Row = Record<string, unknown>;
const d = (s: string | undefined | null) => (s ? s : null); // '' -> null for date columns
const str = (v: unknown) => (v == null ? '' : String(v));
const n = (v: unknown) => (v == null || v === '' ? 0 : Number(v));
const day = (v: unknown) => (v ? String(v).slice(0, 10) : '');

export const TABLES = ['settings', 'team_members', 'clients', 'contacts', 'leads', 'notes', 'campaigns', 'deliverables', 'tasks', 'invoices', 'invoice_items', 'reports'] as const;
export type Table = (typeof TABLES)[number];
export type Rows = Record<Table, Row[]>;

/* ----------------------------------------------------------------- to rows */
export const clientRow = (c: Client): Row => ({
  id: c.id, company: c.company, contact_name: c.contactName, email: c.email, phone: c.phone, city: c.city, state: c.state,
  website: c.website, status: c.status, retainer: n(c.retainer), start_date: d(c.startDate), services: c.services ?? [],
  lead_id: c.leadId ?? null, demo: !!c.demo, created_at: c.createdAt,
});
export const leadRow = (l: Lead): Row => ({
  id: l.id, company: l.company, contact_name: l.contactName, email: l.email, phone: l.phone, city: l.city, state: l.state,
  source: l.source, stage: l.stage, value: n(l.value), follow_up: d(l.followUp), services: l.services ?? [],
  lost_reason: l.lostReason ?? null, client_id: l.clientId ?? null, demo: !!l.demo, created_at: l.createdAt,
});
export const noteRows = (notes: Note[], owner: { lead_id?: string; client_id?: string }): Row[] =>
  notes.map((x) => ({ id: x.id, lead_id: owner.lead_id ?? null, client_id: owner.client_id ?? null, date: x.date, text: x.text }));
export const contactRow = (c: Contact): Row => ({
  id: c.id, client_id: c.clientId, name: c.name, email: c.email, phone: c.phone, title: c.title, demo: !!c.demo, created_at: c.createdAt,
});
export const campaignRow = (c: Campaign): Row => ({
  id: c.id, client_id: c.clientId, name: c.name, channel: c.channel, status: c.status, monthly_budget: n(c.monthlyBudget),
  start_date: d(c.startDate), end_date: d(c.endDate), goal: c.goal, demo: !!c.demo, created_at: c.createdAt,
});
export const deliverableRows = (c: Campaign): Row[] =>
  c.deliverables.map((x, i) => ({ id: x.id, campaign_id: c.id, text: x.text, done: x.done, position: i }));
export const taskRow = (t: Task): Row => ({
  id: t.id, title: t.title, description: t.description, client_id: t.clientId || null, campaign_id: t.campaignId || null,
  assignee: t.assignee, due: d(t.due), status: t.status, priority: t.priority, demo: !!t.demo, created_at: t.createdAt,
});
export const invoiceRow = (i: Invoice): Row => ({
  id: i.id, number: i.number, client_id: i.clientId || null, issue_date: d(i.issueDate), due_date: d(i.dueDate), status: i.status,
  notes: i.notes, paid_date: d(i.paidDate), retainer_month: i.retainerMonth ?? null, demo: !!i.demo, created_at: i.createdAt,
});
export const itemRows = (i: Invoice): Row[] =>
  i.items.map((x, idx) => ({ id: x.id, invoice_id: i.id, description: x.description, qty: n(x.qty), rate: n(x.rate), position: idx }));
export const reportRow = (r: Report): Row => ({
  id: r.id, client_id: r.clientId, month: r.month, kpis: r.kpis, previous: r.previous ?? null, highlights: r.highlights,
  next_steps: r.nextSteps, published: !!r.published, demo: !!r.demo, created_at: r.createdAt,
});
export const settingsRow = (s: Settings): Row => ({
  id: 1, agency_name: s.agencyName, tagline: s.tagline, email: s.email, phone: s.phone, website: s.website, address: s.address,
  invoice_prefix: s.invoicePrefix, next_invoice_number: Math.floor(n(s.nextInvoiceNumber)), payment_terms_days: Math.floor(n(s.paymentTermsDays)),
  invoice_footer: s.invoiceFooter,
});

/* ----------------------------------------------------------------- from rows */
const kpis = (v: unknown): ReportKpis => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { spend: n(o.spend), impressions: n(o.impressions), clicks: n(o.clicks), leads: n(o.leads), calls: n(o.calls), bookedJobs: n(o.bookedJobs), revenue: n(o.revenue) };
};

export function rowsToData(r: Partial<Rows>): Data {
  const get = (t: Table) => r[t] ?? [];
  const notesBy = (key: 'lead_id' | 'client_id', id: string): Note[] =>
    get('notes').filter((x) => x[key] === id).map((x) => ({ id: str(x.id), date: str(x.date), text: str(x.text) }))
      .sort((a, b) => b.date.localeCompare(a.date));
  const s = get('settings')[0];
  const def = defaultSettings();
  const team = get('team_members').map((t) => str(t.name)).filter(Boolean);
  return {
    version: 1,
    clients: get('clients').map((c) => ({
      id: str(c.id), createdAt: str(c.created_at), demo: !!c.demo, company: str(c.company), contactName: str(c.contact_name), email: str(c.email),
      phone: str(c.phone), city: str(c.city), state: str(c.state), website: str(c.website), status: (str(c.status) || 'Active') as Client['status'],
      retainer: n(c.retainer), startDate: day(c.start_date), services: (c.services as string[]) ?? [], notes: notesBy('client_id', str(c.id)),
      leadId: c.lead_id ? str(c.lead_id) : undefined,
    })),
    contacts: get('contacts').map((c) => ({
      id: str(c.id), createdAt: str(c.created_at), demo: !!c.demo, clientId: str(c.client_id), name: str(c.name), email: str(c.email), phone: str(c.phone), title: str(c.title),
    })),
    leads: get('leads').map((l) => ({
      id: str(l.id), createdAt: str(l.created_at), demo: !!l.demo, company: str(l.company), contactName: str(l.contact_name), email: str(l.email),
      phone: str(l.phone), city: str(l.city), state: str(l.state), source: str(l.source), stage: (str(l.stage) || 'New') as Lead['stage'],
      value: n(l.value), followUp: day(l.follow_up), services: (l.services as string[]) ?? [], notes: notesBy('lead_id', str(l.id)),
      lostReason: l.lost_reason ? str(l.lost_reason) : undefined, clientId: l.client_id ? str(l.client_id) : undefined,
    })),
    campaigns: get('campaigns').map((c) => ({
      id: str(c.id), createdAt: str(c.created_at), demo: !!c.demo, clientId: str(c.client_id), name: str(c.name), channel: str(c.channel),
      status: (str(c.status) || 'Planning') as Campaign['status'], monthlyBudget: n(c.monthly_budget), startDate: day(c.start_date), endDate: day(c.end_date), goal: str(c.goal),
      deliverables: get('deliverables').filter((x) => x.campaign_id === c.id).sort((a, b) => n(a.position) - n(b.position))
        .map((x) => ({ id: str(x.id), text: str(x.text), done: !!x.done })),
    })),
    tasks: get('tasks').map((t) => ({
      id: str(t.id), createdAt: str(t.created_at), demo: !!t.demo, title: str(t.title), description: str(t.description), clientId: str(t.client_id),
      campaignId: str(t.campaign_id), assignee: str(t.assignee), due: day(t.due), status: (str(t.status) || 'To do') as Task['status'], priority: (str(t.priority) || 'Medium') as Task['priority'],
    })),
    invoices: get('invoices').map((i) => ({
      id: str(i.id), createdAt: str(i.created_at), demo: !!i.demo, number: str(i.number), clientId: str(i.client_id), issueDate: day(i.issue_date),
      dueDate: day(i.due_date), status: (str(i.status) || 'Draft') as Invoice['status'], notes: str(i.notes), paidDate: day(i.paid_date),
      retainerMonth: i.retainer_month ? str(i.retainer_month) : undefined,
      items: get('invoice_items').filter((x) => x.invoice_id === i.id).sort((a, b) => n(a.position) - n(b.position))
        .map((x) => ({ id: str(x.id), description: str(x.description), qty: n(x.qty), rate: n(x.rate) })),
    })),
    reports: get('reports').map((x) => ({
      id: str(x.id), createdAt: str(x.created_at), demo: !!x.demo, clientId: str(x.client_id), month: str(x.month), kpis: kpis(x.kpis),
      previous: x.previous ? kpis(x.previous) : undefined, highlights: str(x.highlights), nextSteps: str(x.next_steps), published: !!x.published,
    })),
    settings: s ? {
      agencyName: str(s.agency_name) || def.agencyName, tagline: str(s.tagline), email: str(s.email), phone: str(s.phone), website: str(s.website),
      address: str(s.address), team: team.length ? team : def.team, invoicePrefix: str(s.invoice_prefix), nextInvoiceNumber: n(s.next_invoice_number) || def.nextInvoiceNumber,
      paymentTermsDays: n(s.payment_terms_days), invoiceFooter: str(s.invoice_footer),
    } : { ...def, team: team.length ? team : def.team },
  };
}

/* ----------------------------------------------------------------- diff -> write plan */
export interface WritePlan {
  upserts: { table: Table; rows: Row[] }[];
  deletes: { table: Table; ids: string[] }[];
  /** team names to remove (team_members keyed by name) */
  teamRemove: string[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Computes the minimal set of row upserts/deletes to go from `prev` to `next`. Parent tables come first. */
export function planWrites(prev: Data, next: Data): WritePlan {
  const up = new Map<Table, Row[]>();
  const del = new Map<Table, string[]>();
  const push = (t: Table, rows: Row[]) => { if (rows.length) up.set(t, [...(up.get(t) ?? []), ...rows]); };
  const drop = (t: Table, ids: string[]) => { if (ids.length) del.set(t, [...(del.get(t) ?? []), ...ids]); };

  function diff<T extends { id: string }>(a: T[], b: T[], onChange: (x: T, old?: T) => void, onDelete: (x: T) => void) {
    const before = new Map(a.map((x) => [x.id, x]));
    const after = new Set(b.map((x) => x.id));
    for (const x of b) { const old = before.get(x.id); if (!old || !same(old, x)) onChange(x, old); }
    for (const x of a) if (!after.has(x.id)) onDelete(x);
  }
  const childIds = <C extends { id: string }>(oldList: C[] | undefined, newList: C[]) => {
    const keep = new Set(newList.map((c) => c.id));
    return (oldList ?? []).filter((c) => !keep.has(c.id)).map((c) => c.id);
  };

  if (!same(prev.settings, next.settings)) {
    const { team: _t, ...a } = prev.settings; const { team: _u, ...b } = next.settings;
    if (!same(a, b)) push('settings', [settingsRow(next.settings)]);
    const oldTeam = new Set(prev.settings.team);
    push('team_members', next.settings.team.filter((x) => !oldTeam.has(x)).map((name) => ({ name })));
  }
  const teamRemove = prev.settings.team.filter((x) => !next.settings.team.includes(x));

  diff(prev.clients, next.clients, (c, old) => {
    const { notes: _n, ...a } = old ?? ({} as Client); const { notes: _m, ...b } = c;
    if (!old || !same(a, b)) push('clients', [clientRow(c)]);
    push('notes', noteRows(c.notes.filter((x) => !old?.notes.some((o) => same(o, x))), { client_id: c.id }));
    drop('notes', childIds(old?.notes, c.notes));
  }, (c) => drop('clients', [c.id]));
  diff(prev.contacts, next.contacts, (c) => push('contacts', [contactRow(c)]), (c) => drop('contacts', [c.id]));
  diff(prev.leads, next.leads, (l, old) => {
    const { notes: _n, ...a } = old ?? ({} as Lead); const { notes: _m, ...b } = l;
    if (!old || !same(a, b)) push('leads', [leadRow(l)]);
    push('notes', noteRows(l.notes.filter((x) => !old?.notes.some((o) => same(o, x))), { lead_id: l.id }));
    drop('notes', childIds(old?.notes, l.notes));
  }, (l) => drop('leads', [l.id]));
  diff(prev.campaigns, next.campaigns, (c, old) => {
    push('campaigns', [campaignRow(c)]);
    push('deliverables', deliverableRows(c));
    drop('deliverables', childIds(old?.deliverables, c.deliverables));
  }, (c) => drop('campaigns', [c.id]));
  diff(prev.tasks, next.tasks, (t) => push('tasks', [taskRow(t)]), (t) => drop('tasks', [t.id]));
  diff(prev.invoices, next.invoices, (i, old) => {
    push('invoices', [invoiceRow(i)]);
    push('invoice_items', itemRows(i));
    drop('invoice_items', childIds(old?.items, i.items));
  }, (i) => drop('invoices', [i.id]));
  diff(prev.reports, next.reports, (r) => push('reports', [reportRow(r)]), (r) => drop('reports', [r.id]));

  const order: Table[] = ['settings', 'team_members', 'clients', 'contacts', 'leads', 'notes', 'campaigns', 'deliverables', 'tasks', 'invoices', 'invoice_items', 'reports'];
  return {
    upserts: order.filter((t) => up.has(t)).map((t) => ({ table: t, rows: up.get(t)! })),
    // children before parents
    deletes: [...order].reverse().filter((t) => del.has(t)).map((t) => ({ table: t, ids: del.get(t)! })),
    teamRemove,
  };
}

/** Flattens a full Data object into rows (used by tests and the import tool). */
export function dataToRows(x: Data): Rows {
  const empty: Data = { version: 1, leads: [], clients: [], contacts: [], campaigns: [], tasks: [], invoices: [], reports: [], settings: { ...x.settings, team: [] } };
  const plan = planWrites(empty, x);
  const rows = Object.fromEntries(TABLES.map((t) => [t, [] as Row[]])) as unknown as Rows;
  for (const u of plan.upserts) rows[u.table].push(...u.rows);
  rows.settings = [settingsRow(x.settings)];
  rows.team_members = x.settings.team.map((name, i) => ({ id: `t${i}`, name }));
  return rows;
}
