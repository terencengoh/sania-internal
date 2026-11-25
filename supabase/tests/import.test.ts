// Proves the app's Data <-> row mapping matches the real schema: the full demo dataset is written the way
// PostgREST writes it (json_populate_recordset), read back as JSON, and mapped back to identical app data.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { dataToRows, rowsToData, TABLES, type Rows } from '../../src/backend/mapping';
import { demoData } from '../../src/seed';

const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
let db: PGlite;

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin;
  `);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(dir + f, 'utf8'));
}, 60_000);
afterAll(async () => { await db?.close(); });

it('imports the full demo dataset into the schema and reads it back unchanged', async () => {
  const data = demoData();
  const rows = dataToRows(data);
  await db.exec('delete from settings');
  for (const t of TABLES) {
    if (!rows[t].length) continue;
    // like PostgREST with defaultToNull=false: only the given columns are written, the rest use defaults
    const cols = Object.keys(rows[t][0]).map((c) => `"${c}"`).join(', ');
    await db.query(`insert into public.${t} (${cols}) select ${cols} from jsonb_populate_recordset(null::public.${t}, $1::jsonb)`, [JSON.stringify(rows[t])]);
  }
  const back: Partial<Rows> = {};
  for (const t of TABLES) {
    const res = await db.query<{ j: Record<string, unknown>[] }>(`select coalesce(jsonb_agg(x), '[]'::jsonb) as j from public.${t} x`);
    back[t] = res.rows[0].j;
  }
  const t = (s: string) => new Date(s).getTime();
  const norm = (d: ReturnType<typeof rowsToData>) => JSON.parse(JSON.stringify({
    ...d,
    clients: d.clients.map((c) => ({ ...c, createdAt: t(c.createdAt), notes: c.notes.map((n) => ({ ...n, date: t(n.date) })).sort((a, b) => b.date - a.date) })),
    leads: d.leads.map((l) => ({ ...l, createdAt: t(l.createdAt), notes: l.notes.map((n) => ({ ...n, date: t(n.date) })).sort((a, b) => b.date - a.date) })),
    contacts: d.contacts.map((x) => ({ ...x, createdAt: t(x.createdAt) })),
    campaigns: d.campaigns.map((x) => ({ ...x, createdAt: t(x.createdAt) })),
    tasks: d.tasks.map((x) => ({ ...x, createdAt: t(x.createdAt) })),
    invoices: d.invoices.map((x) => ({ ...x, createdAt: t(x.createdAt) })),
    reports: d.reports.map((x) => ({ ...x, createdAt: t(x.createdAt) })),
  }));
  const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
  const a = norm(rowsToData(back)), b = norm(data);
  for (const k of ['clients', 'leads', 'contacts', 'campaigns', 'tasks', 'invoices', 'reports'] as const) {
    expect(byId(a[k]), k).toEqual(byId(b[k]));
  }
  expect(a.settings).toEqual(b.settings);
});
