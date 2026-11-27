// Temporary: reports this function's outbound IP so the Shopify IP allowlist can be set. Remove after setup.
export const dynamic = "force-dynamic";
export async function GET() {
  const r = await fetch("https://ipinfo.io/json", { cache: "no-store" });
  const j = await r.json();
  return Response.json({ ip: j.ip, org: j.org, country: j.country, region: process.env.VERCEL_REGION ?? null });
}
