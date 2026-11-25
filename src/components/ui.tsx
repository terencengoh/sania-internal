import { useEffect, type InputHTMLAttributes, type ReactNode } from 'react';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

type FieldProps = { label: string; children: ReactNode; full?: boolean; hint?: string };
export const Field = ({ label, children, full, hint }: FieldProps) => (
  <label className={`field ${full ? 'full' : ''}`}>
    <span>{label}</span>
    {children}
    {hint && <small className="muted">{hint}</small>}
  </label>
);

export function Text({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} />;
}
export function NumberInput({ value, onChange, ...rest }: { value: number; onChange: (v: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input type="number" inputMode="decimal" {...rest} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />;
}
export function Select<T extends string>({ value, onChange, options, placeholder }: { value: T; onChange: (v: T) => void; options: readonly (T | { value: T; label: string })[]; placeholder?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}
export function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function MultiCheck({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button type="button" key={o} className={`chip ${on ? 'on' : ''}`} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

const tone: Record<string, string> = {
  New: 'blue', Contacted: 'teal', 'Call booked': 'copper', 'Proposal sent': 'amber', Won: 'green', Lost: 'grey',
  Planning: 'blue', Active: 'green', Paused: 'amber', Completed: 'grey', Ended: 'grey',
  'To do': 'blue', 'In progress': 'copper', Review: 'amber', Done: 'green',
  Draft: 'grey', Sent: 'blue', Paid: 'green', Overdue: 'red', Void: 'grey',
  High: 'red', Medium: 'amber', Low: 'grey', Demo: 'demo',
};
export const Badge = ({ children }: { children: string }) => <span className={`badge b-${tone[children] ?? 'grey'}`}>{children}</span>;
export const DemoTag = ({ show }: { show?: boolean }) => (show ? <span className="badge b-demo" title="Fictional demo record">DEMO</span> : null);

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}

export const Stat = ({ label, value, sub, onClick, tone: t }: { label: string; value: ReactNode; sub?: ReactNode; onClick?: () => void; tone?: 'warn' | 'good' }) => (
  <div className={`stat ${onClick ? 'clickable' : ''} ${t ?? ''}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
    onKeyDown={(e) => onClick && (e.key === 'Enter' || e.key === ' ') && onClick()}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

export const confirmDo = (msg: string, fn: () => void) => { if (window.confirm(msg)) fn(); };
