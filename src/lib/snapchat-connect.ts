// "Connect Snapchat" for stores that installed Margewise from the App Store: Snapchat's OAuth with
// the Marketing API scope, a refresh token stored encrypted (saved again whenever Snapchat issues a
// new one), and the ad accounts the store chooses. The owner store keeps its environment setup.

import { db, type Shop } from "./db";
import { decrypt, encrypt } from "./shopify-app";
import { makeState } from "./meta-connect";
import { fetchSnapchatCampaignDays, snapchatGet } from "./snapchat";

const CLIENT_ID = () => process.env.SNAPCHAT_APP_CLIENT_ID ?? "";
const SECRET = () => {
  const s = process.env.SNAPCHAT_APP_CLIENT_SECRET;
  if (!s) throw new Error("SNAPCHAT_APP_CLIENT_SECRET is not set");
  return s;
};
export const SNAPCHAT_REDIRECT = () => process.env.SNAPCHAT_REDIRECT_URI ?? "https://app.margewise.io/api/oauth/snapchat/callback";
export const snapchatConnectAvailable = () => Boolean(CLIENT_ID() && process.env.SNAPCHAT_APP_CLIENT_SECRET);

/** Snapchat's sign-in. Opened in a new tab: Snapchat can't load inside the Shopify admin. */
export function snapchatLoginUrl(shopId: string): string {
  const q = new URLSearchParams({
    client_id: CLIENT_ID(), redirect_uri: SNAPCHAT_REDIRECT(), response_type: "code",
    scope: "snapchat-marketing-api", state: makeState(shopId),
  });
  return `https://accounts.snapchat.com/login/oauth2/authorize?${q}`;
}

interface TokenResponse { access_token: string; refresh_token?: string }

async function tokenRequest(form: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://accounts.snapchat.com/login/oauth2/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID(), client_secret: SECRET(), ...form }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(form.grant_type === "refresh_token" && (res.status === 400 || res.status === 401)
      ? "Snapchat sign-in was revoked or expired: reconnect Snapchat in Settings → Ad platforms"
      : `Snapchat token request failed (${res.status}): ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body as TokenResponse;
}

export interface SnapchatAccount { id: string; name: string; currency: string; active: boolean }

interface OrgsResponse {
  organizations?: { organization: { name?: string; ad_accounts?: { id: string; name: string; currency?: string; status?: string }[] } }[];
}

/** Swaps the sign-in code for tokens, lists the ad accounts across the user's organisations and saves the connection. */
export async function completeSnapchatConnection(shopId: string, code: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: SNAPCHAT_REDIRECT() });
  if (!t.refresh_token) throw new Error("Snapchat didn't return a refresh token");
  const me = await snapchatGet<{ me?: { display_name?: string; email?: string } }>(t.access_token, "/me").catch(() => ({ me: undefined }));
  const orgs = await snapchatGet<OrgsResponse>(t.access_token, "/me/organizations?with_ad_accounts=true");
  const accounts: SnapchatAccount[] = [];
  for (const o of orgs.organizations ?? []) {
    for (const a of o.organization.ad_accounts ?? []) {
      if (accounts.some((x) => x.id === a.id)) continue;
      accounts.push({ id: a.id, name: a.name, currency: a.currency ?? "", active: !a.status || a.status === "ACTIVE" });
    }
  }
  const active = accounts.filter((a) => a.active);
  const chosen = active.length === 1 ? [active[0].id] : [];
  const { error } = await db().from("ad_connections").upsert({
    shop_id: shopId, platform: "snapchat", token_enc: encrypt(t.refresh_token), token_expires_at: null,
    connected_as: me.me?.email ?? me.me?.display_name ?? null, available_accounts: accounts, account_ids: chosen,
    updated_at: new Date().toISOString(),
  }, { onConflict: "shop_id,platform" });
  if (error) throw new Error(error.message);
  return { accounts: accounts.length, chosen: chosen.length };
}

/** Pulls a store's Snapchat spend with its own sign-in; null when it hasn't connected or chosen an account. */
export async function storeSnapchatFetcher(shop: Shop) {
  const { data: c } = await db().from("ad_connections").select("*").eq("shop_id", shop.id).eq("platform", "snapchat").maybeSingle();
  if (!c || !c.account_ids?.length) return null;
  const refresh = decrypt(c.token_enc);
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
  if (t.refresh_token && t.refresh_token !== refresh) {
    await db().from("ad_connections").update({ token_enc: encrypt(t.refresh_token), updated_at: new Date().toISOString() }).eq("id", c.id);
  }
  return (from: string, to: string) => fetchSnapchatCampaignDays(shop, from, to, { token: t.access_token, accounts: c.account_ids });
}
