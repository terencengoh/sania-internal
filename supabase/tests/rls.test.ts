// Runs the real migrations in PGlite (WASM Postgres) with minimal Supabase stubs
// (auth schema, auth.uid(), anon/authenticated roles) and proves the access rules.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
let db: PGlite;

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OWNER = uid(1), STAFF = uid(2), CLIENT_A = uid(3), CLIENT_B = uid(4), STRANGER = uid(5), STAFF2 = uid(6);

async function claims(sub: string) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
}
async function as<T>(id: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('set role authenticated');
  await claims(id);
  try { return await fn(); } finally { await db.exec('reset role'); await claims(''); }
}
async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec('set role anon');
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const rows = async (sql: string, params: unknown[] = []) => (await db.query<Record<string, unknown>>(sql, params)).rows;
const ids = async (sql: string) => (await rows(sql)).map((r) => r.id as string).sort();
const count = async (sql: string) => Number((await rows(`select count(*)::int as n from (${sql}) x`))[0].n);

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on all functions in schema auth to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
  `);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await db.exec(readFileSync(dir + f, 'utf8'));

  // business data (as superuser, like the SQL editor / import)
  await db.exec(`
    insert into clients (id, company) values ('cA', 'Alpha HVAC'), ('cB', 'Bravo Air');
    insert into contacts (id, client_id, name) values ('ctA', 'cA', 'Alice'), ('ctB', 'cB', 'Bob');
    insert into leads (id, company, client_id) values ('l1', 'Lead One', null), ('l2', 'Alpha HVAC', 'cA');
    insert into notes (id, lead_id, text) values ('n1', 'l1', 'internal lead note');
    insert into notes (id, client_id, text) values ('n2', 'cA', 'internal client note: margin is thin');
    insert into campaigns (id, client_id, name) values ('kA', 'cA', 'Alpha Search'), ('kB', 'cB', 'Bravo LSA');
    insert into deliverables (id, campaign_id, text, done) values ('dA1', 'kA', 'Keywords', true), ('dA2', 'kA', 'Ads', false), ('dB1', 'kB', 'Profile', false);
    insert into team_members (id, name) values ('t1', 'Terence');
    insert into tasks (id, title, client_id) values ('tk1', 'Internal task for Alpha', 'cA');
    insert into invoices (id, number, client_id, status) values
      ('iA-draft', 'A-1', 'cA', 'Draft'), ('iA-sent', 'A-2', 'cA', 'Sent'), ('iA-paid', 'A-3', 'cA', 'Paid'), ('iA-void', 'A-4', 'cA', 'Void'),
      ('iB-sent', 'B-1', 'cB', 'Sent');
    insert into invoice_items (id, invoice_id, description, rate) values
      ('ii1', 'iA-draft', 'draft item', 1), ('ii2', 'iA-sent', 'sent item', 2), ('ii3', 'iA-paid', 'paid item', 3), ('ii4', 'iB-sent', 'B item', 4);
    insert into reports (id, client_id, month, published) values
      ('rA-pub', 'cA', '2026-10', true), ('rA-draft', 'cA', '2026-11', false), ('rB-pub', 'cB', '2026-10', true);
    insert into invitations (email, role) values ('staff@sania.example', 'staff');
    insert into invitations (email, role, client_id) values ('alice@alpha.example', 'client', 'cA'), ('bob@bravo.example', 'client', 'cB');
  `);
  // auth users: trigger creates profiles from invitations
  for (const [id, email] of [[OWNER, 'owner@sania.example'], [STAFF, 'STAFF@sania.example'], [CLIENT_A, 'alice@alpha.example'], [CLIENT_B, 'bob@bravo.example'], [STRANGER, 'random@evil.example']]) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  }
  await db.query(`update profiles set role = 'owner' where id = $1`, [OWNER]); // SETUP.md step: make the first owner
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('invite-only sign-up', () => {
  it('assigns roles only from invitations; strangers get no access', async () => {
    const p = await rows('select id, role, client_id from profiles order by id');
    expect(p).toEqual([
      { id: OWNER, role: 'owner', client_id: null },
      { id: STAFF, role: 'staff', client_id: null },
      { id: CLIENT_A, role: 'client', client_id: 'cA' },
      { id: CLIENT_B, role: 'client', client_id: 'cB' },
      { id: STRANGER, role: 'client', client_id: null },
    ]);
    expect(await count(`select 1 from invitations where accepted_at is null`)).toBe(0);
  });
});

describe('client user A', () => {
  const A = <T>(fn: () => Promise<T>) => as(CLIENT_A, fn);
  it('sees only their own client row and contacts', async () => {
    expect(await A(() => ids('select id from clients'))).toEqual(['cA']);
    expect(await A(() => ids('select id from contacts'))).toEqual(['ctA']);
  });
  it('sees only their campaigns and deliverable progress', async () => {
    expect(await A(() => ids('select id from campaigns'))).toEqual(['kA']);
    expect(await A(() => ids('select id from deliverables'))).toEqual(['dA1', 'dA2']);
  });
  it('sees only Sent/Paid invoices (never drafts or void) and their items', async () => {
    expect(await A(() => ids('select id from invoices'))).toEqual(['iA-paid', 'iA-sent']);
    expect(await A(() => ids('select id from invoice_items'))).toEqual(['ii2', 'ii3']);
  });
  it('sees only published reports', async () => {
    expect(await A(() => ids('select id from reports'))).toEqual(['rA-pub']);
  });
  it('never sees leads, internal notes, tasks, team or invitations', async () => {
    for (const t of ['leads', 'notes', 'tasks', 'team_members', 'invitations']) {
      expect(await A(() => count(`select 1 from ${t}`)), t).toBe(0);
    }
  });
  it('can read agency settings (printed on invoices) and only their own profile', async () => {
    expect(await A(() => count('select 1 from settings'))).toBe(1);
    expect(await A(() => ids('select id from profiles'))).toEqual([CLIENT_A]);
  });
  it('cannot write anything', async () => {
    await expect(A(() => rows(`insert into clients (id, company) values ('x', 'x')`))).rejects.toThrow(/row-level security/);
    await expect(A(() => rows(`insert into reports (client_id, month, published) values ('cA', '2026-12', true)`))).rejects.toThrow(/row-level security/);
    expect(await A(() => rows(`update invoices set status = 'Paid' where id = 'iA-sent' returning id`))).toEqual([]);
    expect(await A(() => rows(`update deliverables set done = true where id = 'dA2' returning id`))).toEqual([]);
    expect(await A(() => rows(`delete from invoices returning id`))).toEqual([]);
    expect(await A(() => rows(`update profiles set role = 'owner', client_id = 'cB' where id = '${CLIENT_A}' returning id`))).toEqual([]);
    await expect(A(() => rows(`insert into invitations (email, role) values ('me2@x.example', 'staff')`))).rejects.toThrow(/row-level security/);
    expect(await rows(`select role, client_id from profiles where id = '${CLIENT_A}'`)).toEqual([{ role: 'client', client_id: 'cA' }]);
    expect(await rows(`select status from invoices where id = 'iA-sent'`)).toEqual([{ status: 'Sent' }]);
  });
  it('cannot read client B data even by asking for it directly', async () => {
    expect(await A(() => count(`select 1 from invoices where client_id = 'cB'`))).toBe(0);
    expect(await A(() => count(`select 1 from reports where id = 'rB-pub'`))).toBe(0);
    expect(await A(() => count(`select 1 from deliverables where campaign_id = 'kB'`))).toBe(0);
  });
});

describe('client user B', () => {
  it('is isolated from A', async () => {
    const r = await as(CLIENT_B, async () => ({
      clients: await ids('select id from clients'), invoices: await ids('select id from invoices'),
      reports: await ids('select id from reports'), items: await ids('select id from invoice_items'),
    }));
    expect(r).toEqual({ clients: ['cB'], invoices: ['iB-sent'], reports: ['rB-pub'], items: ['ii4'] });
  });
});

describe('signed-in user without an invitation, and anonymous visitors', () => {
  it('stranger sees nothing', async () => {
    for (const t of ['clients', 'contacts', 'leads', 'notes', 'campaigns', 'deliverables', 'tasks', 'invoices', 'invoice_items', 'reports', 'settings', 'team_members', 'invitations']) {
      expect(await as(STRANGER, () => count(`select 1 from ${t}`)), t).toBe(0);
    }
  });
  it('anon has no table privileges at all', async () => {
    await expect(asAnon(() => rows('select * from clients'))).rejects.toThrow(/permission denied/);
    await expect(asAnon(() => rows('select * from invoices'))).rejects.toThrow(/permission denied/);
  });
});

describe('staff and owner', () => {
  it('staff see everything, including drafts and internal notes', async () => {
    const r = await as(STAFF, async () => ({
      clients: await count('select 1 from clients'), invoices: await count('select 1 from invoices'),
      reports: await count('select 1 from reports'), notes: await count('select 1 from notes'),
      leads: await count('select 1 from leads'), profiles: await count('select 1 from profiles'),
    }));
    expect(r).toEqual({ clients: 2, invoices: 5, reports: 3, notes: 2, leads: 2, profiles: 5 });
  });
  it('staff can write business data and invite clients, but not staff, and cannot change roles', async () => {
    await as(STAFF, () => rows(`update reports set published = true where id = 'rA-draft'`));
    expect((await rows(`select published, published_at is not null as stamped from reports where id = 'rA-draft'`))[0]).toEqual({ published: true, stamped: true });
    await as(STAFF, () => rows(`update reports set published = false where id = 'rA-draft'`));
    await as(STAFF, () => rows(`insert into invitations (email, role, client_id) values ('carol@alpha.example', 'client', 'cA')`));
    await expect(as(STAFF, () => rows(`insert into invitations (email, role) values ('pal@x.example', 'staff')`))).rejects.toThrow(/row-level security/);
    expect(await as(STAFF, () => rows(`update profiles set role = 'owner' where id = '${STAFF}' returning id`))).toEqual([]);
    expect(await as(STAFF, () => rows(`update profiles set client_id = 'cB' where id = '${CLIENT_A}' returning id`))).toEqual([]);
  });
  it('owner can invite staff, relink a client user, and cannot change their own role', async () => {
    await as(OWNER, () => rows(`insert into invitations (email, role) values ('newstaff@sania.example', 'staff')`));
    await db.query('insert into auth.users (id, email) values ($1, $2)', [STAFF2, 'newstaff@sania.example']);
    expect(await rows(`select role from profiles where id = '${STAFF2}'`)).toEqual([{ role: 'staff' }]);
    await as(OWNER, () => rows(`update profiles set client_id = 'cB' where id = '${STRANGER}'`));
    expect(await as(STRANGER, () => ids('select id from clients'))).toEqual(['cB']);
    await expect(as(OWNER, () => rows(`update profiles set role = 'staff' where id = '${OWNER}'`))).rejects.toThrow(/own role/);
  });
  it('client invitations require a client', async () => {
    await expect(as(OWNER, () => rows(`insert into invitations (email, role) values ('nolink@x.example', 'client')`))).rejects.toThrow(/check constraint/);
  });
});
