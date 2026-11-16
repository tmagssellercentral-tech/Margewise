// "Connect TikTok" for stores that installed Margewise from the App Store: TikTok's advertiser
// authorization (ad account information and reporting only), a long-term token stored encrypted,
// and the advertiser accounts the store chooses. The owner store keeps its environment connection.

import { db, type Shop } from "./db";
import { decrypt, encrypt } from "./shopify-app";
import { makeState } from "./meta-connect";
import { fetchTikTokCampaignDays, tiktokCall } from "./tiktok";

const APP_ID = () => process.env.TIKTOK_APP_ID ?? "";
const SECRET = () => {
  const s = process.env.TIKTOK_APP_SECRET;
  if (!s) throw new Error("TIKTOK_APP_SECRET is not set");
  return s;
};
const API = process.env.TIKTOK_API_URL ?? "https://business-api.tiktok.com/open_api/v1.3";
export const TIKTOK_REDIRECT = () => process.env.TIKTOK_REDIRECT_URI ?? "https://app.margewise.io/api/oauth/tiktok/callback";
export const tiktokConnectAvailable = () => Boolean(APP_ID() && process.env.TIKTOK_APP_SECRET);

/** TikTok's advertiser sign-in. Opened in a new tab: TikTok can't load inside the Shopify admin. */
export function tiktokLoginUrl(shopId: string): string {
  const q = new URLSearchParams({ app_id: APP_ID(), state: makeState(shopId), redirect_uri: TIKTOK_REDIRECT() });
  return `https://business-api.tiktok.com/portal/auth?${q}`;
}

export interface TikTokAccount { id: string; name: string; currency: string; active: boolean }

/** Swaps the sign-in code for a long-term token, lists the advertiser accounts and saves the connection. */
export async function completeTikTokConnection(shopId: string, authCode: string) {
  const res = await fetch(`${API}/oauth2/access_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: APP_ID(), secret: SECRET(), auth_code: authCode }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.code !== 0 || !body.data?.access_token)
    throw new Error(`TikTok token request failed: ${body?.message ?? res.status}`);
  const token: string = body.data.access_token;
  const granted: string[] = (body.data.advertiser_ids ?? []).map(String);

  // Names come from the advertiser list; currency and status from advertiser info.
  const list = await tiktokCall<{ list: { advertiser_id: string; advertiser_name: string }[] }>(
    "/oauth2/advertiser/get/", { app_id: APP_ID(), secret: SECRET() }, token).catch(() => ({ list: [] }));
  const names = new Map(list.list.map((a) => [String(a.advertiser_id), a.advertiser_name]));
  const ids = granted.length ? granted : [...names.keys()];
  const accounts: TikTokAccount[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    type Info = { advertiser_id: string; name?: string; currency?: string; status?: string };
    const info: { list: Info[] } = await tiktokCall<{ list: Info[] }>(
      "/advertiser/info/", { advertiser_ids: JSON.stringify(chunk), fields: JSON.stringify(["advertiser_id", "name", "currency", "status"]) }, token,
    ).catch(() => ({ list: chunk.map((id): Info => ({ advertiser_id: id })) }));
    for (const a of info.list) {
      const id = String(a.advertiser_id);
      accounts.push({ id, name: a.name ?? names.get(id) ?? `Account ${id}`, currency: a.currency ?? "", active: !a.status || a.status === "STATUS_ENABLE" });
    }
  }

  const active = accounts.filter((a) => a.active);
  const chosen = active.length === 1 ? [active[0].id] : [];
  const { error } = await db().from("ad_connections").upsert({
    shop_id: shopId, platform: "tiktok", token_enc: encrypt(token), token_expires_at: null,
    connected_as: null, available_accounts: accounts, account_ids: chosen, updated_at: new Date().toISOString(),
  }, { onConflict: "shop_id,platform" });
  if (error) throw new Error(error.message);
  return { accounts: accounts.length, chosen: chosen.length };
}

/** Pulls a store's TikTok spend with its own token; null when it hasn't connected or chosen an account. */
export async function storeTikTokFetcher(shop: Shop) {
  const { data: c } = await db().from("ad_connections").select("*").eq("shop_id", shop.id).eq("platform", "tiktok").maybeSingle();
  if (!c || !c.account_ids?.length) return null;
  const token = decrypt(c.token_enc);
  return (from: string, to: string) => fetchTikTokCampaignDays(from, to, { token, accounts: c.account_ids });
}
