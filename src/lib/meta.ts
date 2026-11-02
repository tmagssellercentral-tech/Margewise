// Reads daily campaign spend and purchase value from the Meta Marketing API.

const API_VERSION = process.env.META_API_VERSION ?? "v23.0";

export interface CampaignDay {
  date: string;
  accountId: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  purchaseValue: number;
}

interface InsightRow {
  date_start: string;
  campaign_id: string;
  campaign_name: string;
  spend: string;
  action_values?: { action_type: string; value: string }[];
}

const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

function purchaseValue(row: InsightRow): number {
  for (const t of PURCHASE_TYPES) {
    const hit = row.action_values?.find((a) => a.action_type === t);
    if (hit) return Number(hit.value);
  }
  return 0;
}

export async function fetchCampaignDays(from: string, to: string): Promise<CampaignDay[]> {
  const token = process.env.META_ACCESS_TOKEN;
  const accounts = (process.env.META_AD_ACCOUNT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token || accounts.length === 0) throw new Error("META_ACCESS_TOKEN and META_AD_ACCOUNT_IDS must be set");

  const out: CampaignDay[] = [];
  for (const acct of accounts) {
    const params = new URLSearchParams({
      level: "campaign",
      fields: "campaign_id,campaign_name,spend,action_values",
      time_range: JSON.stringify({ since: from, until: to }),
      time_increment: "1",
      limit: "500",
    });
    let url: string | null = `https://graph.facebook.com/${API_VERSION}/act_${acct}/insights?${params}`;
    while (url) {
      const res: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(`Meta ${res.status}: ${JSON.stringify(body.error ?? body).slice(0, 500)}`);
      for (const row of body.data as InsightRow[]) {
        out.push({
          date: row.date_start,
          accountId: acct,
          campaignId: row.campaign_id,
          campaignName: row.campaign_name,
          spend: Number(row.spend ?? 0),
          purchaseValue: purchaseValue(row),
        });
      }
      url = body.paging?.next ?? null;
    }
  }
  return out;
}
