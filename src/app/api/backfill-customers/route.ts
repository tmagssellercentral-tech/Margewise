import { cronAuthorized } from "@/lib/auth";
import { getShop } from "@/lib/db";
import { syncCustomerHistory } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Owner-only: loads all-time order history (anonymous customer numbers). Call again until done. */
export async function GET(req: Request) {
  if (!cronAuthorized(req, true)) return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(await syncCustomerHistory(await getShop()));
  } catch (e) {
    return Response.json({ error: String(e).slice(0, 500) }, { status: 502 });
  }
}
