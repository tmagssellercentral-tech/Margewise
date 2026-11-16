// The small page an ad platform's sign-in returns to (outside the Shopify admin, in its own tab).
import { db } from "./db";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function resultPage(title: string, body: string, back?: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#e7e5de;color:#0f1713;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
.c{background:#fff;border-radius:14px;padding:28px 32px;max-width:460px;box-shadow:0 1px 3px rgba(16,32,27,.1)}h1{font-size:20px;margin:0 0 8px}p{color:#39443e;line-height:1.5}
a{display:inline-block;margin-top:10px;background:#0f6b4f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600}</style></head>
<body><div class="c"><h1>${esc(title)}</h1><p>${body}</p>${back ? `<a href="${esc(back)}">Back to Margewise</a>` : ""}</div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

/** Margewise's Ad platforms settings tab inside the store's Shopify admin. */
export async function backToSettings(shopId: string) {
  const { data: shop } = await db().from("shops").select("myshopify_domain").eq("id", shopId).maybeSingle();
  const handle = shop?.myshopify_domain?.replace(/\.myshopify\.com$/, "");
  return handle ? `https://admin.shopify.com/store/${handle}/apps/${process.env.SHOPIFY_APP_HANDLE ?? "margewise-1"}/settings?tab=ads` : undefined;
}

/** Loads the last 60 days of spend for a platform the store just connected (run after the response). */
export async function loadConnectedSpend(shopId: string, platform: "meta" | "google" | "tiktok" | "pinterest") {
  const { addDays, localDate } = await import("./dates");
  const { storeFetchers } = await import("./ad-connect");
  const { recompute, syncAds } = await import("./sync");
  const { runForStore } = await import("./shop-context");
  const { credentialsFor } = await import("./shopify-app");
  const row = (await db().from("shops").select("*").eq("id", shopId).single()).data;
  if (!row?.myshopify_domain) return;
  const shop = { ...row, vat_rate: Number(row.vat_rate) };
  const pull = await storeFetchers[platform](shop);
  if (!pull) return;
  const today = localDate(new Date(), shop.timezone);
  const from = addDays(today, -60);
  await runForStore(credentialsFor(row.myshopify_domain), async () => {
    await syncAds(shop, platform, from, today, () => pull(from, today));
    await recompute(shop, from, today);
  });
}
