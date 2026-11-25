import type { Data } from '../types';

export interface Backend {
  kind: 'local' | 'supabase';
  load(): Promise<Data>;
  /** Persist the change from prev -> next. Rejects with a readable error. */
  persist(prev: Data, next: Data): Promise<void>;
  /** Optional: subscribe to outside changes (other tabs). Returns unsubscribe. */
  subscribe?(onData: (d: Data) => void): () => void;
}
