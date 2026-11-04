// Snapchat Ads (Marketing API v1): daily campaign spend and purchase value.
// Auth: OAuth refresh token (access tokens last an hour); the rotating refresh token is stored.
// Day boundaries are sent in the ad account's own time zone so daily buckets line up.

import type { CampaignDay } from "./meta";
import { addDays, chunkRange, localDate, tzOffset } from "./dates";
import type { Shop } from "./db";
import { accessTokenFor } from "./oauth-tokens";

const BASE = "https://adsapi.snapchat.com/v1";

export const snapchatConfigured = () =>
  Boolean(process.env.SNAPCHAT_CLIENT_ID && process.env.SNAPCHAT_CLIENT_SECRET && process.env.SNAPCHAT_REFRESH_TOKEN && process.env.SNAPCHAT_AD_ACCOUNT_IDS);

async function get<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url.startsWith("http") ? url : `${BASE}${url}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok || (body?.request_status && body.request_status !== "SUCCESS"))
    throw new Error(`Snapchat ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body as T;
}

const micros = (v: unknown) => Number(v ?? 0) / 1_000_000;

interface StatsResponse {
  timeseries_stats?: { timeseries_stat?: { timeseries?: { start_time: string; stats: Record<string, number> }[] } }[];
}

export async function fetchSnapchatCampaignDays(shop: Shop, from: string, to: string): Promise<CampaignDay[]> {
  const token = await accessTokenFor(shop, {
    platform: "snapchat",
    tokenUrl: "https://accounts.snapchat.com/login/oauth2/access_token",
    clientId: process.env.SNAPCHAT_CLIENT_ID!,
    clientSecret: process.env.SNAPCHAT_CLIENT_SECRET!,
    initialRefreshToken: process.env.SNAPCHAT_REFRESH_TOKEN!,
    basicAuth: false,
  });
  const ids = (process.env.SNAPCHAT_AD_ACCOUNT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const out: CampaignDay[] = [];
  for (const acct of ids) {
    const info = await get<{ adaccounts: { adaccount: { currency: string; timezone: string } }[] }>(token, `/adaccounts/${acct}`);
    const { currency, timezone } = info.adaccounts[0].adaccount;
    const campaigns: { id: string; name: string }[] = [];
    let next: string | null = `/adaccounts/${acct}/campaigns?limit=1000`;
    while (next) {
      const page: { campaigns: { campaign: { id: string; name: string } }[]; paging?: { next_link?: string } } = await get(token, next);
      campaigns.push(...page.campaigns.map((c) => c.campaign));
      next = page.paging?.next_link ?? null;
    }
    for (const c of campaigns) {
      for (const [s, e] of chunkRange(from, to, 30)) {
        const end = addDays(e, 1); // exclusive end at the next midnight
        const q = new URLSearchParams({
          granularity: "DAY",
          fields: "spend,conversion_purchases_value",
          start_time: `${s}T00:00:00${tzOffset(s, timezone)}`,
          end_time: `${end}T00:00:00${tzOffset(end, timezone)}`,
          omit_empty: "true",
        });
        const stats = await get<StatsResponse>(token, `/campaigns/${c.id}/stats?${q}`);
        for (const t of stats.timeseries_stats?.[0]?.timeseries_stat?.timeseries ?? []) {
          const spend = micros(t.stats?.spend);
          if (!spend) continue;
          out.push({
            date: localDate(t.start_time, timezone),
            accountId: acct,
            campaignId: c.id,
            campaignName: c.name,
            spend,
            purchaseValue: micros(t.stats?.conversion_purchases_value),
            currency,
          });
        }
      }
    }
  }
  return out;
}
