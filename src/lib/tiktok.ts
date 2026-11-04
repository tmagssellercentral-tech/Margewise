// TikTok Ads (API for Business v1.3): daily campaign spend and purchase value.
// Auth: a long-lived advertiser access token, sent as the "Access-Token" header.
// Built from TikTok's official SDK (tiktok-business-api-sdk); parsing is defensive because
// metric values arrive as strings.

import type { CampaignDay } from "./meta";
import { chunkRange } from "./dates";

const BASE = process.env.TIKTOK_API_URL ?? "https://business-api.tiktok.com/open_api/v1.3";

export const tiktokConfigured = () => Boolean(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_ADVERTISER_IDS);

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = process.env.TIKTOK_ACCESS_TOKEN!;
  const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, { headers: { "Access-Token": token }, cache: "no-store" });
  const body = await res.json().catch(() => null);
  // TikTok returns HTTP 200 with a non-zero code on errors.
  if (!res.ok || !body || body.code !== 0) throw new Error(`TikTok ${res.status} ${body?.code ?? ""}: ${body?.message ?? JSON.stringify(body).slice(0, 300)}`);
  return body.data as T;
}

interface ReportRow {
  dimensions: { campaign_id: string; stat_time_day: string };
  metrics: Record<string, string>;
}

export async function fetchTikTokCampaignDays(from: string, to: string): Promise<CampaignDay[]> {
  const ids = (process.env.TIKTOK_ADVERTISER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const out: CampaignDay[] = [];
  for (const id of ids) {
    const info = await call<{ list: { currency?: string }[] }>("/advertiser/info/", {
      advertiser_ids: JSON.stringify([id]),
      fields: JSON.stringify(["currency", "timezone"]),
    });
    const currency = info.list?.[0]?.currency;
    // Daily reports are capped at 30 days per request.
    for (const [s, e] of chunkRange(from, to, 30)) {
      for (let page = 1; ; page++) {
        const data = await call<{ list: ReportRow[]; page_info: { total_page: number } }>("/report/integrated/get/", {
          advertiser_id: id,
          report_type: "BASIC",
          data_level: "AUCTION_CAMPAIGN",
          dimensions: JSON.stringify(["campaign_id", "stat_time_day"]),
          metrics: JSON.stringify(["campaign_name", "spend", "total_complete_payment_rate"]),
          start_date: s,
          end_date: e,
          page: String(page),
          page_size: "1000",
        });
        for (const r of data.list ?? []) {
          const spend = Number(r.metrics.spend ?? 0);
          if (!spend) continue;
          out.push({
            date: r.dimensions.stat_time_day.slice(0, 10),
            accountId: id,
            campaignId: r.dimensions.campaign_id,
            campaignName: r.metrics.campaign_name ?? r.dimensions.campaign_id,
            spend,
            // Despite the name, total_complete_payment_rate is the purchase value (time_attr_total_shopping_value).
            purchaseValue: Number(r.metrics.total_complete_payment_rate ?? 0) || 0,
            currency,
          });
        }
        if (page >= (data.page_info?.total_page ?? 1)) break;
      }
    }
  }
  return out;
}
