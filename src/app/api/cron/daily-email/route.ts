import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/auth";
import { sendDueReports } from "@/lib/daily-email";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Runs on a schedule; each store gets yesterday's profit once its own morning (07:00 local) arrives.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ results: await sendDueReports() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
