import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CourierRule, FeeRule, FixedCost, FixedCostFrequency, ShopConfig } from "./engine";

let client: SupabaseClient | null = null;

/** Server-only client. Uses the service role key, so it must never reach the browser. */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export interface Shop {
  id: string;
  shop_domain: string;
  name: string;
  currency: string;
  timezone: string;
  vat_registered: boolean;
  vat_rate: number;
  prices_include_vat: boolean;
  country: string;
  tax_mode: "rate" | "shopify";
  myshopify_domain?: string | null;
  is_owner?: boolean;
}

export const OWNER_DOMAIN = () => process.env.SHOP_DOMAIN ?? "fleximuscles.co.za";

/**
 * The store this request is for. Inside the Shopify admin, middleware has verified the session
 * token and passed the store on; the store is installed on first open. Everywhere else (the
 * owner's password-protected dashboard, cron jobs) it's the owner store.
 */
export async function getShop(domain?: string): Promise<Shop> {
  if (!domain) {
    const embedded = await embeddedStore();
    if (embedded) {
      if (embedded.store === process.env.OWNER_MYSHOPIFY_DOMAIN) return getShop(OWNER_DOMAIN());
      const { shop, isNew } = await installOnce(embedded.store, embedded.idToken);
      if (isNew) {
        const { firstLoad } = await import("./onboarding");
        const { after } = await import("next/server");
        after(() => firstLoad(shop));
      }
      return shop;
    }
  }
  domain ??= OWNER_DOMAIN();
  const { data, error } = await db().from("shops").select("*").eq("shop_domain", domain).single();
  if (error) throw new Error(`Shop ${domain} not found: ${error.message}`);
  return { ...data, vat_rate: Number(data.vat_rate) } as Shop;
}

export async function loadConfig(shop: Shop): Promise<{
  config: ShopConfig;
  rules: FeeRule[];
  bulky: Set<string>;
  costOverrides: Map<string, number>;
  fixedCosts: FixedCost[];
}> {
  const [s, r, p, cr, fc] = await Promise.all([
    db().from("shop_settings").select("*").eq("shop_id", shop.id).single(),
    db().from("payment_fee_rules").select("*").eq("shop_id", shop.id),
    db().from("product_settings").select("*").eq("shop_id", shop.id),
    db().from("courier_rules").select("*").eq("shop_id", shop.id),
    db().from("fixed_costs").select("*").eq("shop_id", shop.id),
  ]);
  for (const q of [s, r, p, cr, fc]) if (q.error) throw new Error(q.error.message);
  const n = (v: unknown) => Number(v ?? 0);
  return {
    config: {
      vatRegistered: shop.vat_registered,
      vatRate: shop.vat_rate,
      pricesIncludeVat: shop.prices_include_vat,
      packagingPerOrder: n(s.data.packaging_per_order),
      fulfilmentPerOrder: n(s.data.fulfilment_per_order),
      returnHandlingPerOrder: n(s.data.return_handling_per_order),
      courierStandard: n(s.data.courier_standard),
      courierBulky: n(s.data.courier_bulky),
      courierReturnStandard: n(s.data.courier_return_standard),
      courierReturnBulky: n(s.data.courier_return_bulky),
      adSpendIncludesVat: Boolean(s.data.ad_spend_includes_vat),
      taxMode: shop.tax_mode,
      shopifyTxnFeePct: n(s.data.shopify_txn_fee_pct),
      country: shop.country,
      courierRules: (cr.data ?? []).map(
        (x): CourierRule => ({ zone: x.zone, parcelSize: x.parcel_size, cost: n(x.cost), returnCost: n(x.return_cost) }),
      ),
    },
    rules: (r.data ?? []).map((x) => ({
      gatewayMatch: x.gateway_match,
      pct: n(x.pct),
      fixedFee: n(x.fixed_fee),
      minFee: n(x.min_fee),
      maxFee: x.max_fee != null ? n(x.max_fee) : null,
    })),
    bulky: new Set((p.data ?? []).filter((x) => x.parcel_size === "bulky").map((x) => x.sku)),
    costOverrides: new Map(
      (p.data ?? []).filter((x) => x.cost_override != null).map((x) => [x.sku, n(x.cost_override)]),
    ),
    fixedCosts: (fc.data ?? []).map(
      (x): FixedCost => ({
        name: x.name,
        category: x.category,
        amount: n(x.amount),
        frequency: x.frequency as FixedCostFrequency,
        startDate: x.start_date,
        endDate: x.end_date,
        vatClaimable: Boolean(x.vat_claimable),
      }),
    ),
  };
}

// One install check per request, even though many components ask for the shop.
const installOnce = cache(async (store: string, idToken: string) => {
  const { ensureInstalled } = await import("./shopify-app");
  return ensureInstalled(store, idToken);
});

/** The verified store and session token passed on by middleware, or null outside the Shopify admin. */
async function embeddedStore(): Promise<{ store: string; idToken: string } | null> {
  let h: Headers;
  try {
    const { headers } = await import("next/headers");
    h = (await headers()) as unknown as Headers;
  } catch {
    return null; // not inside a request (cron, scripts)
  }
  const store = h.get("x-mw-shop");
  const idToken = h.get("x-mw-idtoken");
  if (!store || !idToken) return null;
  // Checked again here, so a route the middleware doesn't cover can't be handed a store.
  const { verifySessionToken } = await import("./session-token");
  const claims = await verifySessionToken(idToken, process.env.SHOPIFY_APP_CLIENT_ID ?? "", process.env.SHOPIFY_APP_CLIENT_SECRET ?? "");
  if (!claims || claims.shop !== store) throw new Error("Invalid Shopify session");
  return { store, idToken };
}
