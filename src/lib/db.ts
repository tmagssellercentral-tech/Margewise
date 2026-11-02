import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FeeRule, ShopConfig } from "./engine";

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
}> {
  const [s, r, p] = await Promise.all([
    db().from("shop_settings").select("*").eq("shop_id", shop.id).single(),
    db().from("payment_fee_rules").select("*").eq("shop_id", shop.id),
    db().from("product_settings").select("*").eq("shop_id", shop.id),
  ]);
  if (s.error) throw new Error(s.error.message);
  if (r.error) throw new Error(r.error.message);
  if (p.error) throw new Error(p.error.message);
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
  };
}
