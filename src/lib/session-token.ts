// Shopify session tokens (the "id token" App Bridge hands an embedded app). They are short-lived
// JWTs signed with the app's client secret (HS256). Uses Web Crypto so it runs in middleware too.

export interface SessionClaims {
  shop: string; // e.g. some-store.myshopify.com
  sub?: string; // Shopify staff user id
  exp: number;
}

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** A store's admin address, and nothing else (guards every place a shop name is used). */
export const isShopDomain = (s: string | null | undefined): s is string =>
  !!s && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s);

/**
 * Checks the signature, expiry, audience and that issuer and destination are the same store.
 * Returns the claims, or null if anything is off.
 */
export async function verifySessionToken(
  token: string,
  clientId: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<SessionClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
    if (header.alg !== "HS256") return null;
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${h}.${p}`)));
    if (!sameBytes(expected, b64urlToBytes(sig))) return null;
    const c = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    const skew = 10;
    if (typeof c.exp !== "number" || c.exp + skew < nowSec) return null;
    if (typeof c.nbf === "number" && c.nbf - skew > nowSec) return null;
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (!aud.includes(clientId)) return null;
    const dest = new URL(c.dest).hostname;
    const iss = new URL(c.iss).hostname;
    if (dest !== iss || !isShopDomain(dest)) return null;
    return { shop: dest, sub: c.sub, exp: c.exp };
  } catch {
    return null;
  }
}
