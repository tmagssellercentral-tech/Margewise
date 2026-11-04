// Ad platforms Margewise knows about: connectors pull spend nightly; the rest arrive by CSV
// upload or manual entry. `env` lists the Vercel variables a connector needs.

export interface PlatformInfo {
  key: string;
  name: string;
  kind: "connector" | "upload";
  env?: string[];
  note?: string;
}

export const PLATFORMS: PlatformInfo[] = [
  { key: "meta", name: "Meta (Facebook & Instagram)", kind: "connector", env: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_IDS"] },
  { key: "google", name: "Google Ads", kind: "connector", env: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_ADS_CUSTOMER_IDS"] },
  { key: "tiktok", name: "TikTok Ads", kind: "connector", env: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_ADVERTISER_IDS"] },
  { key: "pinterest", name: "Pinterest Ads", kind: "connector", env: ["PINTEREST_CLIENT_ID", "PINTEREST_CLIENT_SECRET", "PINTEREST_REFRESH_TOKEN", "PINTEREST_AD_ACCOUNT_IDS"], note: "Reports days in UTC." },
  { key: "snapchat", name: "Snapchat Ads", kind: "connector", env: ["SNAPCHAT_CLIENT_ID", "SNAPCHAT_CLIENT_SECRET", "SNAPCHAT_REFRESH_TOKEN", "SNAPCHAT_AD_ACCOUNT_IDS"] },
  { key: "microsoft", name: "Microsoft Advertising (Bing)", kind: "upload", note: "Export a daily campaign report as CSV and upload it." },
  { key: "x", name: "X (Twitter) Ads", kind: "upload", note: "X restricts its Ads API, so export a daily campaign report as CSV instead." },
  { key: "influencer", name: "Influencers & sponsorships", kind: "upload", note: "Enter payments manually on the day they ran." },
];

export const platformName = (key: string) => PLATFORMS.find((p) => p.key === key)?.name.split(" (")[0] ?? key.replace(/_/g, " ");

export const isConfigured = (p: PlatformInfo) => (p.env ?? []).every((k) => Boolean(process.env[k]));
