import { completeMetaConnection, readState } from "@/lib/meta-connect";
import { after } from "next/server";
import { backToSettings, loadConnectedSpend, resultPage as page } from "@/lib/oauth-page";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Facebook sends the store back here after it approves read-only access to its ad accounts. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopId = readState(url.searchParams.get("state"));
  if (!shopId) return page("This link has expired", "Go back to Margewise and click Connect Meta again.");
  const back = await backToSettings(shopId);
  if (url.searchParams.get("error")) return page("Meta wasn't connected", "You cancelled the Facebook sign-in, so nothing was connected.", back);
  const code = url.searchParams.get("code");
  if (!code) return page("Meta wasn't connected", "Facebook didn't return a sign-in code. Please try again.", back);
  try {
    const r = await completeMetaConnection(shopId, code);
    if (r.chosen) after(() => loadConnectedSpend(shopId, "meta").catch((e) => console.error("meta first load", e)));
    const msg = r.accounts === 0
      ? "You're signed in, but this Facebook profile has no ad accounts. Sign in with the profile that manages your ads."
      : r.chosen ? "Your ad account is connected. Margewise will load your Meta spend shortly; you can close this tab."
      : `Found ${r.accounts} ad accounts. Go back to Margewise and choose which ones belong to this store.`;
    return page("Meta connected", msg, back);
  } catch (e) {
    console.error("meta connect", e);
    return page("Meta wasn't connected", "Something went wrong while connecting. Please try again, or email support@margewise.io.", back);
  }
}
