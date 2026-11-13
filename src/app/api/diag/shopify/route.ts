import { cronAuthorized } from "@/lib/auth";
import { gql } from "@/lib/shopify";

export const dynamic = "force-dynamic";

/** Owner-only check of what customer data the Shopify connection can read. Returns no personal data. */
export async function GET(req: Request) {
  if (!cronAuthorized(req, true)) return new Response("Unauthorized", { status: 401 });
  const out: Record<string, unknown> = {};
  try {
    const d = await gql<{ currentAppInstallation: { accessScopes: { handle: string }[] } }>("{ currentAppInstallation { accessScopes { handle } } }", {});
    out.scopes = d.currentAppInstallation.accessScopes.map((s) => s.handle);
  } catch (e) { out.scopesError = String(e).slice(0, 300); }
  try {
    const d = await gql<{ orders: { nodes: { customer: { id: string; numberOfOrders: string } | null }[] } }>(
      "{ orders(first: 5, sortKey: CREATED_AT, reverse: true) { nodes { customer { id numberOfOrders } } } }", {});
    out.customerAccess = "ok";
    out.sample = d.orders.nodes.map((n) => (n.customer ? { hasCustomer: true, numberOfOrders: n.customer.numberOfOrders } : { hasCustomer: false }));
  } catch (e) { out.customerAccess = String(e).slice(0, 400); }
  try {
    const d = await gql<{ ordersCount: { count: number; precision: string } }>("{ ordersCount(limit: 100000) { count precision } }", {});
    out.allTimeOrders = d.ordersCount;
  } catch (e) { out.countError = String(e).slice(0, 300); }
  return Response.json(out);
}
