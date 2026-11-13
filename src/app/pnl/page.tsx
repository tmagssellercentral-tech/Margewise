import Link from "next/link";
import { getMonthly } from "@/lib/report";
import { buildPnl } from "@/lib/pnl";
import { Shell } from "../shell";
import { ExportLinks } from "../components/export-links";
import { fmt, pct, x } from "../components/ui";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function Pnl({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { shop, today, cols, demo, choice } = await getMonthly(sp);
  const exportQuery = choice.key === "custom" ? `from=${choice.from}&to=${choice.to}` : `months=${choice.key}`;
  const rows = buildPnl(cols.map((c) => ({ period: c.period, total: c.data.total, platforms: c.data.platforms, fixedCosts: c.data.fixedCosts, config: c.data.config })));
  const ccy = shop.currency;
  const missing = new Set(cols.flatMap((c) => c.data.total.missingCostSkus));
  const cell = (kind: string, key: string, v: number | null | undefined, negative?: boolean) => {
    if (kind === "heading") return "";
    if (v == null || !isFinite(v)) return "–";
    if (kind === "ratio") return pct(v);
    if (key === "orders") return Math.round(v).toLocaleString("en-ZA");
    if (key === "mer") return x(v);
    return fmt(ccy, negative ? -v : v);
  };
  return (
    <Shell active="pnl" shopName={shop.name} demo={demo}>
      <header className="pagehead">
        <div>
          <h1>Profit &amp; loss</h1>
          <p className="sub">{cols[0].period.label} to {cols.at(-1)!.period.label} · {ccy}, ex VAT · costs shown as negatives</p>
        </div>
        <div className="headtools">
          <nav className="seg" aria-label="Months shown">
            {[3, 6, 12].map((m) => <Link key={m} href={`/pnl?months=${m}`} className={String(m) === choice.key ? "on" : ""}>{m} months</Link>)}
          </nav>
          {/* Custom span of whole months; a plain form, so it works without JavaScript. */}
          <form className={`monthrange${choice.key === "custom" ? " on" : ""}`} method="get" action="/pnl">
            <label>From <input type="month" name="from" defaultValue={choice.from} max={today.slice(0, 7)} required /></label>
            <label>To <input type="month" name="to" defaultValue={choice.to} max={today.slice(0, 7)} required /></label>
            <button type="submit">Apply</button>
          </form>
          <ExportLinks kind="pnl" query={exportQuery} />
        </div>
      </header>
      {missing.size > 0 && (
        <div className="alerts"><Link href="/settings?tab=products">⚠ {missing.size} product{missing.size > 1 ? "s have" : " has"} no cost in these months, so profit is overstated</Link></div>
      )}
      <div className="panel">
        <div className="tablewrap">
          <table className="pnl">
            <thead>
              <tr><th></th>{cols.map((c) => <th key={c.period.key}>{c.period.label}</th>)}<th className="totalcol">Total</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={`k-${r.kind}`}>
                  <td>{r.label}</td>
                  {r.kind === "heading" ? <td colSpan={cols.length + 1} /> : r.values.map((v, i) => (
                    <td key={i} className={`${i === cols.length ? "totalcol" : ""} ${(r.kind === "total" || r.kind === "subtotal") && (v ?? 0) < 0 ? "neg" : ""}`}>
                      {cell(r.kind, r.key, v, r.negative)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          Revenue and costs are ex VAT. Contribution is what orders earn before ads; net profit is after ads and the fixed costs you&apos;ve entered.
          It doesn&apos;t include tax on profit, interest, depreciation or stock movements, so it&apos;s a management view, not statutory accounts.
        </p>
      </div>
    </Shell>
  );
}
