import { getReport } from "@/lib/report";
import { Shell } from "../shell";
import { RangePicker } from "../components/range-picker";
import { Kpi, fmt, pct, x } from "../components/ui";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

const PLATFORM: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", pinterest: "Pinterest", snapchat: "Snapchat",
  microsoft: "Microsoft", x: "X", influencer: "Influencers", manual: "Other",
};
const pname = (p: string) => PLATFORM[p] ?? p.replace(/_/g, " ");

export default async function Marketing({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { shop, today, range, cur, demo } = await getReport(sp, "14d", false);
  const t = cur.total;
  const ccy = shop.currency;
  const M = (n: number) => fmt(ccy, n);
  const be = t.breakEvenRoas;
  const mer = t.adSpend ? t.revenueIncl / t.adSpend : null;
  const short = cur.daily.length < 10;
  const byPlatform = new Map<string, { spend: number; value: number; campaigns: number }>();
  for (const c of cur.campaigns) {
    const r = byPlatform.get(c.platform) ?? { spend: 0, value: 0, campaigns: 0 };
    r.spend += c.spend; r.value += c.purchaseValue; if (c.spend > 0) r.campaigns++;
    byPlatform.set(c.platform, r);
  }

  return (
    <Shell active="marketing" shopName={shop.name} demo={demo}>
      <header className="pagehead">
        <div>
          <h1>Marketing</h1>
          <p className="sub">{range.from} to {range.to} · each platform judged against your break-even ROAS</p>
        </div>
        <RangePicker current={range.key} from={range.from} to={range.to} max={today} />
      </header>

      <section className="kpis">
        <Kpi hero label="Ad spend" value={M(t.adSpend)} sub={`${pct(t.netRevenue ? t.adSpend / t.netRevenue : null, 0)} of net revenue`} />
        <Kpi label="Blended ROAS" value={x(mer)} sub="all revenue ÷ all ad spend" />
        <Kpi label="Break-even ROAS" value={x(be)} sub="needed to cover product and order costs" />
        <Kpi label="POAS" value={x(t.poas)} sub="contribution ÷ ad spend" />
        <Kpi label="CAC" value={cur.customers?.known && cur.customers.cac != null ? M(cur.customers.cac) : "–"}
          sub={cur.customers?.known ? `ad spend ÷ ${cur.customers.newCustomers} new customers` : "needs customer access"} />
      </section>

      {short && <div className="alerts"><span>⚠ Short window: judge campaigns on 10–14 days or more before pausing anything.</span></div>}

      <div className="panel">
        <div className="ph"><h2>By platform</h2></div>
        <div className="tablewrap">
          <table className="data">
            <thead><tr><th>Platform</th><th>Campaigns</th><th>Spend</th><th>Platform-reported sales</th><th>Platform ROAS</th><th>vs break-even</th></tr></thead>
            <tbody>
              {[...byPlatform.entries()].sort((a, b) => b[1].spend - a[1].spend).map(([pl, r]) => {
                const roas = r.spend ? r.value / r.spend : null;
                return (
                  <tr key={pl}>
                    <td><b>{pname(pl)}</b></td><td>{r.campaigns}</td><td>{M(r.spend)}</td><td>{M(r.value)}</td><td>{x(roas)}</td>
                    <td>{be == null || roas == null ? "–" : roas >= be ? <span className="badge ok">Above</span> : <span className="badge bad">Below</span>}</td>
                  </tr>
                );
              })}
              {byPlatform.size === 0 && <tr><td colSpan={6} className="empty">No ad spend in this range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="ph"><h2>Campaigns</h2></div>
        <div className="tablewrap">
          <table className="data">
            <thead><tr><th>Campaign</th><th>Platform</th><th>Spend</th><th>Platform ROAS</th><th>vs break-even ({x(be)})</th></tr></thead>
            <tbody>
              {cur.campaigns.filter((c) => c.spend > 0).map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td><td>{pname(c.platform)}</td><td>{M(c.spend)}</td><td>{x(c.roas)}</td>
                  <td>{be == null || c.roas == null ? "–" : c.roas >= be ? <span className="badge ok">Above break-even</span> : <span className="badge bad">Below break-even</span>}</td>
                </tr>
              ))}
              {cur.campaigns.length === 0 && <tr><td colSpan={5} className="empty">No campaigns in this range.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="note">Platform ROAS uses each platform&apos;s own attribution, and platforms often claim the same sale. Use blended ROAS for overall health, and the break-even line to compare campaigns.</p>
      </div>
    </Shell>
  );
}
