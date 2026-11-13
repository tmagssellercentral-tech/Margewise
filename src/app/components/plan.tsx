import type { Shop } from "@/lib/db";
import { planPageUrl, type Plan, type usage } from "@/lib/plans";

type Usage = Awaited<ReturnType<typeof usage>>;

/** Link to Shopify's plan page; opens in the admin itself, not inside the app frame. */
export function UpgradeLink({ shop, children = "See plans" }: { shop: Shop; children?: React.ReactNode }) {
  const url = planPageUrl(shop);
  return url ? <a className="btn" href={url} target="_top">{children}</a> : null;
}

/** Usage notice when a store is close to, or over, its plan's monthly orders. */
export function PlanNotice({ shop, u }: { shop: Shop; u: Usage }) {
  if (!u.limit || (!u.over && !u.near)) return null;
  return (
    <div className={`callout ${u.over ? "over" : ""}`}>
      <div>
        <b>{u.over ? `You've passed your plan's ${u.limit.toLocaleString("en-US")} orders this month.` : `You're close to your plan's ${u.limit.toLocaleString("en-US")} orders this month.`}</b>
        <span>{u.orders.toLocaleString("en-US")} orders so far on the {u.plan.name} plan.{u.next ? ` ${u.next.name} covers ${u.next.orderLimit ? `up to ${u.next.orderLimit.toLocaleString("en-US")}` : "more"} orders a month.` : ""}</span>
      </div>
      <UpgradeLink shop={shop}>{u.over ? "Upgrade" : "See plans"}</UpgradeLink>
    </div>
  );
}

/** Shown in place of a feature the store's plan doesn't include. */
export function Locked({ shop, title, what, needs }: { shop: Shop; title: string; what: string; needs: Plan }) {
  return (
    <section className="panel locked">
      <div className="ph"><h2>{title}</h2><span className="badge">{needs.name} plan</span></div>
      <div className="empty left">
        <p>{what}</p>
        <UpgradeLink shop={shop}>Upgrade to {needs.name}</UpgradeLink>
      </div>
    </section>
  );
}
