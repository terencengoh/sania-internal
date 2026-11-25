import type { SupabaseClient } from '@supabase/supabase-js';
import type { Backend } from './types';
import type { Data } from '../types';
import { planWrites, rowsToData, TABLES, type Rows, type Table } from './mapping';

const PAGE = 1000;

async function fetchAll(sb: SupabaseClient, table: Table) {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** LIVE mode: Supabase Postgres. Row Level Security decides what each signed-in user can read/write. */
export function supabaseBackend(sb: SupabaseClient): Backend {
  let queue: Promise<void> = Promise.resolve();
  return {
    kind: 'supabase',
    async load(): Promise<Data> {
      const entries = await Promise.all(TABLES.map(async (t) => [t, await fetchAll(sb, t)] as const));
      return rowsToData(Object.fromEntries(entries) as unknown as Rows);
    },
    persist(prev: Data, next: Data) {
      const plan = planWrites(prev, next);
      // serialize writes so they reach the database in order
      const run = async () => {
        for (const u of plan.upserts) {
          const conflict = u.table === 'team_members' ? 'name' : 'id';
          for (let i = 0; i < u.rows.length; i += 500) {
            const { error } = await sb.from(u.table).upsert(u.rows.slice(i, i + 500), { onConflict: conflict, defaultToNull: false });
            if (error) throw new Error(`Saving ${u.table}: ${error.message}`);
          }
        }
        for (const d of plan.deletes) {
          const { error } = await sb.from(d.table).delete().in('id', d.ids);
          if (error) throw new Error(`Deleting from ${d.table}: ${error.message}`);
        }
        if (plan.teamRemove.length) {
          const { error } = await sb.from('team_members').delete().in('name', plan.teamRemove);
          if (error) throw new Error(`Saving team: ${error.message}`);
        }
      };
      const p = queue.then(run);
      queue = p.catch(() => undefined);
      return p;
    },
  };
}
