import { describe, expect, it } from "vitest";
import { computeCustomerMetrics } from "../src/lib/customers";

describe("customer metrics", () => {
  const orders = [
    { shopifyId: 10, customerId: 1, netRevenue: 100 }, // customer 1's first order: new
    { shopifyId: 11, customerId: 1, netRevenue: 50 },  // customer 1 again in the same period: returning order
    { shopifyId: 12, customerId: 2, netRevenue: 200 }, // customer 2 bought before this period: returning
    { shopifyId: 13, customerId: 3, netRevenue: 80 },  // new
    { shopifyId: 14, customerId: null, netRevenue: 30 }, // no customer attached
  ];
  const firstOrder = new Map([[1, 10], [2, 5], [3, 13]]);
  const m = computeCustomerMetrics({
    orders, firstOrder, adSpend: 400, revenueDivisor: 1.15, contributionMargin: 0.4,
    summary: { customers: 100, repeatCustomers: 25, orders: 140, netIncl: 115000, firstOrderAt: "2021-03-01T10:00:00Z" },
  });
  it("splits new and returning by each customer's first order", () => {
    expect(m).toMatchObject({ known: true, customers: 3, newCustomers: 2, returningCustomers: 1, newOrders: 2, returningOrders: 2, guestOrders: 1, newRevenue: 180, returningRevenue: 250 });
    expect(m.returningCustomerRate).toBeCloseTo(1 / 3, 9);
  });
  it("works out CAC, repeat rate and LTV", () => {
    expect(m.cac).toBe(200);
    expect(m.repeatRate).toBe(0.25);
    expect(m.ordersPerCustomer).toBe(1.4);
    expect(m.ltvRevenue).toBeCloseTo(1000, 6); // 115,000 ÷ 1.15 ÷ 100
    expect(m.ltvProfit).toBeCloseTo(400, 6);
    expect(m.ltvToCac).toBeCloseTo(2, 6);
  });
  it("reports unknown until customer numbers arrive", () => {
    const u = computeCustomerMetrics({ orders: [{ shopifyId: 1, customerId: null, netRevenue: 10 }], firstOrder: new Map(), adSpend: 5, summary: null, revenueDivisor: 1, contributionMargin: null });
    expect(u.known).toBe(false);
    expect(u.cac).toBeNull();
  });
});
