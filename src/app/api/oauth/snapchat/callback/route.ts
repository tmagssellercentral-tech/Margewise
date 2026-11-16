import { after } from "next/server";
import { readState } from "@/lib/meta-connect";
import { completeSnapchatConnection } from "@/lib/snapchat-connect";
import { backToSettings, loadConnectedSpend, resultPage as page } from "@/lib/oauth-page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Snapchat sends the store back here after it approves read-only access to its ad accounts. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopId = readState(url.searchParams.get("state"));
  if (!shopId) return page("This link has expired", "Go back to Margewise and click Connect Snapchat again.");
  const back = await backToSettings(shopId);
  if (url.searchParams.get("error")) return page("Snapchat wasn't connected", "You cancelled the Snapchat sign-in, so nothing was connected.", back);
  const code = url.searchParams.get("code");
  if (!code) return page("Snapchat wasn't connected", "Snapchat didn't return a sign-in code. Please try again.", back);
  try {
    const r = await completeSnapchatConnection(shopId, code);
    if (r.chosen) after(() => loadConnectedSpend(shopId, "snapchat").catch((e) => console.error("snapchat first load", e)));
    const msg = r.accounts === 0
      ? "You're signed in, but this Snapchat account has no ad accounts. Sign in with the Snapchat account that manages your Snapchat Ads."
      : r.chosen ? "Your Snapchat ad account is connected. Margewise will load your Snapchat spend shortly; you can close this tab."
      : `Found ${r.accounts} Snapchat ad accounts. Go back to Margewise and choose which ones belong to this store.`;
    return page("Snapchat connected", msg, back);
  } catch (e) {
    console.error("snapchat connect", e);
    return page("Snapchat wasn't connected", "Something went wrong while connecting. Please try again, or email support@margewise.io.", back);
  }
}
