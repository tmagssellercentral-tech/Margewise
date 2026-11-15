import { afterEach, describe, expect, it, vi } from "vitest";
import { emailFromIdToken, googleLoginUrl, listGoogleAccounts } from "../src/lib/google-connect";
import { readState } from "../src/lib/meta-connect";

const jwt = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;

describe("Google Ads connect", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the signed-in email from the ID token", () => {
    expect(emailFromIdToken(jwt({ email: "owner@store.com" }))).toBe("owner@store.com");
    expect(emailFromIdToken(undefined)).toBeNull();
    expect(emailFromIdToken("garbage")).toBeNull();
  });

  it("asks for offline, read-only reporting access and signs the store id", () => {
    process.env.TOKEN_ENC_KEY = Buffer.alloc(32, 3).toString("base64");
    process.env.GOOGLE_ADS_CLIENT_ID = "cid";
    const u = new URL(googleLoginUrl("shop-1"));
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("scope")).toContain("auth/adwords");
    expect(u.searchParams.get("redirect_uri")).toBe("https://app.margewise.io/api/oauth/google/callback");
    expect(readState(u.searchParams.get("state"))).toBe("shop-1");
  });

  it("lists direct accounts and accounts under a manager, skipping managers", async () => {
    const calls: { url: string; login?: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const h = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url, login: h["login-customer-id"] });
      if (url.endsWith("customers:listAccessibleCustomers"))
        return new Response(JSON.stringify({ resourceNames: ["customers/111", "customers/999"] }));
      const results = url.includes("/customers/111/")
        ? [{ customerClient: { id: "111", descriptiveName: "My Store", currencyCode: "USD", manager: false, status: "ENABLED", level: "0" } }]
        : [
            { customerClient: { id: "999", descriptiveName: "Agency MCC", manager: true, status: "ENABLED", level: "0" } },
            { customerClient: { id: "222", descriptiveName: "Client A", currencyCode: "GBP", manager: false, status: "ENABLED", level: "1" } },
            { customerClient: { id: "111", descriptiveName: "My Store", currencyCode: "USD", manager: false, status: "ENABLED", level: "1" } },
            { customerClient: { id: "333", descriptiveName: "Old", currencyCode: "GBP", manager: false, status: "CANCELED", level: "1" } },
          ];
      return new Response(JSON.stringify([{ results }]));
    }));
    const accounts = await listGoogleAccounts("tok");
    expect(accounts.map((a) => [a.id, a.login, a.active])).toEqual([
      ["222", "999", true],
      ["111", "", true], // reachable directly, so no manager is used
      ["333", "999", false],
    ]);
    expect(calls.find((c) => c.url.includes("/customers/999/"))?.login).toBe("999");
  });
});
