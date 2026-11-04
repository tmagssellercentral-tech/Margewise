// Reads daily campaign spend and conversion value from the Google Ads API.
//
// Auth: a Google Cloud service account, added as a Read only user on each Google Ads account
// (Admin > Access and security > Users). Since Google retired developer tokens on 9 Sep 2026,
// access is granted per Cloud project (Explorer level is enough for reading your own accounts),
// so no developer-token header is sent.

import { createSign } from "node:crypto";
import type { CampaignDay } from "./meta";

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? "v26";
const SCOPE = "https://www.googleapis.com/auth/adwords";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cached: { token: string; expiresAt: number } | null = null;

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

function serviceAccount(): ServiceAccountKey {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must be set");
  // Accept the JSON key as pasted, or base64-encoded.
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const key = JSON.parse(text) as ServiceAccountKey;
  if (!key.client_email || !key.private_key) throw new Error("Service account JSON is missing client_email or private_key");
  return key;
}

export function serviceAccountJwt(key: ServiceAccountKey, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: key.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(key.private_key.replace(/\\n/g, "\n")))}`;
}

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const key = serviceAccount();
  const res = await fetch(key.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: serviceAccountJwt(key) }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token)
    throw new Error(`Google token request failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  cached = { token: body.access_token, expiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_ADS_CUSTOMER_IDS);

const digits = (s: string) => s.replace(/\D/g, "");

interface GaqlRow {
  customer?: { currencyCode?: string };
  campaign?: { id?: string; name?: string };
  segments?: { date?: string };
  metrics?: { costMicros?: string; conversionsValue?: number };
}

/**
 * Campaign spend by day for every account in GOOGLE_ADS_CUSTOMER_IDS (comma-separated, hyphens fine).
 * Set GOOGLE_ADS_LOGIN_CUSTOMER_ID only when access is through a manager (MCC) account.
 * Throws if an account's currency differs from the store's, until currency conversion is added.
 */
export async function fetchGoogleCampaignDays(from: string, to: string, storeCurrency: string): Promise<CampaignDay[]> {
  const ids = (process.env.GOOGLE_ADS_CUSTOMER_IDS ?? "").split(",").map(digits).filter(Boolean);
  if (ids.length === 0) throw new Error("GOOGLE_ADS_CUSTOMER_IDS must be set");
  const login = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "");
  const token = await accessToken();
  const query = `SELECT customer.currency_code, campaign.id, campaign.name, segments.date, metrics.cost_micros, metrics.conversions_value
    FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}' AND metrics.cost_micros > 0`;

  const out: CampaignDay[] = [];
  for (const id of ids) {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (login) headers["login-customer-id"] = login;
    const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${id}/googleAds:searchStream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Google Ads ${res.status} for ${id}: ${JSON.stringify(body).slice(0, 500)}`);
    // searchStream returns an array of batches, each with its own results.
    for (const batch of (body ?? []) as { results?: GaqlRow[] }[]) {
      for (const r of batch.results ?? []) {
        const cur = r.customer?.currencyCode;
        if (cur && cur !== storeCurrency)
          throw new Error(`Google Ads account ${id} bills in ${cur} but the store sells in ${storeCurrency}; currency conversion isn't supported yet`);
        out.push({
          date: r.segments?.date ?? "",
          accountId: id,
          campaignId: r.campaign?.id ?? "",
          campaignName: r.campaign?.name ?? "",
          spend: Number(r.metrics?.costMicros ?? 0) / 1_000_000,
          purchaseValue: Number(r.metrics?.conversionsValue ?? 0),
        });
      }
    }
  }
  return out;
}
