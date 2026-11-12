import Link from "next/link";
import { getReport } from "@/lib/report";
import { Shell } from "../shell";
import { RangePicker } from "../components/range-picker";
import { fmt, pct } from "../components/ui";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

const COLS = [
  { key: "title", label: "Product" },
  { key: "units", label: "Units" },
  { key: "netRevenue", label: "Net revenue" },
  { key: "cogs", label: "Product cost" },
  { key: "contribution", label: "Profit" },
  { key: "margin", label: "Margin" },
  { key: "perUnit", label: "Profit per unit" },
] as const;

export default async function Products({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { shop, today, range, cur, demo } = await getReport(sp, "30d", false);
  const ccy = shop.currency;
  const M = (n: number) => fmt(ccy, n);
  const missing = new Set(cur.total.missingCostSkus);
  const q = (sp.q ?? "").toLowerCase();
  const sort = COLS.some((c) => c.key === sp.sort) ? sp.sort! : "contribution";
  const dir = sp.dir === "asc" ? 1 : -1;
  const rows = cur.products
    .map((r) => ({ ...r, margin: r.netRevenue ? r.contribution / r.netRevenue : 0, perUnit: r.units ? r.contribution / r.units : 0 }))
    .filter((r) => !q || r.sku.toLowerCase().includes(q) || (r.title ?? "").toLowerCase().includes(q))
    .sort((a, b) => {
      const k = sort as keyof typeof a;
      const av = a[k] ?? "", bv = b[k] ?? "";
      return (typeof av === "string" ? String(av).localeCompare(String(bv)) : Number(av) - Number(bv)) * dir;
    });
  const losing = rows.filter((r) => r.contribution < 0).length;
  const keep = (extra: Record<string, string>) => {
    const u = new URLSearchParams();
    if (range.key === "custom") { u.set("from", range.from); u.set("to", range.to); } else u.set("range", range.key);
    if (sp.q) u.set("q", sp.q);
    for (const [k, v] of Object.entries(extra)) u.set(k, v);
    return `/products?${u}`;
  };

  return (
    <Shell active="products" shopName={shop.name} demo={demo}>
      <header className="pagehead">
        <div>
          <h1>Products</h1>
          <p className="sub">{rows.length} products sold · {range.from} to {range.to}{losing ? ` · ${losing} losing money` : ""}</p>
        </div>
        <RangePicker current={range.key} from={range.from} to={range.to} max={today} />
      </header>
      <div className="panel">
        <form className="search" method="get">
          {range.key === "custom" ? <><input type="hidden" name="from" value={range.from} /><input type="hidden" name="to" value={range.to} /></> : <input type="hidden" name="range" value={range.key} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search product or SKU" aria-label="Search products" />
          <button type="submit">Search</button>
        </form>
        <div className="tablewrap">
          <table className="data">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key}>
                    <Link href={keep({ sort: c.key, dir: sort === c.key && dir === -1 ? "asc" : "desc" })}>
                      {c.label}{sort === c.key ? (dir === -1 ? " ▼" : " ▲") : ""}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sku}>
                  <td><b>{r.title ?? r.sku}</b>{(r.title && r.title !== r.sku || missing.has(r.sku)) && <div className="skuline">{r.title && r.title !== r.sku ? r.sku : ""}{missing.has(r.sku) && <span className="badge bad">no cost</span>}</div>}</td>
                  <td>{r.units}</td>
                  <td>{M(r.netRevenue)}</td>
                  <td>{M(r.cogs)}</td>
                  <td className={r.contribution < 0 ? "neg" : "pos"}>{M(r.contribution)}</td>
                  <td><span className="marginbar"><span style={{ width: `${Math.max(0, Math.min(100, r.margin * 100))}%` }} /></span>{pct(r.margin, 0)}</td>
                  <td>{M(r.perUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Profit here is each product&apos;s share of revenue after product cost, payment fees, courier, packaging and returns. It&apos;s before ads and fixed costs, which aren&apos;t tied to a product.</p>
      </div>
    </Shell>
  );
}
