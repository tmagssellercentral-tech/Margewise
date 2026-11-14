import Link from "next/link";
import { change, getReport } from "@/lib/report";
import { Shell } from "./shell";
import { ExportLinks } from "./components/export-links";
import { RangePicker } from "./components/range-picker";
import { Breakdown, Kpi, TrendChart, fmt, pct, sym, x } from "./components/ui";
import { CustomersPanel } from "./components/customers-panel";
import { AdMetricsGuide } from "./components/ad-metrics-guide";
import { Locked, PlanNotice, UpgradeLink } from "./components/plan";
import { PLANS, planOf, usage } from "@/lib/plans";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

const PLATFORM: Record<string, string> = {
  shopify: "Shopify", meta: "Meta", google: "Google", tiktok: "TikTok", pinterest: "Pinterest", snapchat: "Snapchat",
  microsoft: "Microsoft", x: "X", influencer: "Influencers", manual: "Other",
};
const pname = (p: string) => PLATFORM[p] ?? p.replace(/_/g, " ");

export default async function Overview({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { shop, today, range, cur, prev, lastSync, demo } = await getReport(sp, "30d");
  const t = cur.total, p = prev?.total;
  const ccy = shop.currency;
  const M = (n: number, dp = 0) => fmt(ccy, n, dp);
  const cs = sym(ccy);

  const hasFixed = t.fixedCosts > 0;
  const profit = hasFixed ? t.netProfit : t.profitAfterAds;
  const prevProfit = p ? (hasFixed ? p.netProfit : p.profitAfterAds) : null;
  const costs = t.netRevenue - profit;
  const prevCosts = p ? p.netRevenue - (prevProfit ?? 0) : null;
  const aov = t.orders ? t.revenueIncl / t.orders : 0;
  const mer = t.adSpend ? t.revenueIncl / t.adSpend : null;
  // What the ad platforms themselves say their ads sold (their attribution).
  const attributed = cur.campaigns.reduce((s, c) => s + c.purchaseValue, 0);
  const blendedRoas = t.adSpend && attributed ? attributed / t.adSpend : null;
  const failed = lastSync.filter((s) => s.status === "error").map((s) => pname(s.kind));
  const top = cur.products.slice(0, 5);
  const plan = planOf(shop);
  const u = await usage(shop, today);
  if (u.over && plan.key === "free") {
    return (
      <Shell active="overview" shopName={shop.name} demo={demo}>
        <header className="pagehead"><div><h1>Overview</h1></div></header>
        <Locked shop={shop} title="Your store has outgrown the Free plan"
          what={`${u.orders} orders this month, more than the Free plan's ${u.limit}. Your data is still syncing and nothing is lost: pick a plan to see this month's profit again. Every paid plan starts with a 14-day free trial.`}
          needs={PLANS.starter} />
      </Shell>
    );
  }

  return (
    <Shell active="overview" shopName={shop.name} demo={demo}>
      <header className="pagehead">
        <div>
          <h1>Overview</h1>
          <p className="sub">{shop.is_owner === false ? "Orders" : "Website orders"} · {range.from} to {range.to} · compared with the previous {cur.daily.length} days</p>
        </div>
        <div className="headtools">
          <RangePicker current={range.key} from={range.from} to={range.to} max={today} />
          <ExportLinks kind="overview" query={range.key === "custom" ? `from=${range.from}&to=${range.to}` : `range=${range.key}`} />
        </div>
      </header>

      {(t.missingCostSkus.length > 0 || cur.unmatchedGateways.length > 0 || failed.length > 0) && (
        <div className="alerts">
          {t.missingCostSkus.length > 0 && <Link href="/settings?tab=products">⚠ {t.missingCostSkus.length} product{t.missingCostSkus.length > 1 ? "s have" : " has"} no cost, so profit is overstated</Link>}
          {cur.unmatchedGateways.length > 0 && <Link href="/settings?tab=fees">⚠ No fee rule for {cur.unmatchedGateways.join(", ")}</Link>}
          {failed.length > 0 && <Link href="/settings?tab=ads">⚠ Last sync failed: {failed.join(", ")}</Link>}
        </div>
      )}

      <PlanNotice shop={shop} u={u} />

      <section className="kpis">
        <Kpi hero label={hasFixed ? "Net profit" : "Profit after ads"} value={M(profit)} delta={change(profit, prevProfit)}
          sub={<>{pct(t.netRevenue ? profit / t.netRevenue : null)} margin{!hasFixed && <> · before fixed costs</>}</>} />
        <Kpi label="Net revenue" value={M(t.netRevenue)} delta={change(t.netRevenue, p?.netRevenue)} sub="ex VAT, after refunds" />
        <Kpi label="Total costs" value={M(costs)} delta={change(costs, prevCosts)} goodWhenUp={false} sub={pct(t.netRevenue ? costs / t.netRevenue : null, 0) + " of revenue"} />
        <Kpi label="Orders" value={t.orders.toLocaleString("en-ZA")} delta={change(t.orders, p?.orders)} sub={`${M(aov)} average order`} />
        <Kpi label="Ad spend" value={M(t.adSpend)} delta={change(t.adSpend, p?.adSpend)} goodWhenUp={false} sub={`${pct(t.netRevenue ? t.adSpend / t.netRevenue : null, 0)} of revenue`} />
      </section>

      {!hasFixed && (
        <div className="callout">
          <div>
            <b>Your net profit is missing fixed costs.</b>
            <span>Salaries, rent, software and other overheads aren&apos;t included yet, so the headline figure is profit after ads, not what you actually keep.</span>
          </div>
          <Link href="/expenses" className="btn">+ Add fixed costs</Link>
        </div>
      )}

      <section className="strip six">
        <div title="All store sales (incl VAT) divided by all ad spend, including organic and repeat sales.">
          <span>MER</span>
          <b>{x(mer)}{mer != null && t.breakEvenRoas != null && (mer >= t.breakEvenRoas
            ? <em className="badge ok">above break-even</em> : <em className="badge bad">below break-even</em>)}</b>
          <small>all store sales ÷ ad spend</small>
        </div>
        <div title="Sales the ad platforms attribute to their own ads, added up across platforms, divided by all ad spend.">
          <span>Blended ROAS</span><b>{x(blendedRoas)}</b>
          <small>{t.adSpend && !attributed ? "no platform-reported sales" : "platform-reported sales ÷ ad spend"}</small>
        </div>
        <div title="The ROAS at which ads exactly pay for themselves after product, payment, courier and packaging costs.">
          <span>Break-even ROAS</span><b>{x(t.breakEvenRoas)}</b><small>MER needed to cover costs</small>
        </div>
        <div title="Profit on ad spend: contribution (after product and order costs) divided by ad spend. Above 1.0 ads make money.">
          <span>POAS</span><b>{x(t.poas)}</b><small>{t.poas != null ? `${cs}${t.poas.toFixed(2)} back per ${cs}1 of ads` : "profit on ad spend"}</small>
        </div>
        <div title="Profit (after ads, and fixed costs once entered) divided by orders."><span>Profit per order</span><b>{M(t.orders ? profit / t.orders : 0)}</b><small>{hasFixed ? "after fixed costs" : "after ads"}</small></div>
        <div title="What orders earn after product, payment, courier, packaging and return costs, before ads."><span>Contribution before ads</span><b>{M(t.contribution)}</b><small>{pct(t.netRevenue ? t.contribution / t.netRevenue : null, 0)} of revenue</small></div>
      </section>
      <AdMetricsGuide />

      <section className="grid-main">
        <div className="panel">
          <div className="ph"><h2>Revenue and profit by day</h2>
            <span className="legend"><i className="lg rev" />Net revenue <i className="lg pos" />{hasFixed ? "Net profit" : "Profit after ads"}</span></div>
          <TrendChart ccy={ccy} days={cur.daily.map((d) => ({ date: d.date, netRevenue: d.netRevenue, profit: hasFixed ? d.netProfit : d.profitAfterAds }))} />
        </div>
        <div className="panel">
          <div className="ph"><h2>Where the money went</h2></div>
          <Breakdown ccy={ccy} total={t.netRevenue} center={{ value: pct(t.netRevenue ? profit / t.netRevenue : null, 0), label: profit >= 0 ? "of revenue kept" : "loss on revenue", negative: profit < 0 }} items={[
            { label: "Product cost", value: t.cogs, tone: "c1" },
            { label: "Ads", value: t.adSpend, tone: "c2" },
            { label: "Courier", value: t.courier, tone: "c3" },
            { label: "Payment fees", value: t.paymentFees, tone: "c4" },
            { label: "Packaging & returns", value: t.packaging + t.returnsCost, tone: "c5" },
            { label: "Fixed costs", value: t.fixedCosts, tone: "c6" },
            { label: hasFixed ? "Net profit" : "Profit after ads", value: Math.max(0, profit), tone: "profit" },
          ]} />
        </div>
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="ph"><h2>Ad spend by platform</h2><Link href="/marketing">Campaigns →</Link></div>
          {cur.platforms.length === 0 ? <div className="empty">No ad spend in this range.</div> : (
            <ul className="bars">
              {cur.platforms.map((pl) => (
                <li key={pl.platform}>
                  <span className="bl">{pname(pl.platform)}</span>
                  <span className="track"><span style={{ width: `${(pl.adCost / cur.platforms[0].adCost) * 100}%` }} /></span>
                  <span className="bv">{M(pl.adCost)}</span>
                </li>
              ))}
            </ul>
          )}
          {mer != null && t.breakEvenRoas != null && (() => {
            const scale = Math.max(mer, t.breakEvenRoas) * 1.25;
            return (
              <>
                <div className="roasline" aria-label={`MER ${x(mer)}, break-even ${x(t.breakEvenRoas)}`}>
                  <span className={`fill ${mer >= t.breakEvenRoas ? "ok" : "bad"}`} style={{ width: `${(mer / scale) * 100}%` }} />
                  <span className="mark" style={{ left: `${(t.breakEvenRoas / scale) * 100}%` }} />
                </div>
                <div className="roaslabels"><span>MER {x(mer)}</span><span>Break-even {x(t.breakEvenRoas)} ▏</span></div>
              </>
            );
          })()}
          <div className="adstats">
            <div><span>Ad spend / revenue</span><b>{pct(t.netRevenue ? t.adSpend / t.netRevenue : null, 0)}</b></div>
            <div><span>Ad cost per order</span><b>{M(t.orders ? t.adSpend / t.orders : 0)}</b></div>
            <div><span>Profit per {sym(ccy)}1 of ads</span><b>{t.adSpend ? (profit / t.adSpend).toFixed(2) : "–"}</b></div>
          </div>
          <p className="note">{mer != null && t.breakEvenRoas != null && (mer >= t.breakEvenRoas ? "Ads are paying for themselves overall." : "Overall, ads cost more than they bring in.")}</p>
        </div>
        <div className="panel">
          <div className="ph"><h2>Top products by profit</h2><Link href="/products">All products →</Link></div>
          <table className="mini">
            <thead><tr><th>Product</th><th>Units</th><th>Profit</th><th>Margin</th></tr></thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.sku}>
                  <td>{r.title ?? r.sku}</td><td>{r.units}</td>
                  <td className={r.contribution < 0 ? "neg" : ""}>{M(r.contribution)}</td>
                  <td>{pct(r.netRevenue ? r.contribution / r.netRevenue : null, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">Product profit is before ads and fixed costs.</p>
        </div>
      </section>

      {plan.cac ? <CustomersPanel c={cur.customers} ccy={ccy} full={plan.customerMetrics} upgrade={<UpgradeLink shop={shop}>Upgrade to Growth</UpgradeLink>} /> : (
        <Locked shop={shop} title="Customers" needs={PLANS.starter}
          what="Customer acquisition cost (CAC) and new versus returning customers are on every paid plan. Repeat purchase rate and lifetime value (LTV) are on Growth and above." />
      )}

      <p className="foot">
        Last sync: {lastSync.map((s) => `${pname(s.kind)} ${s.status === "ok" ? "✓" : "✗"} ${s.finished_at ? new Date(s.finished_at).toLocaleString("en-ZA", { timeZone: shop.timezone, dateStyle: "short", timeStyle: "short" }) : ""}`).join(" · ") || "never"}
      </p>
    </Shell>
  );
}
