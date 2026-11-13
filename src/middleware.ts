import { NextResponse, type NextRequest } from "next/server";
import { isShopDomain, verifySessionToken } from "@/lib/session-token";

// Three ways in:
// 1. margewise.io (the public website): served from /site, no login.
// 2. app.margewise.io (the app inside the Shopify admin): every request carries a Shopify session
//    token, checked here; the verified store is passed on to the page in a request header.
// 3. Any other host (margewise.vercel.app): the owner's dashboard, behind a username and password.
const PUBLIC_HOSTS = new Set(["margewise.io", "www.margewise.io"]);
const EMBEDDED_HOSTS = new Set((process.env.EMBEDDED_HOSTS ?? "app.margewise.io").split(",").map((h) => h.trim()).filter(Boolean));
const INTERNAL = ["x-mw-shop", "x-mw-idtoken"];

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const path = req.nextUrl.pathname;

  // Never trust these from outside; only this middleware sets them.
  const headers = new Headers(req.headers);
  for (const h of INTERNAL) headers.delete(h);

  if (PUBLIC_HOSTS.has(host)) {
    if (path.startsWith("/site")) return NextResponse.next({ request: { headers } });
    const url = req.nextUrl.clone();
    url.pathname = path === "/" ? "/site" : `/site${path}`;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  // The website pages are public on any host (useful for previews).
  if (path === "/site" || path.startsWith("/site/")) return NextResponse.next({ request: { headers } });

  if (EMBEDDED_HOSTS.has(host)) return embedded(req, headers);

  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!user || !pass) return new NextResponse("Dashboard login is not configured", { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [u, ...rest] = atob(encoded).split(":");
    if (u === user && rest.join(":") === pass) return NextResponse.next({ request: { headers } });
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Margewise", charset="UTF-8"' },
  });
}

/** Only the store's own admin may frame the app. */
function frameHeaders(res: NextResponse, shop: string | null) {
  const ancestors = shop && isShopDomain(shop) ? `https://${shop} https://admin.shopify.com` : "https://admin.shopify.com";
  res.headers.set("Content-Security-Policy", `frame-ancestors ${ancestors};`);
  return res;
}

async function embedded(req: NextRequest, headers: Headers) {
  const url = req.nextUrl;
  const shopParam = url.searchParams.get("shop");
  if (url.pathname === "/auth/bounce") return frameHeaders(NextResponse.next({ request: { headers } }), shopParam);

  const clientId = process.env.SHOPIFY_APP_CLIENT_ID;
  const secret = process.env.SHOPIFY_APP_CLIENT_SECRET;
  if (!clientId || !secret) return new NextResponse("The Shopify app is not configured yet", { status: 503 });

  const bearer = (req.headers.get("authorization") ?? "").match(/^Bearer (.+)$/)?.[1];
  const token = bearer ?? url.searchParams.get("id_token");
  const claims = token ? await verifySessionToken(token, clientId, secret) : null;

  if (!claims) {
    // Page loads: let App Bridge fetch a fresh token and come back. Data requests: ask it to retry.
    const isPage = req.method === "GET" && (req.headers.get("accept") ?? "").includes("text/html") && !bearer;
    if (isPage) {
      const back = url.clone();
      back.searchParams.delete("id_token");
      const bounce = new URL("/auth/bounce", url);
      for (const k of ["shop", "host", "embedded"]) {
        const v = url.searchParams.get(k);
        if (v) bounce.searchParams.set(k, v);
      }
      bounce.searchParams.set("shopify-reload", back.pathname + back.search);
      return frameHeaders(NextResponse.redirect(bounce), shopParam);
    }
    return new NextResponse("Session expired", { status: 401, headers: { "X-Shopify-Retry-Invalid-Session-Request": "1" } });
  }

  headers.set("x-mw-shop", claims.shop);
  headers.set("x-mw-idtoken", token!);
  return frameHeaders(NextResponse.next({ request: { headers } }), claims.shop);
}

export const config = { matcher: ["/((?!api/cron|api/backfill|api/diag|api/webhooks|_next/static|_next/image|favicon.ico).*)"] };
