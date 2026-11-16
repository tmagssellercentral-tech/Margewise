// "Connect Pinterest" for stores that installed Margewise from the App Store: Pinterest OAuth with
// read-only ads scopes, a refresh token stored encrypted (it rotates on every refresh, so the newest
// one is saved back), and the ad accounts the store chooses. The owner store keeps its environment setup.

import { db, type Shop } from "./db";
import { decrypt, encrypt } from "./shopify-app";
import { makeState } from "./meta-connect";
import { fetchPinterestCampaignDays, pinterestGet } from "./pinterest";

const APP_ID = () => process.env.PINTEREST_APP_ID ?? "";
const SECRET = () => {
  const s = process.env.PINTEREST_APP_SECRET;
  if (!s) throw new Error("PINTEREST_APP_SECRET is not set");
  return s;
};
export const PINTEREST_REDIRECT = () => process.env.PINTEREST_REDIRECT_URI ?? "https://app.margewise.io/api/oauth/pinterest/callback";
export const pinterestConnectAvailable = () => Boolean(APP_ID() && process.env.PINTEREST_APP_SECRET);

/** Pinterest's sign-in. Opened in a new tab: Pinterest can't load inside the Shopify admin. */
export function pinterestLoginUrl(shopId: string): string {
  const q = new URLSearchParams({
    client_id: APP_ID(), redirect_uri: PINTEREST_REDIRECT(), response_type: "code",
    scope: "ads:read,user_accounts:read", state: makeState(shopId),
  });
  return `https://www.pinterest.com/oauth/?${q}`;
}

interface TokenResponse { access_token: string; refresh_token?: string; refresh_token_expires_in?: number }

async function tokenRequest(form: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${APP_ID()}:${SECRET()}`).toString("base64")}` },
    body: new URLSearchParams({ ...form, continuous_refresh: "true" }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const revoked = res.status === 400 || res.status === 401;
    throw new Error(revoked && form.grant_type === "refresh_token"
      ? "Pinterest sign-in was revoked or expired: reconnect Pinterest in Settings → Ad platforms"
      : `Pinterest token request failed (${res.status}): ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body as TokenResponse;
}

export interface PinterestAccount { id: string; name: string; currency: string; active: boolean }

/** Swaps the sign-in code for tokens, lists the ad accounts and saves the connection. */
export async function completePinterestConnection(shopId: string, code: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: PINTEREST_REDIRECT() });
  if (!t.refresh_token) throw new Error("Pinterest didn't return a refresh token");
  const me = await pinterestGet<{ username?: string }>(t.access_token, "/user_account").catch(() => ({ username: undefined }));
  const accounts: PinterestAccount[] = [];
  let bookmark: string | null = null;
  do {
    const page: { items: { id: string; name: string; currency?: string; status?: string }[]; bookmark?: string | null } =
      await pinterestGet(t.access_token, "/ad_accounts", { page_size: "100", ...(bookmark ? { bookmark } : {}) });
    // Archived accounts can't run ads, so they're left out of the list.
    for (const a of page.items ?? []) if (a.status !== "ARCHIVED") accounts.push({ id: String(a.id), name: a.name, currency: a.currency ?? "", active: true });
    bookmark = page.bookmark ?? null;
  } while (bookmark);

  const chosen = accounts.length === 1 ? [accounts[0].id] : [];
  const { error } = await db().from("ad_connections").upsert({
    shop_id: shopId, platform: "pinterest", token_enc: encrypt(t.refresh_token),
    token_expires_at: t.refresh_token_expires_in ? new Date(Date.now() + t.refresh_token_expires_in * 1000).toISOString() : null,
    connected_as: me.username ?? null, available_accounts: accounts, account_ids: chosen, updated_at: new Date().toISOString(),
  }, { onConflict: "shop_id,platform" });
  if (error) throw new Error(error.message);
  return { accounts: accounts.length, chosen: chosen.length };
}

/** Pulls a store's Pinterest spend with its own sign-in; null when it hasn't connected or chosen an account. */
export async function storePinterestFetcher(shop: Shop) {
  const { data: c } = await db().from("ad_connections").select("*").eq("shop_id", shop.id).eq("platform", "pinterest").maybeSingle();
  if (!c || !c.account_ids?.length) return null;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(c.token_enc) });
  if (t.refresh_token) {
    // The old refresh token stops working once used, so keep the new one.
    await db().from("ad_connections").update({
      token_enc: encrypt(t.refresh_token),
      token_expires_at: t.refresh_token_expires_in ? new Date(Date.now() + t.refresh_token_expires_in * 1000).toISOString() : c.token_expires_at,
      updated_at: new Date().toISOString(),
    }).eq("id", c.id);
  }
  return (from: string, to: string) => fetchPinterestCampaignDays(shop, from, to, { token: t.access_token, accounts: c.account_ids });
}
