import { describe, expect, it } from 'vitest';
import { clientView } from './access';
import { demoData } from './seed';

describe('clientView (demo-mode mirror of RLS)', () => {
  const data = demoData();
  const polar = data.clients[0];
  const v = clientView(data, polar.id);
  it('keeps only this client', () => {
    expect(v.clients.map((c) => c.id)).toEqual([polar.id]);
    expect(v.campaigns.every((c) => c.clientId === polar.id)).toBe(true);
    expect(v.contacts.every((c) => c.clientId === polar.id)).toBe(true);
  });
  it('hides internal data', () => {
    expect(v.leads).toEqual([]);
    expect(v.tasks).toEqual([]);
    expect(v.clients[0].notes).toEqual([]);
    expect(v.settings.team).toEqual([]);
  });
  it('shows only sent/paid invoices and published reports', () => {
    expect(v.invoices.length).toBeGreaterThan(0);
    expect(v.invoices.every((i) => i.clientId === polar.id && ['Sent', 'Paid'].includes(i.status))).toBe(true);
    expect(data.reports.some((r) => r.clientId === polar.id && !r.published)).toBe(true);
    expect(v.reports.length).toBe(1);
    expect(v.reports.every((r) => r.published)).toBe(true);
  });
});
