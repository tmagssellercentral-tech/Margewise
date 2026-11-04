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
}

export async function getShop(domain = process.env.SHOP_DOMAIN ?? "fleximuscles.co.za"): Promise<Shop> {
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
