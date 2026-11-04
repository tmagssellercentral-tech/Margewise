import { cronAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

const V = process.env.META_API_VERSION ?? "v23.0";

async function get(path: string, token: string) {
  const res = await fetch(`https://graph.facebook.com/${V}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Owner-only diagnostic: asks Meta about the token's own state. Never returns the token. */
export async function GET(req: Request) {
  if (!cronAuthorized(req, true)) return new Response("Unauthorized", { status: 401 });
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "META_ACCESS_TOKEN not set" });
  const acct = (process.env.META_AD_ACCOUNT_IDS ?? "").split(",")[0]?.trim();
  const [debug, me, account] = await Promise.all([
    get(`debug_token?input_token=${encodeURIComponent(token)}`, token),
    get("me?fields=id,name", token),
    acct ? get(`act_${acct}?fields=name,account_status,disable_reason`, token) : Promise.resolve(null),
  ]);
  return Response.json({ debug, me, account });
}
