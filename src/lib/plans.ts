// Margewise plans. Billing runs through Shopify (managed pricing); the plan names below must match
// the plan names entered in the Partner Dashboard exactly. The owner store (Flexi Muscles) is unlimited.

import { db, type Shop } from "./db";

export type PlanKey = "free" | "starter" | "growth" | "scale" | "plus" | "owner";

export interface Plan {
  key: PlanKey;
  name: string;
  monthly: number | null; // USD
  annual: number | null; // USD per year (20% off)
  orderLimit: number | null; // orders per calendar month; null = unlimited
  cac: boolean; // customer acquisition cost, new vs returning customers
  customerMetrics: boolean; // repeat rate, LTV, LTV:CAC
  campaignProfit: boolean; // campaign-level table on Marketing
}

export const PLANS: Record<PlanKey, Plan> = {
  free: { key: "free", name: "Free", monthly: 0, annual: null, orderLimit: 100, cac: false, customerMetrics: false, campaignProfit: false },
  starter: { key: "starter", name: "Starter", monthly: 29, annual: 279, orderLimit: 500, cac: true, customerMetrics: false, campaignProfit: false },
  growth: { key: "growth", name: "Growth", monthly: 59, annual: 569, orderLimit: 1500, cac: true, customerMetrics: true, campaignProfit: true },
  scale: { key: "scale", name: "Scale", monthly: 119, annual: 1139, orderLimit: 5000, cac: true, customerMetrics: true, campaignProfit: true },
  plus: { key: "plus", name: "Plus", monthly: null, annual: null, orderLimit: null, cac: true, customerMetrics: true, campaignProfit: true },
  owner: { key: "owner", name: "Owner", monthly: null, annual: null, orderLimit: null, cac: true, customerMetrics: true, campaignProfit: true },
};

export const PUBLIC_PLANS = [PLANS.free, PLANS.starter, PLANS.growth, PLANS.scale];

/** Shopify subscription name → plan ("Growth", "Growth (annual)", "growth" all map to growth). */
export function planFromSubscriptionName(name: string | null | undefined): PlanKey {
  const n = (name ?? "").toLowerCase();
  for (const k of ["scale", "growth", "starter", "plus"] as const) if (n.includes(k)) return k;
  return "free";
}

export function planOf(shop: Shop): Plan {
  if (shop.is_owner) return PLANS.owner;
  return PLANS[(shop.plan as PlanKey) ?? "free"] ?? PLANS.free;
}

/** Where a store manages its Margewise plan (Shopify's hosted plan page, opened in the admin). */
export function planPageUrl(shop: Shop): string | null {
  const handle = shop.myshopify_domain?.replace(/\.myshopify\.com$/, "");
  const app = process.env.SHOPIFY_APP_HANDLE ?? "margewise-1";
  return handle ? `https://admin.shopify.com/store/${handle}/charges/${app}/pricing_plans` : null;
}

/** Orders this calendar month (store's own time zone) against the plan's limit. */
export async function usage(shop: Shop, today: string) {
  const plan = planOf(shop);
  if (shop.id === "demo") return { plan, orders: 0, limit: plan.orderLimit, over: false, near: false, next: null };
  const { count } = await db().from("orders").select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id).gte("local_date", today.slice(0, 8) + "01").lte("local_date", today);
  const orders = count ?? 0;
  const limit = plan.orderLimit;
  return {
    plan, orders, limit,
    over: limit != null && orders > limit,
    near: limit != null && orders > limit * 0.8 && orders <= limit,
    next: plan.key === "free" ? PLANS.starter : plan.key === "starter" ? PLANS.growth : plan.key === "growth" ? PLANS.scale : plan.key === "scale" ? PLANS.plus : null,
  };
}

/** The store's active Shopify subscription, saved on the shop. Uses the store's own credentials. */
export async function refreshPlan(shop: Shop) {
  if (shop.is_owner || !shop.myshopify_domain) return null;
  const { credentialsFor } = await import("./shopify-app");
  const { runForStore } = await import("./shop-context");
  const { gql } = await import("./shopify");
  const data = await runForStore(credentialsFor(shop.myshopify_domain), () =>
    gql<{ currentAppInstallation: { activeSubscriptions: { name: string; status: string; lineItems: { plan: { pricingDetails: { interval?: string } } }[] }[] } }>(
      "{ currentAppInstallation { activeSubscriptions { name status lineItems { plan { pricingDetails { ... on AppRecurringPricing { interval } } } } } } }", {}),
  );
  const active = data.currentAppInstallation.activeSubscriptions.find((s) => s.status === "ACTIVE");
  const plan = planFromSubscriptionName(active?.name);
  const interval = active?.lineItems[0]?.plan.pricingDetails.interval ?? null;
  await db().from("shops").update({ plan, plan_interval: interval, plan_checked_at: new Date().toISOString() }).eq("id", shop.id);
  return plan;
}
