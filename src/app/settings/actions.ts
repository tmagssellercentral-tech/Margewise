"use server";

// Settings writes. Every action resolves the shop on the server (never from the form),
// validates input, then recomputes recent daily results so reports pick up the change.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, getShop } from "@/lib/db";
import { CSV_ACCOUNT, recompute } from "@/lib/sync";
import { courierRows, spendRows, type SpendRow } from "@/lib/csv";
import { dailyRates } from "@/lib/fx";
import { FEE_PRESETS } from "@/lib/fee-presets";
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
    max_fee: optNum(f, "max_fee"),
    note: str(f, "note") || null,
  };
  if (!row.gateway_match) throw new Error("Enter the payment method name as it appears on Shopify orders");
  const id = str(f, "id");
  if (id) await must(db().from("payment_fee_rules").update(row).eq("id", id).eq("shop_id", shop.id));
  else await must(db().from("payment_fee_rules").insert(row));
  await done();
}

async function _applyFeePreset(f: FormData) {
  const shop = await getShop();
  const pack = FEE_PRESETS.find((p) => p.key === str(f, "preset"));
  if (!pack) throw new Error("Pick a region");
  const { data: existing } = await must(db().from("payment_fee_rules").select("gateway_match").eq("shop_id", shop.id));
  const have = new Set(((existing ?? []) as { gateway_match: string }[]).map((r) => r.gateway_match.toLowerCase()));
  const add = pack.rules.filter((r) => !have.has(r.gatewayMatch.toLowerCase()));
  if (pack.currency !== shop.currency && add.some((r) => r.fixedFee || r.minFee || r.maxFee))
    throw new Error(`The ${pack.name} fixed fees are in ${pack.currency}, but your store sells in ${shop.currency}. Add these rules by hand in ${shop.currency} instead.`);
  if (add.length)
    await must(db().from("payment_fee_rules").insert(add.map((r) => ({
      shop_id: shop.id, gateway_match: r.gatewayMatch, pct: r.pct, fixed_fee: r.fixedFee, min_fee: r.minFee ?? 0, max_fee: r.maxFee ?? null, note: r.note,
    }))));
  await done();
}

async function _saveTxnFee(f: FormData) {
  const shop = await getShop();
  const pct = num(f, "shopify_txn_fee_pct");
  if (pct < 0 || pct > 5) throw new Error("Shopify's transaction fee is between 0% and 2%");
  await must(db().from("shop_settings").update({ shopify_txn_fee_pct: pct / 100, updated_at: new Date().toISOString() }).eq("shop_id", shop.id));
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

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "none";

/** Store uploaded or typed ad spend, converted to the store currency, merged per day and campaign. */
async function storeSpend(rows: SpendRow[]) {
  const shop = await getShop();
  if (rows.length === 0) throw new Error("No valid rows. Each row needs a date and a spend amount.");
  const dates = rows.map((r) => r.date).sort();
  const rates = new Map<string, Map<string, number>>();
  for (const c of new Set(rows.map((r) => r.currency ?? shop.currency)))
    if (c !== shop.currency) rates.set(c, await dailyRates(c, shop.currency, dates[0], dates[dates.length - 1]));
  const merged = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const ccy = r.currency ?? shop.currency;
    const fx = ccy === shop.currency ? 1 : rates.get(ccy)?.get(r.date);
    if (fx == null) throw new Error(`No ${ccy} exchange rate for ${r.date}`);
    const key = `${r.date}|${r.platform}|${slug(r.campaign)}`;
    const m = merged.get(key) ?? {
      shop_id: shop.id, date: r.date, platform: r.platform, account_id: CSV_ACCOUNT, campaign_id: slug(r.campaign),
      campaign_name: r.campaign, spend: 0, purchase_value: 0, currency: ccy, spend_original: 0, fx_rate: fx,
    };
    m.spend = Number(m.spend) + r.spend * fx;
    m.purchase_value = Number(m.purchase_value) + r.conversionValue * fx;
    m.spend_original = Number(m.spend_original) + r.spend;
    merged.set(key, m);
  }
  await must(db().from("ad_spend_daily").upsert([...merged.values()], { onConflict: "shop_id,date,platform,account_id,campaign_id" }));
}

