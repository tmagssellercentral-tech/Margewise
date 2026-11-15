// "Connect Meta" for stores that installed Margewise from the App Store: Facebook Login for
// Business (read-only ads_read), a long-lived token stored encrypted, and the ad accounts the
// store chooses. The owner store keeps its environment-based connection.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db, type Shop } from "./db";
import { decrypt, encrypt } from "./shopify-app";
import { fetchCampaignDays } from "./meta";

const V = process.env.META_API_VERSION ?? "v23.0";
const APP_ID = () => process.env.META_APP_ID ?? "";
const SECRET = () => {
  const s = process.env.META_APP_SECRET;
  if (!s) throw new Error("META_APP_SECRET is not set");
  return s;
};
const CONFIG_ID = () => process.env.META_LOGIN_CONFIG_ID ?? "";
export const META_REDIRECT = () => process.env.META_REDIRECT_URI ?? "https://app.margewise.io/api/oauth/meta/callback";
export const metaConnectAvailable = () => Boolean(APP_ID() && process.env.META_APP_SECRET && CONFIG_ID());

// ---------- state: which store started the sign-in, signed and short-lived ----------

const stateKey = () => process.env.TOKEN_ENC_KEY ?? "";
const sign = (body: string) => createHmac("sha256", stateKey()).update(body).digest("base64url");

export function makeState(shopId: string, ttlSec = 15 * 60): string {
  const body = Buffer.from(JSON.stringify({ s: shopId, e: Math.floor(Date.now() / 1000) + ttlSec, n: randomBytes(8).toString("hex") })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readState(state: string | null): string | null {
  if (!state || !stateKey()) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { s, e } = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof s === "string" && typeof e === "number" && e > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}

/** The Facebook sign-in address for a store. Opened in a new tab: Facebook can't load inside the Shopify admin. */
export function metaLoginUrl(shopId: string): string {
  const q = new URLSearchParams({ client_id: APP_ID(), redirect_uri: META_REDIRECT(), config_id: CONFIG_ID(), response_type: "code", state: makeState(shopId) });
  return `https://www.facebook.com/${V}/dialog/oauth?${q}`;
}

// ---------- tokens and accounts ----------

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`https://graph.facebook.com/${V}/${path}?${new URLSearchParams(params)}`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`Meta ${res.status}: ${body.error?.message ?? JSON.stringify(body).slice(0, 200)}`);
  return body as T;
}

export interface MetaAccount { id: string; name: string; currency: string; active: boolean }

/** Swaps the sign-in code for a long-lived token, lists the ad accounts and saves the connection. */
export async function completeMetaConnection(shopId: string, code: string) {
  const short = await graph<{ access_token: string }>("oauth/access_token", {
    client_id: APP_ID(), client_secret: SECRET(), redirect_uri: META_REDIRECT(), code,
  });
  const long = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    grant_type: "fb_exchange_token", client_id: APP_ID(), client_secret: SECRET(), fb_exchange_token: short.access_token,
  });
  const token = long.access_token;
  const me = await graph<{ name?: string }>("me", { fields: "name", access_token: token });
  const accounts: MetaAccount[] = [];
  let after: string | undefined;
  do {
    const page = await graph<{ data: { account_id: string; name: string; currency: string; account_status: number }[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      "me/adaccounts", { fields: "account_id,name,currency,account_status", limit: "100", access_token: token, ...(after ? { after } : {}) });
    for (const a of page.data) accounts.push({ id: a.account_id, name: a.name, currency: a.currency, active: a.account_status === 1 });
    after = page.paging?.next ? page.paging.cursors?.after : undefined;
  } while (after);

  // One active account: pick it. Otherwise the store chooses in Settings.
  const active = accounts.filter((a) => a.active);
  const chosen = active.length === 1 ? [active[0].id] : [];
  const { error } = await db().from("ad_connections").upsert({
    shop_id: shopId, platform: "meta", token_enc: encrypt(token),
    token_expires_at: long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null,
    connected_as: me.name ?? null, available_accounts: accounts, account_ids: chosen, updated_at: new Date().toISOString(),
  }, { onConflict: "shop_id,platform" });
  if (error) throw new Error(error.message);
  return { accounts: accounts.length, chosen: chosen.length };
}

export async function getConnection(shopId: string, platform = "meta") {
  const { data } = await db().from("ad_connections").select("*").eq("shop_id", shopId).eq("platform", platform).maybeSingle();
  return data as null | {
    token_enc: string; token_expires_at: string | null; connected_as: string | null;
    available_accounts: MetaAccount[]; account_ids: string[]; updated_at: string;
  };
}

/** Pulls a store's Meta spend with its own token; null when it hasn't connected or chosen an account. */
export async function storeMetaFetcher(shop: Shop) {
  const c = await getConnection(shop.id);
  if (!c || c.account_ids.length === 0) return null;
  if (c.token_expires_at && Date.parse(c.token_expires_at) < Date.now()) throw new Error("Meta sign-in expired: reconnect Meta in Settings → Ad platforms");
  const token = decrypt(c.token_enc);
  return (from: string, to: string) => fetchCampaignDays(from, to, { token, accounts: c.account_ids });
}
