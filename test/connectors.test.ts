import { afterEach, describe, expect, it, vi } from "vitest";

// The token store is mocked; these tests cover request shape and response parsing.
vi.mock("../src/lib/oauth-tokens", () => ({ accessTokenFor: vi.fn(async () => "tok") }));

import { fetchTikTokCampaignDays } from "../src/lib/tiktok";
import { fetchPinterestCampaignDays } from "../src/lib/pinterest";
import { fetchSnapchatCampaignDays } from "../src/lib/snapchat";
import { chunkRange, tzOffset } from "../src/lib/dates";
import type { Shop } from "../src/lib/db";

const shop = { id: "s", currency: "ZAR", timezone: "Africa/Johannesburg" } as Shop;
const json = (b: unknown) => new Response(JSON.stringify(b));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("date helpers", () => {
  it("chunks ranges and finds time zone offsets", () => {
    expect(chunkRange("2026-10-01", "2026-11-05", 30)).toEqual([["2026-10-01", "2026-10-30"], ["2026-10-31", "2026-11-05"]]);
    expect(tzOffset("2026-11-01", "Africa/Johannesburg")).toBe("+02:00");
    expect(tzOffset("2026-07-01", "America/New_York")).toBe("-04:00");
    expect(tzOffset("2026-12-01", "Asia/Kolkata")).toBe("+05:30");
  });
});

describe("TikTok", () => {
  it("sends Access-Token, reads string metrics, checks code and pages", async () => {
    vi.stubEnv("TIKTOK_ACCESS_TOKEN", "t"); vi.stubEnv("TIKTOK_ADVERTISER_IDS", "700");
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init: RequestInit) => {
      urls.push(u);
      expect((init.headers as Record<string, string>)["Access-Token"]).toBe("t");
      if (u.includes("/advertiser/info/")) return json({ code: 0, data: { list: [{ currency: "USD" }] } });
      const page = Number(new URL(u).searchParams.get("page"));
      return json({ code: 0, data: { page_info: { total_page: 2 }, list: [
        { dimensions: { campaign_id: `c${page}`, stat_time_day: "2026-10-05 00:00:00" }, metrics: { campaign_name: "Spark", spend: "12.50", total_complete_payment_rate: "40.10" } },
        { dimensions: { campaign_id: "zero", stat_time_day: "2026-10-05 00:00:00" }, metrics: { spend: "0" } },
      ] } });
    }));
    const rows = await fetchTikTokCampaignDays("2026-10-01", "2026-10-07");
    expect(rows).toEqual([
      { date: "2026-10-05", accountId: "700", campaignId: "c1", campaignName: "Spark", spend: 12.5, purchaseValue: 40.1, currency: "USD" },
      { date: "2026-10-05", accountId: "700", campaignId: "c2", campaignName: "Spark", spend: 12.5, purchaseValue: 40.1, currency: "USD" },
    ]);
    const report = new URL(urls[1]).searchParams;
    expect(report.get("data_level")).toBe("AUCTION_CAMPAIGN");
    expect(JSON.parse(report.get("dimensions")!)).toEqual(["campaign_id", "stat_time_day"]);
  });

  it("raises TikTok's error message when code isn't 0", async () => {
    vi.stubEnv("TIKTOK_ACCESS_TOKEN", "t"); vi.stubEnv("TIKTOK_ADVERTISER_IDS", "700");
    vi.stubGlobal("fetch", vi.fn(async () => json({ code: 40105, message: "Access token is incorrect" })));
    await expect(fetchTikTokCampaignDays("2026-10-01", "2026-10-02")).rejects.toThrow(/Access token is incorrect/);
  });
});

describe("Pinterest", () => {
  it("lists campaigns, then reads micro-unit analytics in the account currency", async () => {
    vi.stubEnv("PINTEREST_AD_ACCOUNT_IDS", "549");
    vi.stubEnv("PINTEREST_CLIENT_ID", "id"); vi.stubEnv("PINTEREST_CLIENT_SECRET", "sec"); vi.stubEnv("PINTEREST_REFRESH_TOKEN", "r");
    let analytics = "";
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/ad_accounts/549")) return json({ currency: "GBP" });
      if (u.includes("/campaigns?")) return json({ items: [{ id: "11", name: "Pins" }], bookmark: null });
      analytics = u;
      return json([{ CAMPAIGN_ID: "11", DATE: "2026-10-03", SPEND_IN_MICRO_DOLLAR: 5_250_000, TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR: 20_000_000 }]);
    }));
    const rows = await fetchPinterestCampaignDays(shop, "2026-10-01", "2026-10-07");
    expect(rows).toEqual([{ date: "2026-10-03", accountId: "549", campaignId: "11", campaignName: "Pins", spend: 5.25, purchaseValue: 20, currency: "GBP" }]);
    const q = new URL(analytics).searchParams;
    expect(q.get("granularity")).toBe("DAY");
    expect(q.get("campaign_ids")).toBe("11");
  });
});

describe("Snapchat", () => {
  it("asks for day boundaries in the account's time zone and converts micros", async () => {
    vi.stubEnv("SNAPCHAT_AD_ACCOUNT_IDS", "aa");
    vi.stubEnv("SNAPCHAT_CLIENT_ID", "id"); vi.stubEnv("SNAPCHAT_CLIENT_SECRET", "sec"); vi.stubEnv("SNAPCHAT_REFRESH_TOKEN", "r");
    let statsUrl = "";
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (u.endsWith("/adaccounts/aa")) return json({ request_status: "SUCCESS", adaccounts: [{ adaccount: { currency: "USD", timezone: "America/Los_Angeles" } }] });
      if (u.includes("/campaigns?")) return json({ request_status: "SUCCESS", campaigns: [{ campaign: { id: "c9", name: "Snaps" } }], paging: {} });
      statsUrl = u;
      return json({ request_status: "SUCCESS", timeseries_stats: [{ timeseries_stat: { timeseries: [
        { start_time: "2026-10-01T00:00:00.000-07:00", stats: { spend: 3_000_000, conversion_purchases_value: 9_000_000 } },
        { start_time: "2026-10-02T00:00:00.000-07:00", stats: { spend: 0 } },
      ] } }] });
    }));
    const rows = await fetchSnapchatCampaignDays(shop, "2026-10-01", "2026-10-02");
    expect(rows).toEqual([{ date: "2026-10-01", accountId: "aa", campaignId: "c9", campaignName: "Snaps", spend: 3, purchaseValue: 9, currency: "USD" }]);
    const q = new URL(statsUrl).searchParams;
    expect(q.get("start_time")).toBe("2026-10-01T00:00:00-07:00");
    expect(q.get("end_time")).toBe("2026-10-03T00:00:00-07:00");
  });
});
