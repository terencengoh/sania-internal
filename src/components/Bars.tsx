import { money, monthLabel } from '../utils';

export function MonthBars({ series }: { series: { month: string; invoiced: number; paid: number }[] }) {
  const max = Math.max(1, ...series.flatMap((s) => [s.invoiced, s.paid]));
  return (
    <div className="bars">
      {series.map((s) => (
        <div className="bar-col" key={s.month} title={`${monthLabel(s.month)}: invoiced ${money(s.invoiced)}, paid ${money(s.paid)}`}>
          <div className="bar-pair">
            <div className="bar invoiced" style={{ height: `${(s.invoiced / max) * 100}%` }} />
            <div className="bar paid" style={{ height: `${(s.paid / max) * 100}%` }} />
          </div>
          <div className="bar-label">{monthLabel(s.month).split(' ')[0].slice(0, 3)}</div>
        </div>
      ))}
    </div>
  );
}

export function HBars({ rows }: { rows: { label: string; value: number; display?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar-row" key={r.label}>
          <span className="hbar-label">{r.label}</span>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <span className="hbar-val">{r.display ?? r.value}</span>
        </div>
      ))}
    </div>
  );
}
