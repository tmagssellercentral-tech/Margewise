import { db } from "@/lib/db";
import { readState } from "@/lib/meta-connect";
import { resultPage } from "@/lib/oauth-page";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// GET shows a confirm button (so link scanners in mail filters can't unsubscribe anyone);
// POST unsubscribes, which is also what mail apps send for one-click unsubscribe.
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  if (!readState(t)) return resultPage("Link expired", "This unsubscribe link has expired. Turn the daily email off in Margewise under Settings → Daily email.");
  return resultPage("Stop the daily profit email?",
    `The email will stop for every address on this store.</p><form method="post"><input type="hidden" name="t" value="${esc(t!)}"><button style="background:#0f6b4f;color:#fff;border:0;padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer">Unsubscribe</button></form><p>`);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let t = url.searchParams.get("t");
  if (!t) {
    const form = await req.formData().catch(() => null);
    t = form ? String(form.get("t") ?? "") : null;
  }
  const shopId = readState(t);
  if (!shopId) return resultPage("Link expired", "This unsubscribe link has expired. Turn the daily email off in Margewise under Settings → Daily email.");
  await db().from("email_reports").update({ enabled: false, updated_at: new Date().toISOString() }).eq("shop_id", shopId);
  return resultPage("Unsubscribed", "The daily profit email is off. You can turn it back on in Margewise under Settings → Daily email.");
}
