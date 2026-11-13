// Margewise as a public Shopify app: installing a store (token exchange), keeping its token fresh,
// and checking webhooks. Tokens are encrypted (AES-256-GCM) before they reach the database.

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db, type Shop } from "./db";
import { isShopDomain } from "./session-token";
import type { StoreCredentials } from "./shop-context";

export const appClientId = () => process.env.SHOPIFY_APP_CLIENT_ID ?? "";
const appSecret = () => {
  const s = process.env.SHOPIFY_APP_CLIENT_SECRET;
  if (!s) throw new Error("SHOPIFY_APP_CLIENT_SECRET is not set");
  return s;
};

// ---------- token encryption ----------

function encKey(): Buffer {
  const k = process.env.TOKEN_ENC_KEY;
  if (!k) throw new Error("TOKEN_ENC_KEY is not set");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new Error("TOKEN_ENC_KEY must be 32 bytes, base64");
  return buf;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

export function decrypt(boxed: string): string {
  const [v, iv, tag, body] = boxed.split(".");
  if (v !== "v1") throw new Error("Unknown token format");
  const d = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
}

// ---------- webhooks ----------

/** Shopify signs each webhook body with the app secret; anything else is rejected. */
export function webhookIsGenuine(rawBody: string, hmacHeader: string | null, secret = appSecret()): boolean {
  if (!hmacHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const given = Buffer.from(hmacHeader, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ---------- tokens ----------

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

async function tokenRequest(store: string, form: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`https://${store}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: appClientId(), client_secret: appSecret(), ...form }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Shopify token request failed (${res.status}): ${JSON.stringify(body).slice(0, 200)}`);
  return body as TokenResponse;
}

const later = (sec?: number) => (sec ? new Date(Date.now() + sec * 1000).toISOString() : null);

async function saveTokens(store: string, t: TokenResponse) {
  const row: Record<string, unknown> = {
    access_token_enc: encrypt(t.access_token),
    access_expires_at: later(t.expires_in),
  };
  if (t.refresh_token) {
    row.refresh_token_enc = encrypt(t.refresh_token);
    row.refresh_expires_at = later(t.refresh_token_expires_in);
  }
  if (t.scope) row.scopes = t.scope;
  const { error } = await db().from("shops").update(row).eq("myshopify_domain", store);
  if (error) throw new Error(error.message);
}

/** Swaps an App Bridge session token for an offline (store-level) token that expires and refreshes. */
export function exchangeSessionToken(store: string, idToken: string) {
  return tokenRequest(store, {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: idToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    expiring: "1",
  });
}

// One refresh at a time per store in this process (Shopify rotates the refresh token).
const inflight = new Map<string, Promise<string>>();

/** A working Admin API token for an installed store, refreshed when it's about to expire. */
export async function storeToken(store: string): Promise<string> {
  const { data, error } = await db()
    .from("shops")
    .select("access_token_enc, access_expires_at, refresh_token_enc, uninstalled_at")
    .eq("myshopify_domain", store)
    .single();
  if (error || !data?.access_token_enc) throw new Error(`${store} is not installed`);
  if (data.uninstalled_at) throw new Error(`${store} uninstalled Margewise`);
  const fresh = !data.access_expires_at || Date.parse(data.access_expires_at) > Date.now() + 5 * 60_000;
  if (fresh) return decrypt(data.access_token_enc);
  if (!data.refresh_token_enc) throw new Error(`${store} needs to reopen Margewise to reconnect`);
  const running = inflight.get(store);
  if (running) return running;
  const p = (async () => {
    const t = await tokenRequest(store, { grant_type: "refresh_token", refresh_token: decrypt(data.refresh_token_enc) });
    await saveTokens(store, t);
    return t.access_token;
  })().finally(() => inflight.delete(store));
  inflight.set(store, p);
  return p;
}

export const STORE_CHANNELS = "(source_name:web OR source_name:pos OR source_name:shopify_draft_order)";
export const credentialsFor = (store: string): StoreCredentials => ({ store, token: () => storeToken(store), channels: STORE_CHANNELS });

// ---------- installing ----------

const NO_FEE_GATEWAYS = ["manual", "Cash on Delivery (COD)", "Bank Deposit", "Money Order", "gift_card"];

interface ShopInfo {
  shop: {
    name: string;
    myshopifyDomain: string;
    currencyCode: string;
    ianaTimezone: string;
    taxesIncluded: boolean;
    billingAddress: { countryCodeV2: string | null } | null;
  };
}

async function shopInfo(store: string, token: string): Promise<ShopInfo["shop"]> {
  const res = await fetch(`https://${store}/admin/api/${process.env.SHOPIFY_API_VERSION ?? "2026-07"}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: "{ shop { name myshopifyDomain currencyCode ianaTimezone taxesIncluded billingAddress { countryCodeV2 } } }" }),
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok || body.errors) throw new Error(`Shopify shop query failed: ${JSON.stringify(body.errors ?? body).slice(0, 200)}`);
  return (body.data as ShopInfo).shop;
}

/**
 * Makes sure a store that opened Margewise has a database row and a working token. On first open
 * it creates the store with sensible global defaults (Shopify's own tax figures, no assumed
 * courier or packaging costs) and reports that a first data load is needed.
 */
export async function ensureInstalled(store: string, idToken: string): Promise<{ shop: Shop; isNew: boolean }> {
  if (!isShopDomain(store)) throw new Error("Not a Shopify store address");
  const existing = await db().from("shops").select("*").eq("myshopify_domain", store).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const row = existing.data;
  if (row?.access_token_enc && !row.uninstalled_at) return { shop: { ...row, vat_rate: Number(row.vat_rate) } as Shop, isNew: false };

  const t = await exchangeSessionToken(store, idToken);
  const info = await shopInfo(store, t.access_token);
  let shopRow = row;
  if (!shopRow) {
    const ins = await db()
      .from("shops")
      .insert({
        shop_domain: store,
        myshopify_domain: store,
        name: info.name,
        currency: info.currencyCode,
        timezone: info.ianaTimezone,
        country: info.billingAddress?.countryCodeV2 ?? "US",
        prices_include_vat: info.taxesIncluded,
        tax_mode: "shopify",
        vat_registered: false,
        vat_rate: 0,
        installed_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    shopRow = ins.data;
    const s = await db().from("shop_settings").insert({ shop_id: shopRow.id });
    if (s.error) throw new Error(s.error.message);
    // Payment methods that never carry a processing fee, so they don't show as missing a fee rule.
    await db().from("payment_fee_rules").insert(NO_FEE_GATEWAYS.map((g) => ({ shop_id: shopRow.id, gateway_match: g, note: "No processing fee" })));
  } else {
    await db().from("shops").update({ uninstalled_at: null, installed_at: new Date().toISOString(), name: info.name }).eq("id", shopRow.id);
  }
  await saveTokens(store, t);
  return { shop: { ...shopRow, vat_rate: Number(shopRow.vat_rate) } as Shop, isNew: true };
}
