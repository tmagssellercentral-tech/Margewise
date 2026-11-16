import { after } from "next/server";
import { readState } from "@/lib/meta-connect";
import { completeTikTokConnection } from "@/lib/tiktok-connect";
import { backToSettings, loadConnectedSpend, resultPage as page } from "@/lib/oauth-page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** TikTok sends the store back here after it approves access to its advertiser accounts. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopId = readState(url.searchParams.get("state"));
  if (!shopId) return page("This link has expired", "Go back to Margewise and click Connect TikTok again.");
  const back = await backToSettings(shopId);
  const code = url.searchParams.get("auth_code") ?? url.searchParams.get("code");
  if (!code) return page("TikTok wasn't connected", "You cancelled the TikTok sign-in, so nothing was connected.", back);
  try {
    const r = await completeTikTokConnection(shopId, code);
    if (r.chosen) after(() => loadConnectedSpend(shopId, "tiktok").catch((e) => console.error("tiktok first load", e)));
    const msg = r.accounts === 0
      ? "You're signed in, but no TikTok ad accounts were shared. Connect again and tick the ad accounts that advertise your store."
      : r.chosen ? "Your TikTok ad account is connected. Margewise will load your TikTok spend shortly; you can close this tab."
      : `Found ${r.accounts} TikTok ad accounts. Go back to Margewise and choose which ones belong to this store.`;
    return page("TikTok connected", msg, back);
  } catch (e) {
    console.error("tiktok connect", e);
    return page("TikTok wasn't connected", "Something went wrong while connecting. Please try again, or email support@margewise.io.", back);
  }
}
