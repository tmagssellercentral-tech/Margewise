import { NextResponse, type NextRequest } from "next/server";

// Phase 1: the dashboard is private to the store owner, protected by a username and password.
// Phase 3 replaces this with Shopify sign-in.
export function middleware(req: NextRequest) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!user || !pass) return new NextResponse("Dashboard login is not configured", { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [u, ...rest] = atob(encoded).split(":");
    if (u === user && rest.join(":") === pass) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Margewise", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/((?!api/cron|api/backfill|_next/static|_next/image|favicon.ico).*)"] };
