import type { Data } from './types';

/**
 * Client-safe view of the data for one client. Mirrors the database Row Level Security rules
 * (supabase/migrations/*_auth_rls.sql). In live mode the database already enforces this;
 * in demo mode this filter is the only thing applied (demo mode is not real security).
 */
export function clientView(data: Data, clientId: string): Data {
  return {
    version: 1,
    clients: data.clients.filter((c) => c.id === clientId).map((c) => ({ ...c, notes: [] })),
    contacts: data.contacts.filter((c) => c.clientId === clientId),
    campaigns: data.campaigns.filter((c) => c.clientId === clientId),
    invoices: data.invoices.filter((i) => i.clientId === clientId && (i.status === 'Sent' || i.status === 'Paid')),
    reports: data.reports.filter((r) => r.clientId === clientId && !!r.published),
    leads: [],
    tasks: [],
    settings: { ...data.settings, team: [] },
  };
}
