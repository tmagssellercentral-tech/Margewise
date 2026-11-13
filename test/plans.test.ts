import { describe, expect, it } from "vitest";
import { PLANS, planFromSubscriptionName, planOf } from "../src/lib/plans";
import type { Shop } from "../src/lib/db";

describe("plans", () => {
  it("maps Shopify subscription names to plans", () => {
    expect(planFromSubscriptionName("Growth")).toBe("growth");
    expect(planFromSubscriptionName("Scale (annual)")).toBe("scale");
    expect(planFromSubscriptionName("starter")).toBe("starter");
    expect(planFromSubscriptionName(null)).toBe("free");
    expect(planFromSubscriptionName("Free")).toBe("free");
  });
  it("gives the owner store everything and others their plan", () => {
    expect(planOf({ is_owner: true } as Shop).orderLimit).toBeNull();
    expect(planOf({ is_owner: false, plan: "starter" } as Shop)).toBe(PLANS.starter);
    expect(planOf({ is_owner: false, plan: "nonsense" } as Shop)).toBe(PLANS.free);
  });
  it("prices annual plans at 20% off, rounded to a clean figure", () => {
    for (const p of [PLANS.starter, PLANS.growth, PLANS.scale]) {
      const exact = p.monthly! * 12 * 0.8;
      expect(Math.abs(p.annual! - exact)).toBeLessThan(5);
    }
  });
});
