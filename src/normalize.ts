import type { Collection, Data, Settings } from './types';
import { defaultSettings, emptyData } from './seed';

export const COLLECTIONS: Collection[] = ['leads', 'clients', 'contacts', 'campaigns', 'tasks', 'invoices', 'reports'];

/** Validate/normalize anything loaded from storage or an import file. Throws on bad input. */
export function normalize(raw: unknown): Data {
  if (!raw || typeof raw !== 'object') throw new Error('Not a SANIA backup file (expected a JSON object).');
  const r = raw as Record<string, unknown>;
  const base = emptyData();
  for (const c of COLLECTIONS) {
    const v = r[c];
    if (v === undefined) continue;
    if (!Array.isArray(v)) throw new Error(`"${c}" must be a list.`);
    (base as unknown as Record<string, unknown>)[c] = v.filter((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string');
  }
  base.settings = { ...defaultSettings(), ...((r.settings as Partial<Settings>) ?? {}) };
  if (!Array.isArray(base.settings.team) || !base.settings.team.length) base.settings.team = defaultSettings().team;
  return base;
}
