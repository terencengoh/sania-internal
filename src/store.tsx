import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Collection, Data, Settings } from './types';
import { defaultSettings, demoData, emptyData } from './seed';

const KEY = 'sania-internal:data:v1';

type Item<C extends Collection> = Data[C][number];

interface Store {
  data: Data;
  upsert: <C extends Collection>(col: C, item: Item<C>) => void;
  remove: (col: Collection, id: string) => void;
  update: (fn: (d: Data) => Data) => void;
  setSettings: (s: Partial<Settings>) => void;
  replaceAll: (d: Data) => void;
  clearDemo: () => void;
  loadDemo: () => void;
  wipeAll: () => void;
  hasDemo: boolean;
  saveError: string;
}

const StoreCtx = createContext<Store | null>(null);

const COLLECTIONS: Collection[] = ['leads', 'clients', 'campaigns', 'tasks', 'invoices', 'reports'];

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

function load(): Data {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return normalize(JSON.parse(s));
  } catch {
    /* fall through to demo */
  }
  return demoData();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(load);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      setSaveError('');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save to browser storage.');
    }
  }, [data]);

  // keep multiple tabs in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try { setData(normalize(JSON.parse(e.newValue))); } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const upsert = useCallback(<C extends Collection>(col: C, item: Item<C>) => {
    setData((d) => {
      const list = d[col] as Item<C>[];
      const i = list.findIndex((x) => x.id === item.id);
      const next = i >= 0 ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
      return { ...d, [col]: next };
    });
  }, []);

  const remove = useCallback((col: Collection, id: string) => {
    setData((d) => {
      const next: Data = { ...d, [col]: (d[col] as { id: string }[]).filter((x) => x.id !== id) };
      // cascade: deleting a client removes its campaigns/reports, unlinks tasks/leads
      if (col === 'clients') {
        const campIds = new Set(next.campaigns.filter((c) => c.clientId === id).map((c) => c.id));
        next.campaigns = next.campaigns.filter((c) => c.clientId !== id);
        next.reports = next.reports.filter((r) => r.clientId !== id);
        next.tasks = next.tasks.map((t) => (t.clientId === id ? { ...t, clientId: '', campaignId: campIds.has(t.campaignId) ? '' : t.campaignId } : t));
        next.leads = next.leads.map((l) => (l.clientId === id ? { ...l, clientId: undefined } : l));
      }
      if (col === 'campaigns') next.tasks = next.tasks.map((t) => (t.campaignId === id ? { ...t, campaignId: '' } : t));
      return next;
    });
  }, []);

  const update = useCallback((fn: (d: Data) => Data) => setData(fn), []);
  const setSettings = useCallback((s: Partial<Settings>) => setData((d) => ({ ...d, settings: { ...d.settings, ...s } })), []);
  const replaceAll = useCallback((d: Data) => setData(normalize(d)), []);
  const clearDemo = useCallback(() => {
    setData((d) => {
      // Also drop records you created *for* a demo client (e.g. a test invoice), so nothing is left orphaned.
      const demoClients = new Set(d.clients.filter((c) => c.demo).map((c) => c.id));
      const keep = <T extends { demo?: boolean; clientId?: string }>(xs: T[]) => xs.filter((x) => !x.demo && !(x.clientId && demoClients.has(x.clientId)));
      return { ...d, leads: d.leads.filter((l) => !l.demo), clients: keep(d.clients), campaigns: keep(d.campaigns), tasks: keep(d.tasks), invoices: keep(d.invoices), reports: keep(d.reports) };
    });
  }, []);
  const loadDemo = useCallback(() => {
    setData((d) => {
      const demo = demoData();
      return {
        ...d,
        leads: [...demo.leads, ...d.leads.filter((x) => !x.demo)],
        clients: [...demo.clients, ...d.clients.filter((x) => !x.demo)],
        campaigns: [...demo.campaigns, ...d.campaigns.filter((x) => !x.demo)],
        tasks: [...demo.tasks, ...d.tasks.filter((x) => !x.demo)],
        invoices: [...demo.invoices, ...d.invoices.filter((x) => !x.demo)],
        reports: [...demo.reports, ...d.reports.filter((x) => !x.demo)],
      };
    });
  }, []);
  const wipeAll = useCallback(() => setData((d) => ({ ...emptyData(), settings: d.settings })), []);

  const hasDemo = useMemo(() => COLLECTIONS.some((c) => (data[c] as { demo?: boolean }[]).some((x) => x.demo)), [data]);

  const value = useMemo(
    () => ({ data, upsert, remove, update, setSettings, replaceAll, clearDemo, loadDemo, wipeAll, hasDemo, saveError }),
    [data, upsert, remove, update, setSettings, replaceAll, clearDemo, loadDemo, wipeAll, hasDemo, saveError],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const s = useContext(StoreCtx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
