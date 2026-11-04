import { getShop } from "@/lib/db";
import { computeRange } from "@/lib/sync";
import { addDays, isYmd, localDate } from "@/lib/dates";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

const PRESETS = [
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "14d", label: "Last 14 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "mtd", label: "This month" },
  { key: "lastmonth", label: "Last month" },
];

function resolveRange(preset: string, today: string, from?: string, to?: string) {
  if (isYmd(from ?? null) && isYmd(to ?? null) && from! <= to!) return { from: from!, to: to!, key: "custom" };
  const y = addDays(today, -1);
  switch (preset) {
    case "yesterday": return { from: y, to: y, key: preset };
    case "7d": return { from: addDays(today, -7), to: y, key: preset };
    case "30d": return { from: addDays(today, -30), to: y, key: preset };
    case "mtd": return { from: today.slice(0, 8) + "01", to: today, key: preset };
    case "lastmonth": {
      const first = today.slice(0, 8) + "01";
      const end = addDays(first, -1);
      return { from: end.slice(0, 8) + "01", to: end, key: preset };
    }
    default: return { from: addDays(today, -14), to: y, key: "14d" };
  }
}

const R = (n: number, dp = 0) =>
  (n < 0 ? "−R " : "R ") + Math.abs(n).toLocaleString("en-ZA", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const X = (n: number | null) => (n == null ? "–" : `${n.toFixed(2)}x`);
const P = (n: number) => `${(n * 100).toFixed(1)}%`;
const sign = (n: number) => (n < 0 ? "neg" : "pos");
const PLATFORM: Record<string, string> = { shopify: "Shopify", meta: "Meta", google: "Google", tiktok: "TikTok", pinterest: "Pinterest", snapchat: "Snapchat", microsoft: "Microsoft", manual: "Other" };
const pname = (p: string) => PLATFORM[p] ?? p;

function ProfitChart({ days }: { days: { date: string; profitAfterAds: number }[] }) {
  if (days.length < 2) return null;
  const W = 1000, H = 180, pad = 20;
  const max = Math.max(1, ...days.map((d) => Math.abs(d.profitAfterAds)));
  const zero = H / 2;
  const bw = (W - pad * 2) / days.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Daily profit after ads">
      <line x1={0} x2={W} y1={zero} y2={zero} stroke="var(--line)" />
      {days.map((d, i) => {
        const h = (Math.abs(d.profitAfterAds) / max) * (H / 2 - pad);
        const y = d.profitAfterAds >= 0 ? zero - h : zero;
        return (
          <rect key={d.date} x={pad + i * bw + bw * 0.15} y={y} width={bw * 0.7} height={Math.max(h, 1)}
            fill={d.profitAfterAds >= 0 ? "var(--pos)" : "var(--neg)"} rx={2}>
            <title>{`${d.date}: ${R(d.profitAfterAds)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const shop = await getShop();
  const today = localDate(new Date(), shop.timezone);
  const range = resolveRange(sp.range ?? "14d", today, sp.from, sp.to);
  const r = await computeRange(shop, range.from, range.to);
  const t = r.total;
  const last = await db().from("sync_runs").select("kind, finished_at, status").eq("shop_id", shop.id)
    .order("started_at", { ascending: false }).limit(20);
  // Latest run per source; a failed ad-platform pull means its recent spend is missing.
  const latest = new Map<string, { kind: string; status: string; finished_at: string | null }>();
  for (const s of last.data ?? []) if (!latest.has(s.kind)) latest.set(s.kind, s);
  const failed = [...latest.values()].filter((s) => s.status === "error").map((s) => s.kind);

  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 864e5) + 1;
  const best = r.products.slice(0, 8);
  const worst = r.products.slice(-5).reverse().filter((p) => !best.includes(p));
  const be = t.breakEvenRoas;

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <div className="logo">Marge<span>wise</span></div>
          <div className="shop">{shop.name} · website orders · {range.from} to {range.to}</div>
        </div>
        <div className="pickers">
          <nav className="ranges">
            {PRESETS.map((p) => (
              <a key={p.key} href={`/?range=${p.key}`} className={range.key === p.key ? "on" : ""}>{p.label}</a>
            ))}
          </nav>
          {/* Plain GET form: works without JavaScript and keeps the range in the URL, so it can be bookmarked. */}
          <form className={`custom${range.key === "custom" ? " on" : ""}`} method="get" action="/">
            <span>Custom</span>
            <label>From <input type="date" name="from" defaultValue={range.from} max={today} required /></label>
            <label>To <input type="date" name="to" defaultValue={range.to} max={today} required /></label>
            <button type="submit">Apply</button>
          </form>
        </div>
      </header>

      <p className="verdict">
        You kept <span className={sign(t.profitAfterAds)}>{R(t.profitAfterAds)}</span> after ads
        {t.orders > 0 ? ` from ${t.orders} orders` : ""}.
      </p>

      {t.missingCostSkus.length > 0 && (
        <div className="alert">Missing product cost for {t.missingCostSkus.join(", ")}. Profit is overstated until these are set in Shopify.</div>
      )}
      {failed.length > 0 && (
        <div className="alert">Last sync failed for {failed.map(pname).join(", ")}. Data from that source after its last good sync is missing, so profit may be overstated.</div>
      )}
      {r.unmatchedGateways.length > 0 && (
        <div className="alert">No fee rule for payment method: {r.unmatchedGateways.join(", ")}. Their fees are counted as zero.</div>
      )}

      <section className="tiles">
        <div className="tile hero"><div className="k">Profit after ads</div><div className={`v ${sign(t.profitAfterAds)}`}>{R(t.profitAfterAds)}</div><div className="s">before fixed costs</div></div>
        <div className="tile"><div className="k">Contribution before ads</div><div className="v">{R(t.contribution)}</div><div className="s">{t.netRevenue ? P(t.contribution / t.netRevenue) : "–"} of net revenue</div></div>
        <div className="tile"><div className="k">Net revenue</div><div className="v">{R(t.netRevenue)}</div><div className="s">ex VAT, after refunds</div></div>
        <div className="tile"><div className="k">Ad spend</div><div className="v">{R(t.adSpend)}</div><div className="s">{r.platforms.length ? r.platforms.map((p) => `${pname(p.platform)} ${R(p.adCost)}`).join(" · ") : "ex VAT"}</div></div>
        <div className="tile"><div className="k">POAS</div><div className="v">{X(t.poas)}</div><div className="s">contribution ÷ ad spend</div></div>
        <div className="tile"><div className="k">Break-even ROAS</div><div className="v">{X(be)}</div><div className="s">platform ROAS needed to cover costs</div></div>
      </section>

      {r.daily.length > 1 && (
        <>
          <h2>Profit after ads, by day</h2>
          <div className="card"><ProfitChart days={r.daily} /></div>
        </>
      )}

      <h2>Where the money went</h2>
      <div className="card">
        <table>
          <tbody>
            <tr><td>Revenue incl VAT</td><td>{R(t.revenueIncl)}</td><td></td></tr>
            <tr><td>Net revenue (ex VAT, after refunds)</td><td>{R(t.netRevenue)}</td><td>100%</td></tr>
            {([
              ["Product cost", t.cogs],
              ["Payment fees", t.paymentFees],
              ["Courier", t.courier],
              ["Returns", t.returnsCost],
              ["Packaging & fulfilment", t.packaging],
              ...r.platforms.map((p) => [`${pname(p.platform)} ads`, p.adCost] as const),
            ] as const).map(([k, v]) => (
              <tr key={k}><td>{k}</td><td className="neg">{R(-v)}</td><td>{t.netRevenue ? P(v / t.netRevenue) : "–"}</td></tr>
            ))}
            <tr className="total"><td>Profit after ads</td><td className={sign(t.profitAfterAds)}>{R(t.profitAfterAds)}</td><td>{t.netRevenue ? P(t.profitAfterAds / t.netRevenue) : "–"}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="grid2">
        <div>
          <h2>Best products</h2>
          <div className="card">
            <table>
              <thead><tr><th>Product</th><th>Units</th><th>Contribution</th></tr></thead>
              <tbody>
                {best.map((p) => (
                  <tr key={p.sku}><td>{p.title ?? p.sku}</td><td>{p.units}</td><td className={sign(p.contribution)}>{R(p.contribution)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2>Weakest products</h2>
          <div className="card">
            <table>
              <thead><tr><th>Product</th><th>Units</th><th>Contribution</th></tr></thead>
              <tbody>
                {worst.map((p) => (
                  <tr key={p.sku}><td>{p.title ?? p.sku}</td><td>{p.units}</td><td className={sign(p.contribution)}>{R(p.contribution)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2>Campaigns vs break-even ({X(be)})</h2>
      {days < 10 && <div className="alert">Short window: judge campaigns on 10–14 days before acting.</div>}
      <div className="card">
        <table>
          <thead><tr><th>Campaign</th><th>Platform</th><th>Spend</th><th>Platform ROAS</th><th>Status</th></tr></thead>
          <tbody>
            {r.campaigns.filter((c) => c.spend > 0).map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{pname(c.platform)}</td>
                <td>{R(c.spend)}</td>
                <td>{X(c.roas)}</td>
                <td>{be == null || c.roas == null ? "–" : c.roas >= be
                  ? <span className="badge ok">Above break-even</span>
                  : <span className="badge bad">Below break-even</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="foot">
        Last sync: {[...latest.values()].map((s) => `${pname(s.kind)} ${s.status} ${s.finished_at ? new Date(s.finished_at).toLocaleString("en-ZA", { timeZone: shop.timezone }) : "running"}`).join(" · ") || "never"}.
        Platform ROAS uses each platform&apos;s own attribution (platforms can both claim the same sale); profit uses Shopify orders.
      </p>
    </main>
  );
}
