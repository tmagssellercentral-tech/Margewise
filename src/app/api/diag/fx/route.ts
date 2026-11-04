import { cronAuthorized } from "@/lib/auth";
import { dailyRates } from "@/lib/fx";

export const dynamic = "force-dynamic";

/** Owner-only check that exchange rates are reachable: /api/diag/fx?from=USD&to=ZAR&start=…&end=… */
export async function GET(req: Request) {
  if (!cronAuthorized(req, true)) return new Response("Unauthorized", { status: 401 });
  const u = new URL(req.url).searchParams;
  try {
    const m = await dailyRates(u.get("from") ?? "USD", u.get("to") ?? "ZAR", u.get("start") ?? "2026-10-01", u.get("end") ?? "2026-10-07");
    return Response.json(Object.fromEntries(m));
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
