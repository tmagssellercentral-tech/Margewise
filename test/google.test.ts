import { describe, expect, it, vi, afterEach } from "vitest";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { fetchGoogleCampaignDays, serviceAccountJwt } from "../src/lib/google";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const key = {
  client_email: "margewise@proj.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

describe("Google service-account JWT", () => {
  it("is signed RS256 with the Ads scope and a one-hour expiry", () => {
    const jwt = serviceAccountJwt(key, 1_800_000_000);
    const [h, c, sig] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims).toMatchObject({ iss: key.client_email, scope: "https://www.googleapis.com/auth/adwords", aud: "https://oauth2.googleapis.com/token", exp: 1_800_003_600 });
    const v = createVerify("RSA-SHA256"); v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
  });
});

describe("fetchGoogleCampaignDays", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  function stub(currency: string) {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", JSON.stringify(key));
    vi.stubEnv("GOOGLE_ADS_CUSTOMER_IDS", "123-456-7890");
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
      return new Response(JSON.stringify([{ results: [
        { customer: { currencyCode: currency }, campaign: { id: "9", name: "Search - Brand" }, segments: { date: "2026-10-05" }, metrics: { costMicros: "1234560000", conversionsValue: 4500.5 } },
      ] }]));
    }));
    return calls;
  }

  it("converts micros, strips hyphens and sends no developer token", async () => {
    const calls = stub("ZAR");
    const rows = await fetchGoogleCampaignDays("2026-10-01", "2026-10-31", "ZAR");
    expect(rows).toEqual([{ date: "2026-10-05", accountId: "1234567890", campaignId: "9", campaignName: "Search - Brand", spend: 1234.56, purchaseValue: 4500.5 }]);
    const ads = calls.find((c) => c.url.includes("googleads"))!;
    expect(ads.url).toContain("/customers/1234567890/googleAds:searchStream");
    expect(Object.keys(ads.init.headers as object)).not.toContain("developer-token");
  });

  it("refuses an account billed in another currency", async () => {
    stub("USD");
    await expect(fetchGoogleCampaignDays("2026-10-01", "2026-10-31", "ZAR")).rejects.toThrow(/bills in USD/);
  });
});
