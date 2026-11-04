"use server";

// Settings writes. Every action resolves the shop on the server (never from the form),
// validates input, then recomputes recent daily results so reports pick up the change.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, getShop } from "@/lib/db";
import { recompute } from "@/lib/sync";
import { addDays, isYmd, localDate } from "@/lib/dates";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, fallback = 0) => {
  const v = Number(str(f, k).replace(/[\s,]/g, ""));
  return Number.isFinite(v) ? v : fallback;
};
const optNum = (f: FormData, k: string) => (str(f, k) === "" ? null : num(f, k));
const bool = (f: FormData, k: string) => f.get(k) === "on";

async function done(paths: string[] = ["/settings", "/", "/orders"]) {
  const shop = await getShop();
  const today = localDate(new Date(), shop.timezone);
  // Keep stored daily results (used by reports) in line with the new settings.
  await recompute(shop, addDays(today, -120), today);
  for (const p of paths) revalidatePath(p);
}

async function must<T extends { error: { message: string } | null }>(q: PromiseLike<T>) {
  const r = await q;
  if (r.error) throw new Error(r.error.message);
  return r;
}

async function _saveStore(f: FormData) {
  const shop = await getShop();
  const country = str(f, "country").toUpperCase();
  const currency = str(f, "currency").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error("Country must be a 2-letter code, e.g. ZA, US, GB");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a 3-letter code, e.g. ZAR, USD");
  const mode = str(f, "tax_mode") === "shopify" ? "shopify" : "rate";
  await must(
    db().from("shops").update({
      name: str(f, "name") || shop.name,
      country,
      currency,
      timezone: str(f, "timezone") || shop.timezone,
      tax_mode: mode,
      vat_registered: bool(f, "vat_registered"),
      vat_rate: num(f, "vat_rate") / 100,
      prices_include_vat: bool(f, "prices_include_vat"),
    }).eq("id", shop.id),
  );
  await must(
    db().from("shop_settings").update({ ad_spend_includes_vat: bool(f, "ad_spend_includes_vat"), updated_at: new Date().toISOString() }).eq("shop_id", shop.id),
  );
  await done();
}

async function _saveFeeRule(f: FormData) {
  const shop = await getShop();
  const row = {
    shop_id: shop.id,
    gateway_match: str(f, "gateway_match"),
    pct: num(f, "pct") / 100,
    fixed_fee: num(f, "fixed_fee"),
    min_fee: num(f, "min_fee"),
    note: str(f, "note") || null,
  };
  if (!row.gateway_match) throw new Error("Enter the payment method name as it appears on Shopify orders");
  const id = str(f, "id");
  if (id) await must(db().from("payment_fee_rules").update(row).eq("id", id).eq("shop_id", shop.id));
  else await must(db().from("payment_fee_rules").insert(row));
  await done();
}

async function _deleteFeeRule(f: FormData) {
  const shop = await getShop();
  await must(db().from("payment_fee_rules").delete().eq("id", str(f, "id")).eq("shop_id", shop.id));
  await done();
}

async function _saveShipping(f: FormData) {
  const shop = await getShop();
  await must(
    db().from("shop_settings").update({
      packaging_per_order: num(f, "packaging_per_order"),
      fulfilment_per_order: num(f, "fulfilment_per_order"),
      return_handling_per_order: num(f, "return_handling_per_order"),
      courier_standard: num(f, "courier_standard"),
      courier_bulky: num(f, "courier_bulky"),
      courier_return_standard: num(f, "courier_return_standard"),
      courier_return_bulky: num(f, "courier_return_bulky"),
      updated_at: new Date().toISOString(),
    }).eq("shop_id", shop.id),
  );
  await done();
}

async function _saveCourierRule(f: FormData) {
  const shop = await getShop();
  const zone = str(f, "zone");
  const z = /^(domestic|international)$/i.test(zone) ? zone.toLowerCase() : zone.toUpperCase();
  if (!/^(domestic|international|[A-Z]{2})$/.test(z)) throw new Error("Zone must be domestic, international or a 2-letter country code");
  const row = {
    shop_id: shop.id,
    zone: z,
    parcel_size: str(f, "parcel_size") === "bulky" ? "bulky" : "standard",
    cost: num(f, "cost"),
    return_cost: num(f, "return_cost"),
    courier: str(f, "courier") || null,
  };
  await must(db().from("courier_rules").upsert(row, { onConflict: "shop_id,zone,parcel_size" }));
  await done();
}

