// Data loading for stores that installed Margewise from the App Store. They sync Shopify only:
// the owner's ad connections come from the environment and must never be applied to them.
// (Per-store ad connections arrive with in-app sign-in to each ad platform.)

import { db, type Shop } from "./db";
import { addDays, localDate } from "./dates";
import { credentialsFor } from "./shopify-app";
import { runForStore } from "./shop-context";
import { recompute, syncCustomerHistory, syncShopify } from "./sync";

export const FIRST_LOAD_DAYS = 60;

async function syncStore(shop: Shop, from: string, to: string, withHistory: boolean) {
  const store = shop.myshopify_domain;
  if (!store) throw new Error(`${shop.name} has no Shopify address`);
  return runForStore(credentialsFor(store), async () => {
    const out: Record<string, unknown> = {};
    const errors: string[] = [];
    try { out.shopify = await syncShopify(shop, new Date(`${from}T00:00:00Z`).toISOString()); } catch (e) { errors.push(`shopify: ${e}`); }
    if (withHistory) {
      try { out.history = await syncCustomerHistory(shop, 120_000); } catch (e) { errors.push(`history: ${e}`); }
    }
    try { out.recompute = await recompute(shop, from, to); } catch (e) { errors.push(`recompute: ${e}`); }
    return { store, ...out, errors };
  });
}

/** Right after install: the last 60 days of orders, then customer history as far as time allows. */
export function firstLoad(shop: Shop) {
  const today = localDate(new Date(), shop.timezone);
  return syncStore(shop, addDays(today, -FIRST_LOAD_DAYS), today, true).catch((e) => ({ errors: [String(e)] }));
}

/** Nightly: every installed store, last 3 days (late refunds and cancellations), plus history catch-up. */
export async function syncInstalledStores(budgetMs = 200_000) {
  const started = Date.now();
  const { data, error } = await db()
    .from("shops")
    .select("*")
    .eq("is_owner", false)
    .is("uninstalled_at", null)
    .not("access_token_enc", "is", null)
    .order("installed_at");
  if (error) throw new Error(error.message);
  const results = [];
  for (const row of data ?? []) {
    if (Date.now() - started > budgetMs) { results.push({ store: row.myshopify_domain, skipped: "out of time" }); continue; }
    const shop = { ...row, vat_rate: Number(row.vat_rate) } as Shop;
    const today = localDate(new Date(), shop.timezone);
    results.push(await syncStore(shop, addDays(today, -3), today, true));
  }
  return results;
}

/**
 * App Store stores have no live order feed yet, so opening Margewise refreshes the last two days
 * in the background when the last Shopify sync is more than 5 minutes old. Order webhooks
 * trigger the same refresh as soon as an order is placed, changed or refunded.
 */
export async function refreshIfStale(shop: Shop, maxAgeMs = 5 * 60_000) {
  const { data } = await db().from("sync_runs").select("started_at").eq("shop_id", shop.id).eq("kind", "shopify")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (data && Date.now() - Date.parse(data.started_at) < maxAgeMs) return null;
  const today = localDate(new Date(), shop.timezone);
  return syncStore(shop, addDays(today, -2), today, false);
}
