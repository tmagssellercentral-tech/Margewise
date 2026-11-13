import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { isShopDomain, verifySessionToken } from "../src/lib/session-token";
import { decrypt, encrypt, webhookIsGenuine } from "../src/lib/shopify-app";

const SECRET = "shh-test-secret";
const CLIENT = "client-123";
const b64u = (s: string | Buffer) => Buffer.from(s).toString("base64url");

function token(claims: Record<string, unknown>, secret = SECRET, alg = "HS256") {
  const h = b64u(JSON.stringify({ alg, typ: "JWT" }));
  const p = b64u(JSON.stringify(claims));
  const sig = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}
const now = 1_800_000_000;
const good = {
  iss: "https://acme.myshopify.com/admin", dest: "https://acme.myshopify.com", aud: CLIENT,
  sub: "42", exp: now + 60, nbf: now - 5, iat: now - 5, jti: "x", sid: "y",
};

describe("session tokens", () => {
  it("accepts a valid token and returns the store", async () => {
    expect(await verifySessionToken(token(good), CLIENT, SECRET, now)).toEqual({ shop: "acme.myshopify.com", sub: "42", exp: now + 60 });
  });
  it("rejects a wrong signature, audience, expiry or mismatched store", async () => {
    expect(await verifySessionToken(token(good, "other"), CLIENT, SECRET, now)).toBeNull();
    expect(await verifySessionToken(token({ ...good, aud: "someone-else" }), CLIENT, SECRET, now)).toBeNull();
    expect(await verifySessionToken(token({ ...good, exp: now - 60 }), CLIENT, SECRET, now)).toBeNull();
    expect(await verifySessionToken(token({ ...good, dest: "https://evil.myshopify.com" }), CLIENT, SECRET, now)).toBeNull();
    expect(await verifySessionToken(token({ ...good, iss: "https://evil.com/admin", dest: "https://evil.com" }), CLIENT, SECRET, now)).toBeNull();
    expect(await verifySessionToken(token(good, SECRET, "none"), CLIENT, SECRET, now)).toBeNull();
    expect(await verifySessionToken("garbage", CLIENT, SECRET, now)).toBeNull();
  });
  it("only accepts myshopify.com store addresses", () => {
    expect(isShopDomain("acme.myshopify.com")).toBe(true);
    expect(isShopDomain("acme.myshopify.com.evil.com")).toBe(false);
    expect(isShopDomain("https://acme.myshopify.com")).toBe(false);
  });
});

describe("webhooks and token storage", () => {
  beforeAll(() => { process.env.TOKEN_ENC_KEY = Buffer.alloc(32, 7).toString("base64"); });
  it("accepts only bodies signed with the app secret", () => {
    const body = '{"shop_domain":"acme.myshopify.com"}';
    const sig = createHmac("sha256", SECRET).update(body).digest("base64");
    expect(webhookIsGenuine(body, sig, SECRET)).toBe(true);
    expect(webhookIsGenuine(body + " ", sig, SECRET)).toBe(false);
    expect(webhookIsGenuine(body, null, SECRET)).toBe(false);
    expect(webhookIsGenuine(body, "short", SECRET)).toBe(false);
  });
  it("encrypts tokens so the stored value is never the token, and decrypts them back", () => {
    const boxed = encrypt("shpat_secret_value");
    expect(boxed).not.toContain("shpat");
    expect(boxed).not.toBe(encrypt("shpat_secret_value")); // fresh IV each time
    expect(decrypt(boxed)).toBe("shpat_secret_value");
    const tampered = boxed.slice(0, -4) + (boxed.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decrypt(tampered)).toThrow();
  });
});
