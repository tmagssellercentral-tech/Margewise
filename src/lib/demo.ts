// Demo data for local previews and screenshots: Flexi Muscles' September 2026 answer key,
// with its Meta spend spread across days in proportion to revenue and an example fixed cost.
// Never used unless MARGEWISE_DEMO=1.

import fixture from "../../test/fixtures/september-2026.json";
import { adCost, byProduct, computeOrder, fixedCostsForDay, totals, type FeeRule, type FixedCost, type OrderInput, type ShopConfig } from "./engine";
import { daysBetween } from "./dates";
import type { Report, RangeData } from "./report";
import { computeCustomerMetrics } from "./customers";
import type { Shop } from "./db";

// MARGEWISE_LISTING=1 turns the demo into a fictional UK store for App Store screenshots:
// amounts scaled to pounds, generic payment gateways, no real store named anywhere.
export const LISTING = process.env.MARGEWISE_LISTING === "1";
const F = LISTING ? 1 / 23 : 1;
const m = (n: number) => Math.round(n * F * 100) / 100;

const config: ShopConfig = {
  vatRegistered: true, vatRate: LISTING ? 0.2 : 0.15, pricesIncludeVat: true,
  packagingPerOrder: m(25), fulfilmentPerOrder: 0, returnHandlingPerOrder: m(50),
  courierStandard: m(95), courierBulky: m(350), courierReturnStandard: m(95), courierReturnBulky: m(350),
  adSpendIncludesVat: false, taxMode: "rate", country: LISTING ? "GB" : "ZA",
};
const rules: FeeRule[] = LISTING ? [
  { gatewayMatch: "Shopify Payments", pct: 0.019, fixedFee: 0.25, minFee: 0 },
  { gatewayMatch: "PayPal", pct: 0.029, fixedFee: 0.3, minFee: 0 },
  { gatewayMatch: "Klarna", pct: 0.0499, fixedFee: 0.2, minFee: 0 },
] : [
  { gatewayMatch: "Stitch Express", pct: 0.0295, fixedFee: 0, minFee: 0 },
  { gatewayMatch: "PayFast", pct: 0.032, fixedFee: 2, minFee: 0 },
  { gatewayMatch: "Peach Payments", pct: 0.0295, fixedFee: 1.5, minFee: 0 },
  { gatewayMatch: "Ozow", pct: 0.025, fixedFee: 0, minFee: 0 },
  { gatewayMatch: "Float", pct: 0.051, fixedFee: 4, minFee: 0 },
  { gatewayMatch: "Payflex", pct: 0.0545, fixedFee: 5, minFee: 0 },
  { gatewayMatch: "Bank Deposit", pct: 0, fixedFee: 0, minFee: 0 },
  { gatewayMatch: "manual", pct: 0, fixedFee: 0, minFee: 0 },
];
const fixed: FixedCost[] = [
  { name: "Salaries (example)", category: "salaries", amount: LISTING ? 420 : 18000, frequency: "monthly", startDate: "2026-01-01", endDate: null, vatClaimable: false },
  { name: "Software (example)", category: "software", amount: LISTING ? 95 : 2500, frequency: "monthly", startDate: "2026-01-01", endDate: null, vatClaimable: true },
];
export const demoShop = (LISTING
  ? { id: "demo", shop_domain: "demo", name: "Northwind Fitness", currency: "GBP", timezone: "Europe/London", vat_registered: true, vat_rate: 0.2, prices_include_vat: true, country: "GB", tax_mode: "rate", is_owner: true, plan: "owner" }
  : { id: "demo", shop_domain: "demo", name: "Demo store (Flexi Muscles, Sept 2026)", currency: "ZAR", timezone: "Africa/Johannesburg", vat_registered: true, vat_rate: 0.15, prices_include_vat: true, country: "ZA", tax_mode: "rate", is_owner: true, plan: "owner" }) as Shop;

