import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOrdersUpdatedSince } from "../src/lib/shopify";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("optional order fields", () => {
  it("drops only the customer field when read_customers is missing, and keeps the country", async () => {
    vi.stubEnv("SHOPIFY_STORE", "x.myshopify.com"); vi.stubEnv("SHOPIFY_ADMIN_TOKEN", "t");
    const queries: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      const q = JSON.parse(String(init.body)).query as string;
      queries.push(q);
      if (q.includes("customer { id }")) return new Response(JSON.stringify({ errors: [{ message: "Access denied for customer field. Required access: `read_customers` access scope.", extensions: { code: "ACCESS_DENIED" }, path: ["orders", "nodes", 0, "customer"] }] }));
      return new Response(JSON.stringify({ data: { orders: { nodes: [{ id: "gid://shopify/Order/1" }], pageInfo: { hasNextPage: false, endCursor: "" } } } }));
    }));
    const rows = await fetchOrdersUpdatedSince("2026-10-01T00:00:00Z");
    expect(rows).toHaveLength(1);
    expect(queries).toHaveLength(2);
    expect(queries[1]).toContain("shippingAddress { countryCodeV2 }");
    expect(queries[1]).not.toContain("customer { id }");
  });
});
