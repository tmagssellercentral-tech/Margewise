import { cronAuthorized } from "@/lib/auth";
import { db, type Shop } from "@/lib/db";
import { gql } from "@/lib/shopify";
import { credentialsFor } from "@/lib/shopify-app";
import { runForStore } from "@/lib/shop-context";
import { firstLoad } from "@/lib/onboarding";
import { isShopDomain } from "@/lib/session-token";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Owner-only: what an installed store's orders look like (counts by channel), and optionally re-run its first load. */
export async function GET(req: Request) {
  if (!cronAuthorized(req, true)) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const store = url.searchParams.get("store") ?? "";
  if (!isShopDomain(store)) return Response.json({ error: "store must be a myshopify.com address" }, { status: 400 });
  const out: Record<string, unknown> = {};
  await runForStore(credentialsFor(store), async () => {
    try {
      const d = await gql<{ ordersCount: { count: number }; orders: { nodes: { sourceName: string | null; createdAt: string }[] } }>(
        "{ ordersCount(limit: 10000) { count } orders(first: 100, reverse: true, sortKey: CREATED_AT) { nodes { sourceName createdAt } } }", {});
      out.ordersCount = d.ordersCount.count;
      const by: Record<string, number> = {};
      for (const o of d.orders.nodes) by[o.sourceName ?? "none"] = (by[o.sourceName ?? "none"] ?? 0) + 1;
      out.recentBySource = by;
      out.newest = d.orders.nodes[0]?.createdAt;
      out.oldest = d.orders.nodes.at(-1)?.createdAt;
    } catch (e) { out.error = String(e).slice(0, 400); }
  });
  if (url.searchParams.get("sync") === "1") {
    const { data } = await db().from("shops").select("*").eq("myshopify_domain", store).single();
    if (data) out.sync = await firstLoad({ ...data, vat_rate: Number(data.vat_rate) } as Shop);
  }
  return Response.json(out);
}
