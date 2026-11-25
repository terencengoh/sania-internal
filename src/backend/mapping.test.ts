import { describe, expect, it } from 'vitest';
import { dataToRows, planWrites, rowsToData } from './mapping';
import { demoData } from '../seed';

describe('Supabase row mapping', () => {
  it('round-trips the full demo dataset', () => {
    const data = demoData();
    const back = rowsToData(dataToRows(data));
    const norm = (d: typeof data) => JSON.parse(JSON.stringify({ ...d, clients: d.clients.map((c) => ({ ...c, notes: [...c.notes].sort((a, b) => b.date.localeCompare(a.date)) })), leads: d.leads.map((l) => ({ ...l, notes: [...l.notes].sort((a, b) => b.date.localeCompare(a.date)) })) }));
    expect(norm(back)).toEqual(norm(data));
  });
  it('plans only the changed rows', () => {
    const a = demoData();
    const b = structuredClone(a);
    b.invoices[1] = { ...b.invoices[1], status: 'Sent', items: b.invoices[1].items.slice(1) };
    b.tasks = b.tasks.slice(1);
    b.campaigns[0].deliverables[0].done = !b.campaigns[0].deliverables[0].done;
    const plan = planWrites(a, b);
    expect(plan.upserts.map((u) => u.table)).toEqual(['campaigns', 'deliverables', 'invoices', 'invoice_items']);
    expect(plan.upserts.find((u) => u.table === 'invoices')!.rows).toHaveLength(1);
    expect(plan.deletes).toEqual([
      { table: 'invoice_items', ids: [a.invoices[1].items[0].id] },
      { table: 'tasks', ids: [a.tasks[0].id] },
    ]);
  });
  it('plans nothing when nothing changed', () => {
    const a = demoData();
    expect(planWrites(a, structuredClone(a))).toEqual({ upserts: [], deletes: [], teamRemove: [] });
  });
  it('adds a lead note without rewriting the lead', () => {
    const a = demoData();
    const b = structuredClone(a);
    b.leads[0].notes = [{ id: 'n-new', date: new Date().toISOString(), text: 'hi' }, ...b.leads[0].notes];
    const plan = planWrites(a, b);
    expect(plan.upserts).toEqual([{ table: 'notes', rows: [{ id: 'n-new', lead_id: b.leads[0].id, client_id: null, date: b.leads[0].notes[0].date, text: 'hi' }] }]);
  });
});
