import { after } from "next/server";
import { readState } from "@/lib/meta-connect";
import { completePinterestConnection } from "@/lib/pinterest-connect";
import { backToSettings, loadConnectedSpend, resultPage as page } from "@/lib/oauth-page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Pinterest sends the store back here after it approves read-only access to its ad accounts. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopId = readState(url.searchParams.get("state"));
  if (!shopId) return page("This link has expired", "Go back to Margewise and click Connect Pinterest again.");
  const back = await backToSettings(shopId);
  if (url.searchParams.get("error")) return page("Pinterest wasn't connected", "You cancelled the Pinterest sign-in, so nothing was connected.", back);
  const code = url.searchParams.get("code");
  if (!code) return page("Pinterest wasn't connected", "Pinterest didn't return a sign-in code. Please try again.", back);
  try {
    const r = await completePinterestConnection(shopId, code);
    if (r.chosen) after(() => loadConnectedSpend(shopId, "pinterest").catch((e) => console.error("pinterest first load", e)));
    const msg = r.accounts === 0
      ? "You're signed in, but this Pinterest account has no ad accounts. Sign in with the Pinterest business account that runs your ads."
      : r.chosen ? "Your Pinterest ad account is connected. Margewise will load your Pinterest spend shortly; you can close this tab."
      : `Found ${r.accounts} Pinterest ad accounts. Go back to Margewise and choose which ones belong to this store.`;
    return page("Pinterest connected", msg, back);
  } catch (e) {
    console.error("pinterest connect", e);
    return page("Pinterest wasn't connected", "Something went wrong while connecting. Please try again, or email support@margewise.io.", back);
  }
}
