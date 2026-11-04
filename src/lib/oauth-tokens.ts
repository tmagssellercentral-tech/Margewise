// Access tokens for platforms whose refresh tokens rotate on every refresh (Pinterest, Snapchat).
// The first refresh token comes from a Vercel variable; after that the newest one lives in
// platform_tokens, because the old one stops working once it's been used.

import { db, type Shop } from "./db";

export interface RefreshConfig {
  platform: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  initialRefreshToken: string;
  /** Pinterest wants client credentials as HTTP Basic; Snapchat wants them in the body. */
  basicAuth: boolean;
  extra?: Record<string, string>;
}

export async function accessTokenFor(shop: Shop, c: RefreshConfig): Promise<string> {
  const { data: found } = await db().from("platform_tokens").select("*").eq("shop_id", shop.id).eq("platform", c.platform).maybeSingle();
  // A new refresh token pasted into Vercel (a reconnect) replaces whatever is stored.
  const row = found && found.seed_refresh_token === c.initialRefreshToken ? found : null;
  if (row?.access_token && row.access_expires_at && Date.parse(row.access_expires_at) > Date.now() + 5 * 60_000) return row.access_token;

  const refresh = row?.refresh_token ?? c.initialRefreshToken;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, ...(c.extra ?? {}) });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (c.basicAuth) headers.Authorization = `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`;
  else { body.set("client_id", c.clientId); body.set("client_secret", c.clientSecret); }

  const res = await fetch(c.tokenUrl, { method: "POST", headers, body, cache: "no-store" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    const hint = row?.refresh_token ? " Reconnect the platform: create a new refresh token and update it in Vercel." : "";
    throw new Error(`${c.platform} token refresh failed (${res.status}): ${JSON.stringify(j).slice(0, 200)}.${hint}`);
  }
  const { error } = await db().from("platform_tokens").upsert({
    shop_id: shop.id,
    platform: c.platform,
    access_token: j.access_token,
    access_expires_at: new Date(Date.now() + Number(j.expires_in ?? 3600) * 1000).toISOString(),
    refresh_token: j.refresh_token ?? refresh,
    seed_refresh_token: c.initialRefreshToken,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Couldn't store ${c.platform} token: ${error.message}`);
  return j.access_token;
}
