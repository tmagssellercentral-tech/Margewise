import { completeMetaConnection, readState } from "@/lib/meta-connect";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string, back?: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#e7e5de;color:#0f1713;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
.c{background:#fff;border-radius:14px;padding:28px 32px;max-width:460px;box-shadow:0 1px 3px rgba(16,32,27,.1)}h1{font-size:20px;margin:0 0 8px}p{color:#39443e;line-height:1.5}
a{display:inline-block;margin-top:10px;background:#0f6b4f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600}</style></head>
<body><div class="c"><h1>${esc(title)}</h1><p>${body}</p>${back ? `<a href="${esc(back)}">Back to Margewise</a>` : ""}</div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

/** Facebook sends the store back here after it approves read-only access to its ad accounts. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopId = readState(url.searchParams.get("state"));
  if (!shopId) return page("This link has expired", "Go back to Margewise and click Connect Meta again.");
  const { data: shop } = await db().from("shops").select("myshopify_domain").eq("id", shopId).maybeSingle();
  const handle = shop?.myshopify_domain?.replace(/\.myshopify\.com$/, "");
  const back = handle ? `https://admin.shopify.com/store/${handle}/apps/${process.env.SHOPIFY_APP_HANDLE ?? "margewise-1"}/settings?tab=ads` : undefined;
  if (url.searchParams.get("error")) return page("Meta wasn't connected", "You cancelled the Facebook sign-in, so nothing was connected.", back);
  const code = url.searchParams.get("code");
  if (!code) return page("Meta wasn't connected", "Facebook didn't return a sign-in code. Please try again.", back);
  try {
    const r = await completeMetaConnection(shopId, code);
    const msg = r.accounts === 0
      ? "You're signed in, but this Facebook profile has no ad accounts. Sign in with the profile that manages your ads."
      : r.chosen ? "Your ad account is connected. Margewise will load your Meta spend shortly; you can close this tab."
      : `Found ${r.accounts} ad accounts. Go back to Margewise and choose which ones belong to this store.`;
    return page("Meta connected", msg, back);
  } catch (e) {
    console.error("meta connect", e);
    return page("Meta wasn't connected", "Something went wrong while connecting. Please try again, or email support@margewise.io.", back);
  }
}
