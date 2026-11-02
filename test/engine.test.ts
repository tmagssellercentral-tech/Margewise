import { describe, expect, it } from "vitest";
import fixture from "./fixtures/september-2026.json";
import { byProduct, computeOrder, totals, type FeeRule, type OrderInput, type ShopConfig } from "../src/lib/engine";

// Flexi Muscles settings as confirmed for the September 2026 answer key.
const config: ShopConfig = {
  vatRegistered: true,
  vatRate: 0.15,
  pricesIncludeVat: true,
  packagingPerOrder: 25,
  fulfilmentPerOrder: 0,
  returnHandlingPerOrder: 50,
  courierStandard: 95,
  courierBulky: 350,
  courierReturnStandard: 95,
  courierReturnBulky: 350,
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

const bulky = new Set(fixture.bulky);
const results = (fixture.orders as OrderInput[]).map((o) => computeOrder(o, config, rules, bulky));
const t = totals(results, fixture.metaSpend, config);

// Figures from "Flexi Muscles - True Profit Model.xlsx", Monthly P&L tab (29 Oct 2026).
describe("September 2026 answer key", () => {
  it("has every website order", () => expect(t.orders).toBe(115));
  it("net revenue", () => expect(t.netRevenue).toBeCloseTo(238070.43, 1));
  it("product cost", () => expect(t.cogs).toBeCloseTo(92235.46, 1));
  it("payment fees", () => expect(t.paymentFees).toBeCloseTo(7906.1, 1));
  it("courier", () => expect(t.courier).toBeCloseTo(34130, 1));
  it("packaging", () => expect(t.packaging).toBeCloseTo(2875, 1));
  it("contribution before ads", () => expect(t.contribution).toBeCloseTo(100923.88, 1));
  it("profit after ads", () => expect(t.profitAfterAds).toBeCloseTo(32547.21, 1));
  it("POAS", () => expect(t.poas!).toBeCloseTo(1.476, 3));
  it("break-even ROAS", () => expect(t.breakEvenRoas!).toBeCloseTo(2.7345, 3));
  it("no missing costs", () => expect(t.missingCostSkus).toEqual([]));
  it("best product is the incline/decline bench", () => {
    const p = byProduct(results);
    expect(p[0].sku).toBe("MultiLevelBench");
    expect(p[0].contribution).toBeCloseTo(13933, 0);
  });
});

describe("edge cases", () => {
  const base: OrderInput = {
    name: "#1", localDate: "2026-11-01", gateway: "Stitch Express", shippingIncl: 150,
    refundIncl: 0, returnStatus: "none",
    lines: [{ sku: "FabResist 01", quantity: 1, lineTotalIncl: 399, unitCost: 71.91 }],
  };
  it("restocked return reverses product cost and adds return costs", () => {
    const r = computeOrder({ ...base, refundIncl: 549, returnStatus: "returned_restocked" }, config, rules, bulky);
    expect(r.cogs).toBe(0);
    expect(r.returnsCost).toBeCloseTo(145, 2);
    expect(r.netRevenue).toBeCloseTo(0, 2);
  });
  it("unknown gateway is flagged and costs nothing", () => {
    const r = computeOrder({ ...base, gateway: "SomeNewGateway" }, config, rules, bulky);
    expect(r.paymentFee).toBe(0);
    expect(r.unmatchedGateway).toBe("SomeNewGateway");
  });
  it("missing unit cost is reported", () => {
    const r = computeOrder({ ...base, lines: [{ ...base.lines[0], unitCost: null }] }, config, rules, bulky);
    expect(r.missingCostSkus).toEqual(["FabResist 01"]);
  });
  it("non-VAT-registered store carries VAT on costs", () => {
    const r = computeOrder(base, { ...config, vatRegistered: false }, rules, bulky);
    expect(r.courier).toBeCloseTo(95 * 1.15, 2);
    expect(r.netRevenue).toBeCloseTo(549, 2);
  });
});