const LISTING_GATEWAYS = ["Shopify Payments", "Shopify Payments", "PayPal", "Shopify Payments", "Klarna"];
const orders = (fixture.orders as OrderInput[]).map((o, i) => LISTING ? {
  ...o,
  gateway: LISTING_GATEWAYS[i % LISTING_GATEWAYS.length],
  shippingIncl: m(o.shippingIncl), refundIncl: m(o.refundIncl),
  lines: o.lines.map((l) => ({ ...l, lineTotalIncl: m(l.lineTotalIncl), unitCost: l.unitCost == null ? l.unitCost : m(l.unitCost) })),
} : o);
// Readable product names for screenshots ("MultiLevelBench" -> "Multi Level Bench").
const pretty = (sku: string) => sku
  .replace(/^F(?=Trampoline)/, "").replace(/Pi$/, "Pink").replace(/Gr$/, "Green").replace(/Bla(?=\()/, "Black ").replace(/0?1$/, "")
  .replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/([0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
const shift = (d: string, days: number) => new Date(Date.parse(d) + days * 864e5).toISOString().slice(0, 10);
// Listing mode also repeats September as June to August (with some orders dropped) so monthly views aren't empty.
const listingOrders = !LISTING ? orders : [
  ...orders,
  ...[[-30, 5], [-61, 4], [-91, 3]].flatMap(([days, every]) =>
    orders.filter((_, i) => i % every !== 0).map((o) => ({ ...o, name: `${o.name}-${days}`, localDate: shift(o.localDate, days) }))),
].map((o) => ({ ...o, lines: o.lines.map((l) => ({ ...l, title: l.sku ? pretty(l.sku) : l.title })) }));
const all = listingOrders.map((o) => computeOrder(o as OrderInput, config, rules, new Set(fixture.bulky)));
const revenueByDay = new Map<string, number>();
for (const r of all) revenueByDay.set(r.localDate, (revenueByDay.get(r.localDate) ?? 0) + r.netRevenue);
const totalRevenue = [...revenueByDay.values()].reduce((a, b) => a + b, 0);
const spendFor = (d: string) => ((LISTING ? 2.4 : 1) * m(fixture.metaSpend) * (revenueByDay.get(d) ?? 0)) / totalRevenue;

const LISTING_CAMPAIGNS: [string, string, number, number][] = [
  ["meta", "Prospecting | Home gym bundles", 0.31, 3.6],
  ["meta", "Retargeting | Viewed product 7d", 0.17, 7.8],
  ["meta", "Advantage+ | Best sellers", 0.2, 4.4],
  ["google", "Performance Max | All products", 0.16, 4.9],
  ["google", "Search | Brand", 0.08, 11.2],
  ["tiktok", "Spark ads | Trampoline UGC", 0.08, 2.1],
];

export function demoRange(from: string, to: string): RangeData {
  const results = all.filter((r) => r.localDate >= from && r.localDate <= to);
  const days = daysBetween(from, to);
  const spend = days.reduce((s, d) => s + spendFor(d), 0);
  const fx = days.reduce((s, d) => s + fixedCostsForDay(fixed, d, config), 0);
  // Demo customers: every third order is a repeat buyer, so the panel has something to show.
  const tot = totals(results, spend, config, fx);
  const orders = results.map((r, i) => ({ shopifyId: i + 1, customerId: i % 3 === 2 ? 1000 + (i % 7) : 5000 + i, netRevenue: r.netRevenue }));
  const firstOrder = new Map<number, number>();
  for (const o of orders) if (o.customerId != null && !firstOrder.has(o.customerId)) firstOrder.set(o.customerId, o.customerId < 5000 ? -1 : o.shopifyId);
  const customers = computeCustomerMetrics({
    orders, firstOrder, adSpend: tot.adSpend, revenueDivisor: 1.15, contributionMargin: tot.netRevenue ? tot.contribution / tot.netRevenue : null,
    summary: { customers: 4200, repeatCustomers: 1050, orders: 5600, netIncl: 4200 * m(2900), firstOrderAt: "2021-06-01T08:00:00Z" },
  });
  return {
    customers,
    config, results,
    daily: days.map((d) => ({ date: d, ...totals(results.filter((r) => r.localDate === d), spendFor(d), config, fixedCostsForDay(fixed, d, config)) })),
    total: totals(results, spend, config, fx),
    fixedCosts: fixed,
    products: byProduct(results),
    platforms: spend <= 0 ? [] : LISTING
      ? [{ platform: "meta", adCost: adCost(spend * 0.68, config) }, { platform: "google", adCost: adCost(spend * 0.24, config) }, { platform: "tiktok", adCost: adCost(spend * 0.08, config) }]
      : [{ platform: "meta", adCost: adCost(spend, config) }],
    // Example of what Meta itself reports (its attribution), so the platform figures have something to show.
    campaigns: spend <= 0 ? [] : LISTING ? LISTING_CAMPAIGNS.map(([platform, name, share, roas], i) => {
      const sp = adCost(spend * (share as number), config);
      return { id: `c${i}`, platform, name, spend: sp, purchaseValue: sp * (roas as number), roas };
    }) : [{ id: "demo", platform: "meta", name: "Meta (all campaigns, example)", spend: adCost(spend, config), purchaseValue: adCost(spend, config) * 4.1, roas: 4.1 }],
    unmatchedGateways: [],
  } as unknown as RangeData;
}

export function demoReport(sp: Record<string, string | undefined>, withPrev: boolean): Report {
  // ?nofixed=1 previews the Overview of a store that hasn't entered fixed costs yet.
  if (sp.nofixed) fixed.length = 0;
  const today = "2026-10-01";
  let from = sp.from ?? "2026-09-16", to = sp.to ?? "2026-09-30", key = sp.from ? "custom" : "14d";
  if (sp.range === "lastmonth" || sp.range === "30d") { from = "2026-09-01"; to = "2026-09-30"; key = sp.range; }
  if (sp.range === "7d") { from = "2026-09-24"; to = "2026-09-30"; key = "7d"; }
  const n = daysBetween(from, to).length;
  const pFrom = new Date(Date.parse(from) - n * 864e5).toISOString().slice(0, 10);
  const pTo = new Date(Date.parse(from) - 864e5).toISOString().slice(0, 10);
  return {
    // ?plan=starter previews what a store on that plan sees.
    shop: sp.plan ? ({ ...demoShop, is_owner: false, plan: sp.plan } as Shop) : demoShop, today, range: { from, to, key },
    cur: demoRange(from, to),
    prev: withPrev ? demoRange(pFrom, pTo) : null,
    lastSync: [{ kind: "shopify", status: "ok", finished_at: "2026-10-01T03:00:00Z" }, { kind: "meta", status: "ok", finished_at: "2026-10-01T03:00:01Z" }],
    demo: !LISTING,
  };
}
