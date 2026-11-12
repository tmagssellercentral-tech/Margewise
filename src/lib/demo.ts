// Demo data for local previews and screenshots: Flexi Muscles' September 2026 answer key,
// with its Meta spend spread across days in proportion to revenue and an example fixed cost.
// Never used unless MARGEWISE_DEMO=1.

import fixture from "../../test/fixtures/september-2026.json";
import { adCost, byProduct, computeOrder, fixedCostsForDay, totals, type FeeRule, type FixedCost, type OrderInput, type ShopConfig } from "./engine";
import { daysBetween } from "./dates";
import type { Report, RangeData } from "./report";
import type { Shop } from "./db";

const config: ShopConfig = {
  vatRegistered: true, vatRate: 0.15, pricesIncludeVat: true,
  packagingPerOrder: 25, fulfilmentPerOrder: 0, returnHandlingPerOrder: 50,
  courierStandard: 95, courierBulky: 350, courierReturnStandard: 95, courierReturnBulky: 350,
  adSpendIncludesVat: false, taxMode: "rate", country: "ZA",
};
const rules: FeeRule[] = [
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
  { name: "Salaries (example)", category: "salaries", amount: 18000, frequency: "monthly", startDate: "2026-01-01", endDate: null, vatClaimable: false },
  { name: "Software (example)", category: "software", amount: 2500, frequency: "monthly", startDate: "2026-01-01", endDate: null, vatClaimable: true },
];
const shop = { id: "demo", shop_domain: "demo", name: "Demo store (Flexi Muscles, Sept 2026)", currency: "ZAR", timezone: "Africa/Johannesburg", vat_registered: true, vat_rate: 0.15, prices_include_vat: true, country: "ZA", tax_mode: "rate" } as Shop;

const all = (fixture.orders as OrderInput[]).map((o) => computeOrder(o, config, rules, new Set(fixture.bulky)));
const revenueByDay = new Map<string, number>();
for (const r of all) revenueByDay.set(r.localDate, (revenueByDay.get(r.localDate) ?? 0) + r.netRevenue);
const totalRevenue = [...revenueByDay.values()].reduce((a, b) => a + b, 0);
const spendFor = (d: string) => (fixture.metaSpend * (revenueByDay.get(d) ?? 0)) / totalRevenue;

function range(from: string, to: string): RangeData {
  const results = all.filter((r) => r.localDate >= from && r.localDate <= to);
  const days = daysBetween(from, to);
  const spend = days.reduce((s, d) => s + spendFor(d), 0);
  const fx = days.reduce((s, d) => s + fixedCostsForDay(fixed, d, config), 0);
  return {
    config, results,
    daily: days.map((d) => ({ date: d, ...totals(results.filter((r) => r.localDate === d), spendFor(d), config, fixedCostsForDay(fixed, d, config)) })),
    total: totals(results, spend, config, fx),
    fixedCosts: fixed,
    products: byProduct(results),
    platforms: spend > 0 ? [{ platform: "meta", adCost: adCost(spend, config) }] : [],
    campaigns: [],
    unmatchedGateways: [],
  } as unknown as RangeData;
}

export function demoReport(sp: Record<string, string | undefined>, withPrev: boolean): Report {
  const today = "2026-10-01";
  let from = sp.from ?? "2026-09-16", to = sp.to ?? "2026-09-30", key = sp.from ? "custom" : "14d";
  if (sp.range === "lastmonth" || sp.range === "30d") { from = "2026-09-01"; to = "2026-09-30"; key = sp.range; }
  if (sp.range === "7d") { from = "2026-09-24"; to = "2026-09-30"; key = "7d"; }
  const n = daysBetween(from, to).length;
  const pFrom = new Date(Date.parse(from) - n * 864e5).toISOString().slice(0, 10);
  const pTo = new Date(Date.parse(from) - 864e5).toISOString().slice(0, 10);
  return {
    shop, today, range: { from, to, key },
    cur: range(from, to),
    prev: withPrev ? range(pFrom, pTo) : null,
    lastSync: [{ kind: "shopify", status: "ok", finished_at: "2026-10-01T03:00:00Z" }, { kind: "meta", status: "ok", finished_at: "2026-10-01T03:00:01Z" }],
    demo: true,
  };
}
