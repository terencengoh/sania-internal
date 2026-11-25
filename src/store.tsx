import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Collection, Data, Settings } from './types';
import { demoData, emptyData } from './seed';
import { COLLECTIONS, normalize } from './normalize';
import type { Backend } from './backend/types';

export { normalize };

type Item<C extends Collection> = Data[C][number];

interface Store {
  data: Data;
  upsert: <C extends Collection>(col: C, item: Item<C>) => void;
  remove: (col: Collection, id: string) => void;
  update: (fn: (d: Data) => Data) => void;
  setSettings: (s: Partial<Settings>) => void;
  /** Replace everything (local mode import) */
  replaceAll: (d: Data) => void;
  /** Add/overwrite records from a backup without deleting anything (live-mode import) */
  importMerge: (d: Data, opts: { skipDemo: boolean }) => void;
  clearDemo: () => void;
  loadDemo: () => void;
  wipeAll: () => void;
  reload: () => Promise<void>;
  hasDemo: boolean;
  saveError: string;
  saving: boolean;
  backendKind: Backend['kind'];
  readOnly: boolean;
}

const StoreCtx = createContext<Store | null>(null);

export function StoreProvider({ backend, readOnly = false, children }: { backend: Backend; readOnly?: boolean; children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const persisted = useRef<Data | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const reload = useCallback(async () => {
    try {
      const d = await backend.load();
      persisted.current = d;
      setData(d);
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [backend]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => backend.subscribe?.((d) => { persisted.current = d; setData(d); }), [backend]);

  // Persist changes (debounced for the network backend)
  useEffect(() => {
    if (!data || !persisted.current || data === persisted.current || readOnly) return;
    const flush = () => {
      const prev = persisted.current!;
      const next = data;
      persisted.current = next;
      setSaving(true);
      backend.persist(prev, next)
        .then(() => setSaveError(''))
        .catch((e) => setSaveError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSaving(false));
    };
    window.clearTimeout(timer.current);
    if (backend.kind === 'local') flush();
    else timer.current = window.setTimeout(flush, 450);
  }, [data, backend, readOnly]);

  const set = useCallback((fn: (d: Data) => Data) => setData((d) => (d ? fn(d) : d)), []);

  const upsert = useCallback(<C extends Collection>(col: C, item: Item<C>) => {
    set((d) => {
      const list = d[col] as Item<C>[];
      const i = list.findIndex((x) => x.id === item.id);
      const next = i >= 0 ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
      return { ...d, [col]: next };
    });
  }, [set]);

  const remove = useCallback((col: Collection, id: string) => {
    set((d) => {
      const next: Data = { ...d, [col]: (d[col] as { id: string }[]).filter((x) => x.id !== id) };
      // cascade: deleting a client removes its campaigns/reports/contacts, unlinks tasks/leads
      if (col === 'clients') {
        const campIds = new Set(next.campaigns.filter((c) => c.clientId === id).map((c) => c.id));
        next.campaigns = next.campaigns.filter((c) => c.clientId !== id);
        next.reports = next.reports.filter((r) => r.clientId !== id);
        next.contacts = next.contacts.filter((r) => r.clientId !== id);
        next.tasks = next.tasks.map((t) => (t.clientId === id ? { ...t, clientId: '', campaignId: campIds.has(t.campaignId) ? '' : t.campaignId } : t));
        next.leads = next.leads.map((l) => (l.clientId === id ? { ...l, clientId: undefined } : l));
      }
      if (col === 'campaigns') next.tasks = next.tasks.map((t) => (t.campaignId === id ? { ...t, campaignId: '' } : t));
      return next;
    });
  }, [set]);

  const update = useCallback((fn: (d: Data) => Data) => set(fn), [set]);
  const setSettings = useCallback((s: Partial<Settings>) => set((d) => ({ ...d, settings: { ...d.settings, ...s } })), [set]);
  const replaceAll = useCallback((d: Data) => set(() => normalize(d)), [set]);
  const importMerge = useCallback((raw: Data, { skipDemo }: { skipDemo: boolean }) => {
    const inc = normalize(raw);
    set((d) => {
      const merge = <T extends { id: string; demo?: boolean }>(cur: T[], add: T[]) => {
        const keep = add.filter((x) => !(skipDemo && x.demo));
        const ids = new Set(keep.map((x) => x.id));
        return [...keep, ...cur.filter((x) => !ids.has(x.id))];
      };
      return {
        ...d,
        leads: merge(d.leads, inc.leads), clients: merge(d.clients, inc.clients), contacts: merge(d.contacts, inc.contacts),
        campaigns: merge(d.campaigns, inc.campaigns), tasks: merge(d.tasks, inc.tasks), invoices: merge(d.invoices, inc.invoices),
        reports: merge(d.reports, inc.reports),
        settings: { ...inc.settings, team: Array.from(new Set([...d.settings.team, ...inc.settings.team])), nextInvoiceNumber: Math.max(d.settings.nextInvoiceNumber, inc.settings.nextInvoiceNumber) },
      };
    });
  }, [set]);
  const clearDemo = useCallback(() => {
    set((d) => {
      // Also drop records created *for* a demo client (e.g. a test invoice), so nothing is left orphaned.
      const demoClients = new Set(d.clients.filter((c) => c.demo).map((c) => c.id));
      const keep = <T extends { demo?: boolean; clientId?: string }>(xs: T[]) => xs.filter((x) => !x.demo && !(x.clientId && demoClients.has(x.clientId)));
      return { ...d, leads: d.leads.filter((l) => !l.demo), clients: keep(d.clients), contacts: keep(d.contacts), campaigns: keep(d.campaigns), tasks: keep(d.tasks), invoices: keep(d.invoices), reports: keep(d.reports) };
    });
  }, [set]);
  const loadDemo = useCallback(() => {
    set((d) => {
      const demo = demoData();
      const mine = <T extends { demo?: boolean }>(xs: T[]) => xs.filter((x) => !x.demo);
      return {
        ...d,
        leads: [...demo.leads, ...mine(d.leads)], clients: [...demo.clients, ...mine(d.clients)], contacts: [...demo.contacts, ...mine(d.contacts)],
        campaigns: [...demo.campaigns, ...mine(d.campaigns)], tasks: [...demo.tasks, ...mine(d.tasks)],
        invoices: [...demo.invoices, ...mine(d.invoices)], reports: [...demo.reports, ...mine(d.reports)],
      };
    });
  }, [set]);
  const wipeAll = useCallback(() => set((d) => ({ ...emptyData(), settings: d.settings })), [set]);

  const hasDemo = useMemo(() => !!data && COLLECTIONS.some((c) => (data[c] as { demo?: boolean }[]).some((x) => x.demo)), [data]);

  const value = useMemo<Store | null>(() => data && ({
    data, upsert, remove, update, setSettings, replaceAll, importMerge, clearDemo, loadDemo, wipeAll, reload, hasDemo, saveError, saving,
    backendKind: backend.kind, readOnly,
  }), [data, upsert, remove, update, setSettings, replaceAll, importMerge, clearDemo, loadDemo, wipeAll, reload, hasDemo, saveError, saving, backend.kind, readOnly]);

  if (loadError) {
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h2>Couldn't load data</h2>
          <p className="warn-text small">{loadError}</p>
          <button className="btn primary" onClick={reload}>Try again</button>
        </div>
      </div>
    );
  }
  if (!value) return <div className="center-screen muted">Loading…</div>;
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const s = useContext(StoreCtx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
