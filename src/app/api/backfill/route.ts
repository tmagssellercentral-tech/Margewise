import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/auth";
import { runSync } from "@/lib/sync";
import { isYmd } from "@/lib/dates";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// One-off history load: /api/backfill?from=2026-09-01&to=2026-09-30
export async function GET(req: Request) {
  if (!cronAuthorized(req, true)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const u = new URL(req.url);
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  if (!isYmd(from) || !isYmd(to) || from > to) return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  const result = await runSync(from, to);
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
