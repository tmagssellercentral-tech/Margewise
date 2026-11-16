import { describe, expect, it } from "vitest";
import { isDue, localHour, parseRecipients, renderDailyEmail } from "../src/lib/daily-email";
import type { Shop } from "../src/lib/db";

const shop = { id: "s1", name: "Test Store", currency: "USD", timezone: "America/New_York", myshopify_domain: "test-store.myshopify.com", is_owner: false } as Shop;

const total = (o: Partial<Record<string, unknown>> = {}) => ({
  orders: 4, revenueIncl: 400, netRevenue: 380, cogs: 120, paymentFees: 12, courier: 30, returnsCost: 0, packaging: 4,
  contribution: 214, adSpend: 100, profitAfterAds: 114, fixedCosts: 20, netProfit: 94, poas: null, breakEvenRoas: 1.8, missingCostSkus: [], ...o,
});
const range = (t = total(), products: unknown[] = []) =>
  ({ total: t, products, platforms: [{ platform: "meta", adCost: 70 }, { platform: "google", adCost: 30 }] }) as never;

describe("daily profit email", () => {
  it("accepts a typed list of addresses and rejects junk", () => {
    expect(parseRecipients("A@x.com, b@y.co\nA@x.com")).toEqual(["a@x.com", "b@y.co"]);
    expect(parseRecipients("  ")).toEqual([]);
    expect(() => parseRecipients("a@x.com, not-an-email")).toThrow(/not-an-email/);
    expect(() => parseRecipients("1@a.com 2@a.com 3@a.com 4@a.com 5@a.com 6@a.com")).toThrow(/Up to 5/);
  });

  it("is due once the store's local morning arrives, once a day", () => {
    const at = new Date("2026-11-16T12:30:00Z"); // 07:30 in New York, 14:30 in Johannesburg
    expect(localHour(at, "America/New_York")).toBe(7);
    expect(isDue(at, "America/New_York", null)).toBe(true);
    expect(isDue(at, "America/New_York", "2026-11-15")).toBe(true);
    expect(isDue(at, "America/New_York", "2026-11-16")).toBe(false);
    expect(isDue(new Date("2026-11-16T10:00:00Z"), "America/New_York", null)).toBe(false); // 05:00 local
  });

  it("reports yesterday's net profit, the costs behind it and ads against break-even", () => {
    const mail = renderDailyEmail(shop, "2026-11-15", range(total(), [{ sku: "A", title: "Kettlebell <16kg>", units: 2, contribution: 90 }]),
      range(total({ netProfit: 50 })), range(total({ netProfit: 1500, revenueIncl: 9000 })), "https://app.margewise.io/api/email/unsubscribe?t=x");
    expect(mail.subject).toBe("Test Store: $94 net profit yesterday on 4 orders");
    expect(mail.empty).toBe(false);
    expect(mail.html).toContain("Sunday 15 November");
    expect(mail.html).toContain("Up $44 on the same day last week");
    expect(mail.text).toContain("MER 4.00x against a break-even ROAS of 1.80x: ads paid for themselves.");
    expect(mail.html).toContain("Kettlebell &#60;16kg&#62;"); // product names are escaped
    expect(mail.html).toContain("Meta $70");
    expect(mail.text).toContain("This month so far: $1,500 net profit on $9,000 revenue");
    expect(mail.html).toContain("admin.shopify.com/store/test-store/apps/");
  });

  it("flags losses, missing costs and quiet days", () => {
    const loss = renderDailyEmail(shop, "2026-11-15", range(total({ netProfit: -30, revenueIncl: 100, adSpend: 100, missingCostSkus: ["X", "Y"] })),
      range(), range(), "u");
    expect(loss.subject).toContain("−$30 net profit");
    expect(loss.text).toContain("ads cost more than they brought in");
    expect(loss.text).toContain("2 product(s) have no cost");
    const quiet = renderDailyEmail(shop, "2026-11-15", range(total({ orders: 0, adSpend: 0, revenueIncl: 0, netProfit: -20 })), range(), range(), "u");
    expect(quiet.empty).toBe(true);
  });
});
