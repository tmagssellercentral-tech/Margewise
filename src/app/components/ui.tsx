// Small presentational pieces shared by the report pages: money formatting, KPI cards with
// change vs the previous period, and SVG charts rendered on the server.

export const fmt = (ccy: string, n: number, dp = 0) =>
  `${n < 0 ? "−" : ""}${ccy === "ZAR" ? "R" : ccy + " "}${Math.abs(n).toLocaleString("en-ZA", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const pct = (n: number | null, dp = 1) => (n == null || !isFinite(n) ? "–" : `${(n * 100).toFixed(dp)}%`);
export const x = (n: number | null) => (n == null || !isFinite(n) ? "–" : `${n.toFixed(2)}x`);

/** Change chip. `goodWhenUp` false for costs, where a rise is bad. */
export function Delta({ v, goodWhenUp = true }: { v: number | null; goodWhenUp?: boolean }) {
  if (v == null || !isFinite(v)) return <span className="delta none">no prior data</span>;
  const good = v === 0 ? null : (v > 0) === goodWhenUp;
  return (
    <span className={`delta ${good == null ? "" : good ? "up" : "down"}`}>
      {v > 0 ? "▲" : v < 0 ? "▼" : "●"} {Math.abs(v * 100).toFixed(1)}%
    </span>
  );
}

export function Kpi({ label, value, delta, goodWhenUp, sub, hero }: {
  label: string; value: string; delta?: number | null; goodWhenUp?: boolean; sub?: React.ReactNode; hero?: boolean;
}) {
  return (
    <div className={`kpi${hero ? " hero" : ""}`}>
      <div className="kl">{label}</div>
      <div className="kv">{value}</div>
      <div className="ks">{delta !== undefined && <Delta v={delta} goodWhenUp={goodWhenUp} />}{sub && <span>{sub}</span>}</div>
    </div>
  );
}

const sym = (ccy: string) => (ccy === "ZAR" ? "R" : ccy === "USD" ? "$" : ccy === "EUR" ? "€" : ccy === "GBP" ? "£" : ccy + " ");
/** Short axis labels: R21k, −R300, R1.2m. */
export function axis(ccy: string, v: number) {
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  const n = a >= 1e6 ? `${(a / 1e6).toFixed(1)}m` : a >= 1000 ? `${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : `${Math.round(a)}`;
  return `${s}${sym(ccy)}${n}`;
}

/** Daily net revenue (line) over daily profit (bars, red when negative). */
export function TrendChart({ days, ccy }: { days: { date: string; netRevenue: number; profit: number }[]; ccy: string }) {
  if (days.length === 0) return <div className="empty">No days in this range.</div>;
  const W = 760, H = 240, L = 56, R = 12, T = 14, B = 28;
  const vals = days.flatMap((d) => [d.netRevenue, d.profit]);
  const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
  const y = (v: number) => T + ((max - v) / (max - min)) * (H - T - B);
  const step = (W - L - R) / days.length;
  const cx = (i: number) => L + step * i + step / 2;
  const ticks = [max, (max + min) / 2, min].map((v) => Math.round(v));
  const line = days.map((d, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)},${y(d.netRevenue).toFixed(1)}`).join(" ");
  const labelIdx = days.length <= 8 ? days.map((_, i) => i) : [0, Math.floor(days.length / 2), days.length - 1];
  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily net revenue and profit">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" className="axis">{axis(ccy, t)}</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="zero" />
      {days.map((d, i) => {
        const top = Math.min(y(d.profit), y(0)), h = Math.max(1, Math.abs(y(d.profit) - y(0)));
        return (
          <rect key={d.date} x={cx(i) - step * 0.32} width={step * 0.64} y={top} height={h} rx={2} className={d.profit >= 0 ? "bar pos" : "bar neg"}>
            <title>{`${d.date}\nNet revenue ${fmt(ccy, d.netRevenue)}\nNet profit ${fmt(ccy, d.profit)}`}</title>
          </rect>
        );
      })}
      <path d={line} className="rev" />
      {labelIdx.map((i) => <text key={i} x={cx(i)} y={H - 8} textAnchor="middle" className="axis">{days[i].date.slice(5)}</text>)}
    </svg>
  );
}

/** Horizontal share bars: where each unit of revenue went. */
export function Breakdown({ items, total, ccy }: { items: { label: string; value: number; tone: string }[]; total: number; ccy: string }) {
  const shown = items.filter((i) => Math.abs(i.value) > 0.005);
  return (
    <div className="breakdown">
      <div className="stack" aria-hidden="true">
        {shown.map((i) => <span key={i.label} className={`seg ${i.tone}`} style={{ width: `${Math.max(0, (i.value / total) * 100)}%` }} />)}
      </div>
      <ul>
        {shown.map((i) => (
          <li key={i.label}>
            <span className={`dot ${i.tone}`} />
            <span className="bl">{i.label}</span>
            <span className="bv">{fmt(ccy, i.value)}</span>
            <span className="bp">{pct(total ? i.value / total : null, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
