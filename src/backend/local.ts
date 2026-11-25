import type { Backend } from './types';
import type { Data } from '../types';
import { demoData } from '../seed';
import { normalize } from '../normalize';

export const LOCAL_KEY = 'sania-internal:data:v1';

/** DEMO mode: everything in this browser's localStorage. */
export const localBackend: Backend = {
  kind: 'local',
  async load() {
    try {
      const s = localStorage.getItem(LOCAL_KEY);
      if (s) return normalize(JSON.parse(s));
    } catch { /* fall through */ }
    const d = demoData();
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch { /* storage full/blocked */ }
    return d;
  },
  async persist(_prev: Data, next: Data) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  },
  subscribe(onData) {
    const on = (e: StorageEvent) => {
      if (e.key === LOCAL_KEY && e.newValue) {
        try { onData(normalize(JSON.parse(e.newValue))); } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  },
};
