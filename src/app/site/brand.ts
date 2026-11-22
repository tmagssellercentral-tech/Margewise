export const COMPANY = "Flexi Muscles LLC";
export const SUPPORT = "support@margewise.io";
export const SITE = "https://margewise.io";

/**
 * The Shopify App Store listing. Leave null until the listing is public: every "get started"
 * button then asks for early access by email instead.
 */
export const APP_STORE_URL: string | null = null;

export const cta = APP_STORE_URL
  ? { href: APP_STORE_URL, label: "Install free on Shopify", note: "14-day free trial on paid plans" }
  : { href: `mailto:${SUPPORT}?subject=Margewise%20early%20access&body=Store%20address%3A%20`, label: "Get early access", note: "Launching on the Shopify App Store" };

/**
 * Where affiliates sign up. Null until the affiliate platform is chosen: the Apply buttons then
 * open an email to support with the details we need.
 */
export const AFFILIATE_SIGNUP_URL: string | null = null;
export const affiliateApply = AFFILIATE_SIGNUP_URL ?? `mailto:${SUPPORT}?subject=Margewise%20affiliate%20application&body=Name%3A%20%0AWebsite%20or%20social%20profile%3A%20%0AHow%20you%20plan%20to%20promote%20Margewise%3A%20%0ACountry%3A%20`;
