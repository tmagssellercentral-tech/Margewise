// "Connect Google Ads" for stores that installed Margewise from the App Store: Google sign-in
// with the read-and-report Google Ads scope, a refresh token stored encrypted, and the Google Ads
// accounts the store chooses. The owner store keeps its environment-based connection.

import { db, type Shop } from "./db";
import { decrypt, encrypt } from "./shopify-app";
import { makeState } from "./meta-connect";
import { GOOGLE_ADS_BASE, digits, fetchGoogleCampaignDays, googleHeaders } from "./google";

const CLIENT_ID = () => process.env.GOOGLE_ADS_CLIENT_ID ?? "";
const SECRET = () => {
  const s = process.env.GOOGLE_ADS_CLIENT_SECRET;
  if (!s) throw new Error("GOOGLE_ADS_CLIENT_SECRET is not set");
  return s;
};
export const GOOGLE_REDIRECT = () => process.env.GOOGLE_ADS_REDIRECT_URI ?? "https://app.margewise.io/api/oauth/google/callback";
export const googleConnectAvailable = () => Boolean(CLIENT_ID() && process.env.GOOGLE_ADS_CLIENT_SECRET);

/** The Google sign-in address for a store. Opened in a new tab: Google can't load inside the Shopify admin. */
export function googleLoginUrl(shopId: string): string {
  const q = new URLSearchParams({
    client_id: CLIENT_ID(),
    redirect_uri: GOOGLE_REDIRECT(),
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent", // always return a refresh token, also on reconnect
    include_granted_scopes: "true",
    state: makeState(shopId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(form: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID(), client_secret: SECRET(), ...form }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const revoked = body.error === "invalid_grant";
    throw new Error(revoked ? "Google sign-in was revoked or expired: reconnect Google Ads in Settings → Ad platforms" : `Google token request failed (${res.status}): ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body as { access_token: string; refresh_token?: string; id_token?: string; scope?: string };
}

/** The signed-in email, read from the ID token Google just returned to us over TLS. */
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const claims = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
    return typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
}

export interface GoogleAccount { id: string; name: string; currency: string; active: boolean; login: string }

async function gaql<T>(token: string, customer: string, login: string, query: string): Promise<T[]> {
  const res = await fetch(`${GOOGLE_ADS_BASE()}/customers/${customer}/googleAds:searchStream`, {
    method: "POST", headers: googleHeaders(token, login), body: JSON.stringify({ query }), cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Google Ads ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return ((body ?? []) as { results?: T[] }[]).flatMap((b) => b.results ?? []);
}

interface ClientRow {
  customerClient?: { id?: string; descriptiveName?: string; currencyCode?: string; manager?: boolean; status?: string; level?: string };
}

/**
 * Every advertising account the user can report on: accounts they can open directly, plus the
 * accounts under any manager account they belong to (read through that manager).
 */
export async function listGoogleAccounts(token: string): Promise<GoogleAccount[]> {
  const res = await fetch(`${GOOGLE_ADS_BASE()}/customers:listAccessibleCustomers`, { headers: googleHeaders(token), cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Ads ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  const roots = ((body.resourceNames ?? []) as string[]).map((r) => digits(r));
  const found = new Map<string, GoogleAccount>();
  const errors: string[] = [];
  for (const root of roots) {
    let rows: ClientRow[];
    try {
      rows = await gaql<ClientRow>(token, root, root,
        "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.status, customer_client.level FROM customer_client WHERE customer_client.level <= 1");
    } catch (e) {
      errors.push(String(e)); // e.g. a cancelled or suspended account; skip it rather than fail the whole sign-in
      continue;
    }
    for (const r of rows) {
      const c = r.customerClient;
      if (!c?.id || c.manager) continue;
      const id = digits(c.id);
      const direct = id === root;
      // Prefer reaching an account directly; otherwise through the manager that lists it.
      if (found.has(id) && !direct) continue;
      found.set(id, {
        id, name: c.descriptiveName || `Account ${id}`, currency: c.currencyCode ?? "",
        active: c.status === "ENABLED", login: direct ? "" : root,
      });
    }
  }
  if (found.size === 0 && errors.length) {
    console.error("google accounts", errors);
    throw new Error(`NO_ACCOUNTS_READABLE ${errors[0].slice(0, 300)}`);
  }
  return [...found.values()].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

/** Swaps the sign-in code for a refresh token, lists the Google Ads accounts and saves the connection. */
export async function completeGoogleConnection(shopId: string, code: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: GOOGLE_REDIRECT() });
  if (!t.scope?.includes("auth/adwords")) throw new Error("NO_SCOPE");
  if (!t.refresh_token) throw new Error("Google didn't return a refresh token");
  const accounts = await listGoogleAccounts(t.access_token);
  const active = accounts.filter((a) => a.active);
  const chosen = active.length === 1 ? [active[0].id] : [];
  const { error } = await db().from("ad_connections").upsert({
    shop_id: shopId, platform: "google", token_enc: encrypt(t.refresh_token), token_expires_at: null,
    connected_as: emailFromIdToken(t.id_token), available_accounts: accounts, account_ids: chosen, updated_at: new Date().toISOString(),
  }, { onConflict: "shop_id,platform" });
  if (error) throw new Error(error.message);
  return { accounts: accounts.length, chosen: chosen.length };
}

/** Pulls a store's Google Ads spend with its own sign-in; null when it hasn't connected or chosen an account. */
export async function storeGoogleFetcher(shop: Shop) {
  const { data: c } = await db().from("ad_connections").select("*").eq("shop_id", shop.id).eq("platform", "google").maybeSingle();
  if (!c || !c.account_ids?.length) return null;
  const { access_token } = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(c.token_enc) });
  const byId = new Map((c.available_accounts as GoogleAccount[]).map((a) => [a.id, a]));
  const accounts = (c.account_ids as string[]).map((id) => ({ id, login: byId.get(id)?.login ?? "" }));
  return (from: string, to: string) => fetchGoogleCampaignDays(from, to, { token: access_token, accounts });
}
