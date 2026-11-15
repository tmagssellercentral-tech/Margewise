import { readState } from "@/lib/meta-connect";
import { completeGoogleConnection } from "@/lib/google-connect";
import { backToSettings, resultPage as page } from "@/lib/oauth-page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Google sends the store back here after it approves access to its Google Ads reports. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopId = readState(url.searchParams.get("state"));
  if (!shopId) return page("This link has expired", "Go back to Margewise and click Connect Google Ads again.");
  const back = await backToSettings(shopId);
  if (url.searchParams.get("error")) return page("Google Ads wasn't connected", "You cancelled the Google sign-in, so nothing was connected.", back);
  const code = url.searchParams.get("code");
  if (!code) return page("Google Ads wasn't connected", "Google didn't return a sign-in code. Please try again.", back);
  try {
    const r = await completeGoogleConnection(shopId, code);
    const msg = r.accounts === 0
      ? "You're signed in, but this Google account has no Google Ads accounts. Sign in with the Google account that manages your ads."
      : r.chosen ? "Your Google Ads account is connected. Margewise will load your Google Ads spend shortly; you can close this tab."
      : `Found ${r.accounts} Google Ads accounts. Go back to Margewise and choose which ones belong to this store.`;
    return page("Google Ads connected", msg, back);
  } catch (e) {
    console.error("google connect", e);
    if (String(e).includes("NO_SCOPE"))
      return page("Google Ads wasn't connected", "Please tick the box that allows Margewise to see your Google Ads data, then try again.", back);
    return page("Google Ads wasn't connected", "Something went wrong while connecting. Please try again, or email support@margewise.io.", back);
  }
}
