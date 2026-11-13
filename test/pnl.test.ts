import { describe, expect, it } from "vitest";
import fixture from "./fixtures/september-2026.json";
import { computeOrder, totals, type FeeRule, type OrderInput, type ShopConfig } from "../src/lib/engine";
import { buildPnl, monthPeriods } from "../src/lib/pnl";

const config: ShopConfig = {
  vatRegistered: true, vatRate: 0.15, pricesIncludeVat: true, packagingPerOrder: 25, fulfilmentPerOrder: 0,
  returnHandlingPerOrder: 50, courierStandard: 95, courierBulky: 350, courierReturnStandard: 95, courierReturnBulky: 350,
  adSpendIncludesVat: false,
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

describe("monthly P&L", () => {
  it("lists months oldest first, with the current month to date", () => {
    expect(monthPeriods("2026-11-12", 3).map((p) => [p.label, p.from, p.to])).toEqual([
      ["Sep 2026", "2026-09-01", "2026-09-30"],
      ["Oct 2026", "2026-10-01", "2026-10-31"],
      ["Nov 2026 (to date)", "2026-11-01", "2026-11-12"],
    ]);
    expect(monthPeriods("2027-01-31", 2).map((p) => p.label)).toEqual(["Dec 2026", "Jan 2027"]);
  });

  it("reproduces the September answer key and adds up across columns", () => {
    const results = (fixture.orders as OrderInput[]).map((o) => computeOrder(o, config, rules, new Set(fixture.bulky)));
    const sep = totals(results, fixture.metaSpend, config, 3100);
    const [period] = monthPeriods("2026-09-30", 1);
    const rent = { name: "Rent", category: "rent", amount: 3100, frequency: "monthly" as const, startDate: "2026-01-01", endDate: null, vatClaimable: false };
    const rows = buildPnl([
      { period, total: sep, platforms: [{ platform: "meta", adCost: sep.adSpend }], fixedCosts: [rent], config },
      { period, total: sep, platforms: [{ platform: "meta", adCost: sep.adSpend }], fixedCosts: [rent], config },
    ]);
    const row = (k: string) => rows.find((r) => r.key === k)!.values;
    expect(row("contribution")[0]).toBeCloseTo(100923.88, 1);
    expect(row("after-ads")[0]).toBeCloseTo(32547.21, 1);
    expect(row("net")[0]).toBeCloseTo(32547.21 - 3100, 1);
    expect(row("fixed-rent")[0]).toBeCloseTo(3100, 6);
    expect(row("ads-meta")[0]).toBeCloseTo(68376.67, 1);
    expect(row("net")[2]).toBeCloseTo(2 * (32547.21 - 3100), 1); // total column
    expect(row("gross")[0]).toBeCloseTo(238070.43 - 92235.46, 1);
    expect(row("net-margin")[2]).toBeCloseTo(row("net-margin")[0]!, 9);
  });
});

import { choosePeriods } from "../src/lib/pnl";
describe("P&L custom range", () => {
  it("takes whole months, caps at today and 24 months, and swaps a reversed range", () => {
    const c = choosePeriods("2026-11-13", { from: "2026-02", to: "2026-04" });
    expect(c.periods.map((p) => [p.label, p.from, p.to])).toEqual([
      ["Feb 2026", "2026-02-01", "2026-02-28"], ["Mar 2026", "2026-03-01", "2026-03-31"], ["Apr 2026", "2026-04-01", "2026-04-30"],
    ]);
    expect(choosePeriods("2026-11-13", { from: "2026-10", to: "2027-03" }).periods.at(-1)).toMatchObject({ label: "Nov 2026 (to date)", to: "2026-11-13" });
    expect(choosePeriods("2026-11-13", { from: "2023-01", to: "2026-11" }).periods.length).toBe(24);
    expect(choosePeriods("2026-11-13", { from: "2026-12", to: "2026-12" }).periods.map((p) => p.key)).toEqual(["2026-11"]);
    expect(choosePeriods("2026-11-13", { from: "2026-12", to: "2026-11" }).periods.map((p) => p.key)).toEqual(["2026-11"]);
    expect(choosePeriods("2026-11-13", { from: "2025-11", to: "2025-12" }).periods.map((p) => p.key)).toEqual(["2025-11", "2025-12"]);
    expect(choosePeriods("2026-11-13", {}).periods.length).toBe(6);
  });
});