async function _deleteCourierRule(f: FormData) {
  const shop = await getShop();
  await must(db().from("courier_rules").delete().eq("id", str(f, "id")).eq("shop_id", shop.id));
  await done();
}

async function _saveProduct(f: FormData) {
  const shop = await getShop();
  const sku = str(f, "sku");
  if (!sku) throw new Error("Missing SKU");
  await must(
    db().from("product_settings").upsert(
      { shop_id: shop.id, sku, parcel_size: str(f, "parcel_size") === "bulky" ? "bulky" : "standard", cost_override: optNum(f, "cost_override") },
      { onConflict: "shop_id,sku" },
    ),
  );
  await done();
}

const FREQ = new Set(["daily", "weekly", "monthly", "yearly", "once"]);

async function _saveFixedCost(f: FormData) {
  const shop = await getShop();
  const start = str(f, "start_date");
  const end = str(f, "end_date");
  if (!isYmd(start)) throw new Error("Pick a start date");
  if (end && (!isYmd(end) || end < start)) throw new Error("End date must be on or after the start date");
  const frequency = str(f, "frequency");
  const row = {
    shop_id: shop.id,
    name: str(f, "name"),
    category: str(f, "category") || "other",
    amount: num(f, "amount"),
    frequency: FREQ.has(frequency) ? frequency : "monthly",
    start_date: start,
    end_date: end || null,
    vat_claimable: bool(f, "vat_claimable"),
  };
  if (!row.name) throw new Error("Give the cost a name");
  const id = str(f, "id");
  if (id) await must(db().from("fixed_costs").update(row).eq("id", id).eq("shop_id", shop.id));
  else await must(db().from("fixed_costs").insert(row));
  await done();
}

async function _deleteFixedCost(f: FormData) {
  const shop = await getShop();
  await must(db().from("fixed_costs").delete().eq("id", str(f, "id")).eq("shop_id", shop.id));
  await done();
}

const RETURN = new Set(["none", "returned_restocked", "returned_written_off", "failed_delivery"]);

async function _saveOrder(f: FormData) {
  const shop = await getShop();
  const status = str(f, "return_status");
  await must(
    db().from("orders").update({
      return_status: RETURN.has(status) ? status : "none",
      actual_courier: optNum(f, "actual_courier"),
    }).eq("id", str(f, "id")).eq("shop_id", shop.id),
  );
  await done(["/orders", "/"]);
}

/** Runs a write, then returns to where the form was, with a saved or error message. */
async function run(f: FormData, fn: (f: FormData) => Promise<void>, tab: string | null) {
  let error: string | null = null;
  try {
    await fn(f);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const back = str(f, "back");
  const base = back.startsWith("/") && !back.startsWith("//") ? back : tab ? `/settings?tab=${tab}` : "/settings";
  const sep = base.includes("?") ? "&" : "?";
  redirect(`${base}${sep}${error ? `error=${encodeURIComponent(error.slice(0, 200))}` : "saved=1"}`);
}

export async function saveStore(f: FormData) {
  await run(f, _saveStore, "store");
}

export async function saveFeeRule(f: FormData) {
  await run(f, _saveFeeRule, "fees");
}

export async function deleteFeeRule(f: FormData) {
  await run(f, _deleteFeeRule, "fees");
}

export async function saveShipping(f: FormData) {
  await run(f, _saveShipping, "shipping");
}

export async function saveCourierRule(f: FormData) {
  await run(f, _saveCourierRule, "shipping");
}

export async function deleteCourierRule(f: FormData) {
  await run(f, _deleteCourierRule, "shipping");
}

export async function saveProduct(f: FormData) {
  await run(f, _saveProduct, "products");
}

export async function saveFixedCost(f: FormData) {
  await run(f, _saveFixedCost, "fixed");
}

export async function deleteFixedCost(f: FormData) {
  await run(f, _deleteFixedCost, "fixed");
}

export async function saveOrder(f: FormData) {
  await run(f, _saveOrder, null);
}
