import { describe, expect, it } from "vitest";
import { computeOrder, courierFor, fixedCostForDay, totals, type FeeRule, type OrderInput, type ShopConfig } from "../src/lib/engine";

const base: ShopConfig = {
  vatRegistered: true,
  vatRate: 0.2,
  pricesIncludeVat: true,
  packagingPerOrder: 0,
  fulfilmentPerOrder: 0,
  returnHandlingPerOrder: 0,
  courierStandard: 5,
  courierBulky: 20,
  courierReturnStandard: 5,
  courierReturnBulky: 20,
  adSpendIncludesVat: false,
  taxMode: "shopify",
  country: "GB",
};
const noFees: FeeRule[] = [];
const order = (o: Partial<OrderInput>): OrderInput => ({
  name: "#1", localDate: "2026-10-01", gateway: null, shippingIncl: 0, refundIncl: 0, returnStatus: "none",
  lines: [{ sku: "A", quantity: 1, lineTotalIncl: 120, unitCost: 50 }], ...o,
});

describe("Shopify tax mode", () => {
  it("strips VAT already inside the price (UK/EU/AU style)", () => {
    const r = computeOrder(order({ taxAmount: 20, taxesIncluded: true }), base, noFees, new Set());
    expect(r.totalIncl).toBe(120);
    expect(r.netRevenue).toBeCloseTo(100, 6);
  });

  it("excludes sales tax added at checkout (US style), and the customer paid price + tax", () => {
    const us: ShopConfig = { ...base, vatRegistered: false, country: "US" };
    const r = computeOrder(order({ lines: [{ sku: "A", quantity: 1, lineTotalIncl: 100, unitCost: 40 }], taxAmount: 8.25, taxesIncluded: false }), us, noFees, new Set());
    expect(r.totalIncl).toBeCloseTo(108.25, 6);
    expect(r.netRevenue).toBeCloseTo(100, 6);
  });

  it("removes the tax share of a refund too", () => {
    const r = computeOrder(order({ taxAmount: 20, taxesIncluded: true, refundIncl: 60 }), base, noFees, new Set());
    expect(r.netRevenue).toBeCloseTo(50, 6); // (120 − 60) × (1 − 20/120)
  });
});

describe("actual fees and courier costs", () => {
  it("uses the gateway's actual fee instead of the rule, and doesn't flag the gateway", () => {
    const rules: FeeRule[] = [{ gatewayMatch: "shopify_payments", pct: 0.1, fixedFee: 0, minFee: 0 }];
    const r = computeOrder(order({ gateway: "shopify_payments", actualPaymentFee: 3.4 }), base, rules, new Set());
    expect(r.paymentFee).toBeCloseTo(3.4, 6);
    const u = computeOrder(order({ gateway: "mystery_pay", actualPaymentFee: 2 }), base, noFees, new Set());
    expect(u.unmatchedGateway).toBeNull();
  });

  it("uses an imported courier invoice cost when present", () => {
    const r = computeOrder(order({ actualCourier: 7.9 }), base, noFees, new Set());
    expect(r.courier).toBeCloseTo(7.9, 6);
  });
});

describe("courier zones", () => {
  const c: ShopConfig = {
    ...base,
    courierRules: [
      { zone: "domestic", parcelSize: "standard", cost: 4, returnCost: 4 },
      { zone: "international", parcelSize: "standard", cost: 15, returnCost: 0 },
      { zone: "IE", parcelSize: "standard", cost: 9, returnCost: 9 },
      { zone: "domestic", parcelSize: "bulky", cost: 25, returnCost: 25 },
    ],
  };
  it("picks exact country, then domestic/international, then the store default", () => {
    expect(courierFor(c, "GB", false).cost).toBe(4);
    expect(courierFor(c, "ie", false).cost).toBe(9);
    expect(courierFor(c, "US", false).cost).toBe(15);
    expect(courierFor(c, null, true).cost).toBe(25);
    expect(courierFor(c, "US", true).cost).toBe(20); // no international bulky rule → default
    expect(courierFor({ ...base }, "US", false).cost).toBe(5); // no rules at all
  });
});

describe("fixed costs", () => {
  const za: ShopConfig = { ...base, vatRate: 0.15 };
  const rent = { name: "Rent", category: "premises", amount: 3100, frequency: "monthly" as const, startDate: "2026-10-01", endDate: null, vatClaimable: false };
  it("spreads a monthly cost over the days in that month", () => {
    expect(fixedCostForDay(rent, "2026-10-15", za)).toBeCloseTo(100, 6);
    expect(fixedCostForDay(rent, "2026-11-15", za)).toBeCloseTo(3100 / 30, 6);
    expect(fixedCostForDay(rent, "2026-09-30", za)).toBe(0);
  });
  it("handles weekly, yearly, one-off, end dates and reclaimable VAT", () => {
    expect(fixedCostForDay({ ...rent, frequency: "weekly", amount: 70 }, "2026-10-02", za)).toBeCloseTo(10, 6);
    expect(fixedCostForDay({ ...rent, frequency: "yearly", amount: 3650 }, "2026-10-02", za)).toBeCloseTo(10, 6);
    expect(fixedCostForDay({ ...rent, frequency: "once", amount: 500 }, "2026-10-01", za)).toBe(500);
    expect(fixedCostForDay({ ...rent, frequency: "once", amount: 500 }, "2026-10-02", za)).toBe(0);
    expect(fixedCostForDay({ ...rent, endDate: "2026-10-10" }, "2026-10-11", za)).toBe(0);
    expect(fixedCostForDay({ ...rent, amount: 3565, vatClaimable: true }, "2026-10-01", za)).toBeCloseTo(100, 6);
  });
  it("net profit = profit after ads − fixed costs", () => {
    const r = computeOrder(order({ taxAmount: 20, taxesIncluded: true }), base, noFees, new Set());
    const t = totals([r], 10, base, 30);
    expect(t.profitAfterAds).toBeCloseTo(100 - 50 - 5 - 10, 2);
    expect(t.netProfit).toBeCloseTo(t.profitAfterAds - 30, 2);
  });
});

describe("fee caps and Shopify's transaction fee", () => {
  it("caps a percentage fee (e.g. Paystack's ₦2,000 cap)", () => {
    const rules: FeeRule[] = [{ gatewayMatch: "Paystack", pct: 0.015, fixedFee: 100, minFee: 0, maxFee: 2000 }];
    const big = computeOrder(order({ gateway: "Paystack", lines: [{ sku: "A", quantity: 1, lineTotalIncl: 500000, unitCost: 1 }] }), { ...base, taxMode: "rate", vatRegistered: true }, rules, new Set());
    expect(big.paymentFee).toBeCloseTo(2000, 6);
  });
  it("adds Shopify's fee on third-party gateways only", () => {
    const c: ShopConfig = { ...base, shopifyTxnFeePct: 0.02 };
    expect(computeOrder(order({ gateway: "PayFast" }), c, noFees, new Set()).paymentFee).toBeCloseTo(2.4, 6);
    expect(computeOrder(order({ gateway: "shopify_payments", actualPaymentFee: 3 }), c, noFees, new Set()).paymentFee).toBeCloseTo(3, 6);
    expect(computeOrder(order({ gateway: "Bank Deposit" }), c, noFees, new Set()).paymentFee).toBe(0);
  });
});