async function _importSpendCsv(f: FormData) {
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a CSV file to upload");
  const { rows, skipped } = spendRows(await file.text());
  await storeSpend(rows);
  await done(); // recalculate before reporting skipped lines, since the good rows are saved
  if (skipped.length) throw new Error(`Imported ${rows.length} rows. Skipped line${skipped.length > 1 ? "s" : ""} ${skipped.slice(0, 10).join(", ")}${skipped.length > 10 ? "…" : ""}: each needs a date and a spend amount.`);
}

async function _addManualSpend(f: FormData) {
  const date = str(f, "date");
  if (!isYmd(date)) throw new Error("Pick a date");
  const platform = str(f, "platform").toLowerCase().replace(/[^a-z0-9]+/g, "_") || "other";
  await storeSpend([{ date, platform, campaign: str(f, "campaign") || "(manual)", spend: num(f, "spend"), conversionValue: num(f, "conversion_value"), currency: str(f, "currency").toUpperCase() || null }]);
  await done();
}

async function _deleteUploadedSpend(f: FormData) {
  const shop = await getShop();
  const month = str(f, "month"); // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Bad month");
  const end = addDays(`${month}-01`, 40).slice(0, 8) + "01";
  await must(db().from("ad_spend_daily").delete().eq("shop_id", shop.id).eq("account_id", CSV_ACCOUNT)
    .eq("platform", str(f, "platform")).gte("date", `${month}-01`).lt("date", end));
  await done();
}

async function _importCourierCsv(f: FormData) {
  const shop = await getShop();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a CSV file to upload");
  const { rows, skipped } = courierRows(await file.text());
  if (rows.length === 0) throw new Error("No valid rows. Each row needs an order number and a cost.");
  // Several invoice lines for one order (e.g. two parcels) add up.
  const byOrder = new Map<string, number>();
  for (const r of rows) byOrder.set(r.order, (byOrder.get(r.order) ?? 0) + r.cost);
  const names = [...byOrder.keys()].flatMap((o) => [o, `#${o}`]);
  const { data: found } = await must(db().from("orders").select("id, name").eq("shop_id", shop.id).in("name", names));
  const matched = new Set<string>();
  for (const o of (found ?? []) as { id: string; name: string }[]) {
    const key = o.name.replace(/^#/, "");
    await must(db().from("orders").update({ actual_courier: byOrder.get(key) }).eq("id", o.id));
    matched.add(key);
  }
  await done();
  const unmatched = [...byOrder.keys()].filter((k) => !matched.has(k));
  if (unmatched.length || skipped.length)
    throw new Error(`Updated ${matched.size} orders.${unmatched.length ? ` No order found for ${unmatched.slice(0, 10).join(", ")}${unmatched.length > 10 ? "…" : ""}.` : ""}${skipped.length ? ` Skipped line${skipped.length > 1 ? "s" : ""} ${skipped.slice(0, 10).join(", ")}.` : ""}`);
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

export async function importSpendCsv(f: FormData) {
  await run(f, _importSpendCsv, "ads");
}

export async function addManualSpend(f: FormData) {
  await run(f, _addManualSpend, "ads");
}

export async function deleteUploadedSpend(f: FormData) {
  await run(f, _deleteUploadedSpend, "ads");
}

export async function importCourierCsv(f: FormData) {
  await run(f, _importCourierCsv, "shipping");
}

export async function applyFeePreset(f: FormData) {
  await run(f, _applyFeePreset, "fees");
}

export async function saveTxnFee(f: FormData) {
  await run(f, _saveTxnFee, "fees");
}
