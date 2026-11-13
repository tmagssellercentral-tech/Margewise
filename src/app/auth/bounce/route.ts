// Inside the Shopify admin, a page request without a fresh session token lands here. App Bridge
// fetches a new token and reloads the page it was going to (the `shopify-reload` address) with it.
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function GET() {
  const key = process.env.SHOPIFY_APP_CLIENT_ID ?? "";
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="shopify-api-key" content="${esc(key)}">
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
<title>Margewise</title></head><body></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
