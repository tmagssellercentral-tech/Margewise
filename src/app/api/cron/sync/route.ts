import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/auth";
import { runSync } from "@/lib/sync";
import { addDays, localDate } from "@/lib/dates";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Nightly: re-pull the last 3 days so late refunds, cancellations and Meta's
// delayed attribution are picked up, then recompute.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const today = localDate(new Date(), process.env.SHOP_TIMEZONE ?? "Africa/Johannesburg");
  const result = await runSync(addDays(today, -3), today);
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
