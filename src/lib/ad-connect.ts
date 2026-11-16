// Ad platforms an App Store store connects itself (its own sign-in, stored in ad_connections).
import type { Shop } from "./db";
import type { CampaignDay } from "./meta";
import { storeMetaFetcher } from "./meta-connect";
import { storeGoogleFetcher } from "./google-connect";
import { storeTikTokFetcher } from "./tiktok-connect";

export const STORE_PLATFORMS = ["meta", "google", "tiktok"] as const;
export type StorePlatform = (typeof STORE_PLATFORMS)[number];
export const isStorePlatform = (p: string): p is StorePlatform => (STORE_PLATFORMS as readonly string[]).includes(p);

export const storeFetchers: Record<StorePlatform, (shop: Shop) => Promise<null | ((from: string, to: string) => Promise<CampaignDay[]>)>> = {
  meta: storeMetaFetcher,
  google: storeGoogleFetcher,
  tiktok: storeTikTokFetcher,
};
