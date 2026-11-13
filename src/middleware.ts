import { NextResponse, type NextRequest } from "next/server";

// Phase 1: the dashboard is private to the store owner, protected by a username and password.
// Phase 3 replaces this with Shopify sign-in.
// Public website hosts: served from /site with no login.
const PUBLIC_HOSTS = new Set(["margewise.io", "www.margewise.io"]);

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const path = req.nextUrl.pathname;
  if (PUBLIC_HOSTS.has(host)) {
    if (path.startsWith("/site")) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = path === "/" ? "/site" : `/site${path}`;
    return NextResponse.rewrite(url);
  }
  // The website pages are public on any host (useful for previews).
  if (path === "/site" || path.startsWith("/site/")) return NextResponse.next();

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

export const config = { matcher: ["/((?!api/cron|api/backfill|api/diag|_next/static|_next/image|favicon.ico).*)"] };
