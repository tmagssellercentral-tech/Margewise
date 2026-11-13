import { db } from "@/lib/db";
import { isShopDomain } from "@/lib/session-token";
import { webhookIsGenuine } from "@/lib/shopify-app";

export const dynamic = "force-dynamic";

/**
 * Every webhook Shopify sends Margewise: app/uninstalled plus the three mandatory privacy
 * (compliance) topics. Each delivery is checked against the app secret and recorded once.
 *
 * What Margewise holds about a store's customers: Shopify's numeric customer id on each order
 * (no names, emails, phone numbers or addresses), used only to count new and returning buyers.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!webhookIsGenuine(raw, req.headers.get("x-shopify-hmac-sha256"))) return new Response("Unauthorized", { status: 401 });

  const topic = req.headers.get("x-shopify-topic") ?? "";
  const store = req.headers.get("x-shopify-shop-domain") ?? "";
  const id = req.headers.get("x-shopify-event-id") ?? req.headers.get("x-shopify-webhook-id") ?? `${topic}:${Date.now()}`;
  if (!isShopDomain(store)) return new Response("Bad shop", { status: 400 });

  const seen = await db().from("webhook_events").select("processed_at").eq("id", id).maybeSingle();
  if (seen.data?.processed_at) return new Response("ok");
  await db().from("webhook_events").upsert({ id, shop_domain: store, topic });

  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(raw); } catch { /* empty body is fine */ }
  const shop = (await db().from("shops").select("id, is_owner, uninstalled_at").eq("myshopify_domain", store).maybeSingle()).data;
  let detail = "";

  switch (topic) {
    case "app/uninstalled":
      // Stop using the store's tokens at once. Its data is deleted when Shopify sends shop/redact (48 hours later).
      if (shop) {
        await db().from("shops").update({ uninstalled_at: new Date().toISOString(), access_token_enc: null, refresh_token_enc: null, access_expires_at: null, refresh_expires_at: null }).eq("id", shop.id);
        detail = "tokens removed";
      }
      break;
    case "shop/redact":
      // Delete the store and everything about it (every store table cascades from shops).
      // Skipped if the store reinstalled Margewise in the meantime: its data is in use again.
      if (shop && !shop.is_owner && shop.uninstalled_at) {
        const { error } = await db().from("shops").delete().eq("id", shop.id);
        if (error) return new Response("Retry", { status: 500 });
        detail = "store data deleted";
      } else detail = !shop ? "no data held" : shop.is_owner ? "owner store kept" : "store reinstalled, data kept";
      break;
    case "customers/redact": {
      const cid = Number((payload.customer as { id?: number } | undefined)?.id);
      if (shop && Number.isFinite(cid)) {
        const a = await db().from("customer_orders").update({ customer_id: null }).eq("shop_id", shop.id).eq("customer_id", cid);
        const b = await db().from("orders").update({ customer_id: null }).eq("shop_id", shop.id).eq("customer_id", cid);
        if (a.error || b.error) return new Response("Retry", { status: 500 });
        detail = "customer id removed from orders";
      } else detail = "no data held";
      break;
    }
    case "customers/data_request":
      // Margewise holds only the anonymous customer id on orders; the request is logged for a manual reply.
      detail = "logged for reply by support@margewise.io";
      break;
    default:
      detail = "ignored";
  }
  await db().from("webhook_events").update({ processed_at: new Date().toISOString(), detail }).eq("id", id);
  return new Response("ok");
}
