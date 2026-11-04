// Pinterest Ads (API v5): daily campaign spend and checkout value.
// Auth: OAuth with continuous refresh; the rotating refresh token is stored in platform_tokens.
// Note: Pinterest reports days in UTC, so a day's spend can differ slightly from the store's day.

import type { CampaignDay } from "./meta";
import { chunkRange } from "./dates";
import type { Shop } from "./db";
import { accessTokenFor } from "./oauth-tokens";

const BASE = "https://api.pinterest.com/v5";

export const pinterestConfigured = () =>
  Boolean(process.env.PINTEREST_CLIENT_ID && process.env.PINTEREST_CLIENT_SECRET && process.env.PINTEREST_REFRESH_TOKEN && process.env.PINTEREST_AD_ACCOUNT_IDS);

async function get<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}${q ? `?${q}` : ""}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Pinterest ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body as T;
}

const micros = (v: unknown) => Number(v ?? 0) / 1_000_000;

export async function fetchPinterestCampaignDays(shop: Shop, from: string, to: string): Promise<CampaignDay[]> {
  const token = await accessTokenFor(shop, {
    platform: "pinterest",
    tokenUrl: `${BASE}/oauth/token`,
    clientId: process.env.PINTEREST_CLIENT_ID!,
    clientSecret: process.env.PINTEREST_CLIENT_SECRET!,
    initialRefreshToken: process.env.PINTEREST_REFRESH_TOKEN!,
    basicAuth: true,
    extra: { continuous_refresh: "true" },
  });
  const ids = (process.env.PINTEREST_AD_ACCOUNT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const out: CampaignDay[] = [];
  for (const acct of ids) {
    const info = await get<{ currency?: string }>(token, `/ad_accounts/${acct}`);
    const campaigns: { id: string; name: string }[] = [];
    let bookmark: string | null = null;
    do {
      const page: { items: { id: string; name: string }[]; bookmark?: string | null } = await get(token, `/ad_accounts/${acct}/campaigns`, {
        page_size: "250",
        entity_statuses: "ACTIVE,PAUSED,ARCHIVED",
        ...(bookmark ? { bookmark } : {}),
      });
      campaigns.push(...page.items);
      bookmark = page.bookmark ?? null;
    } while (bookmark);
    const names = new Map(campaigns.map((c) => [c.id, c.name]));
    // Analytics take at most 250 campaign ids and 90 days per call.
    for (let i = 0; i < campaigns.length; i += 250) {
      const batch = campaigns.slice(i, i + 250).map((c) => c.id).join(",");
      for (const [s, e] of chunkRange(from, to, 90)) {
        const rows = await get<Record<string, string | number>[]>(token, `/ad_accounts/${acct}/campaigns/analytics`, {
          start_date: s,
          end_date: e,
          campaign_ids: batch,
          columns: "SPEND_IN_MICRO_DOLLAR,TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR",
          granularity: "DAY",
        });
        for (const r of rows ?? []) {
          const spend = micros(r.SPEND_IN_MICRO_DOLLAR);
          if (!spend) continue;
          const id = String(r.CAMPAIGN_ID);
          out.push({
            date: String(r.DATE).slice(0, 10),
            accountId: acct,
            campaignId: id,
            campaignName: names.get(id) ?? id,
            spend, // "MICRO_DOLLAR" is micro-units of the account's own currency
            purchaseValue: micros(r.TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR),
            currency: info.currency,
          });
        }
      }
    }
  }
  return out;
}
