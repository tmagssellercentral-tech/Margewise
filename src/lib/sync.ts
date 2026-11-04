import { adCost, byProduct, computeOrder, fixedCostsForDay, totals, type OrderInput, type OrderResult, type ReturnStatus } from "./engine";
import { db, getShop, loadConfig, type Shop } from "./db";
import { actualFees, fetchOrdersUpdatedSince, money, numericId } from "./shopify";
import { dailyRates } from "./fx";
import { fetchCampaignDays, type CampaignDay } from "./meta";
import { fetchGoogleCampaignDays, googleConfigured } from "./google";
import { daysBetween, localDate } from "./dates";

async function logRun<T>(shop: Shop, kind: string, fn: () => Promise<T>): Promise<T> {
  const { data } = await db().from("sync_runs").insert({ shop_id: shop.id, kind }).select("id").single();
  try {
    const out = await fn();
    await db().from("sync_runs").update({ finished_at: new Date().toISOString(), status: "ok", detail: JSON.stringify(out).slice(0, 2000) }).eq("id", data?.id);
    return out;
  } catch (e) {
    await db().from("sync_runs").update({ finished_at: new Date().toISOString(), status: "error", detail: String(e).slice(0, 2000) }).eq("id", data?.id);
    throw e;
  }
}

/** Pull website orders changed since `sinceIso` and store them with their line items and unit costs. */
export async function syncShopify(shop: Shop, sinceIso: string) {
  return logRun(shop, "shopify", async () => {
    const orders = await fetchOrdersUpdatedSince(sinceIso);
    for (let i = 0; i < orders.length; i += 50) {
      const batch = orders.slice(i, i + 50);
      // return_status is deliberately not sent, so a status set by the merchant is never overwritten.
      const { data: saved, error } = await db()
        .from("orders")
        .upsert(
          batch.map((o) => ({
            shop_id: shop.id,
            shopify_id: numericId(o.id),
            name: o.name,
            created_at: o.createdAt,
            local_date: localDate(o.createdAt, shop.timezone),
            source_name: o.sourceName,
            gateway: o.paymentGatewayNames[0] ?? null,
            financial_status: o.displayFinancialStatus,
            cancelled: o.cancelledAt != null,
            shipping_incl: money(o.totalShippingPriceSet),
            refund_incl: money(o.totalRefundedSet),
            currency: o.currencyCode ?? null,
            taxes_included: o.taxesIncluded ?? null,
            tax_amount: money(o.totalTaxSet),
            // Only overwrite the country when Shopify returned the address field.
            ...(o.shippingAddress !== undefined ? { ship_country: o.shippingAddress?.countryCodeV2 ?? null } : {}),
            actual_payment_fee: actualFees(o),
            synced_at: new Date().toISOString(),
          })),
          { onConflict: "shop_id,shopify_id" },
        )
        .select("id, shopify_id");
      if (error) throw new Error(error.message);
      const idBySid = new Map(saved!.map((r) => [Number(r.shopify_id), r.id as string]));
      const ids = [...idBySid.values()];
      const del = await db().from("order_lines").delete().in("order_id", ids);
      if (del.error) throw new Error(del.error.message);
      const lines = batch.flatMap((o) =>
        o.lineItems.nodes.map((l) => ({
          order_id: idBySid.get(numericId(o.id)),
          shop_id: shop.id,
          sku: l.sku || null,
          title: l.title,
          quantity: l.quantity,
          line_total_incl: money(l.discountedTotalSet),
          unit_cost: l.variant?.inventoryItem?.unitCost ? Number(l.variant.inventoryItem.unitCost.amount) : null,
        })),
      );
      if (lines.length) {
        const ins = await db().from("order_lines").insert(lines);
        if (ins.error) throw new Error(ins.error.message);
      }
    }
    return { orders: orders.length };
  });
}

export const CSV_ACCOUNT = "csv";

export type AdPlatform = "meta" | "google";

/** Store one platform's campaign spend for a window, replacing what was there. */
export async function syncAds(shop: Shop, platform: AdPlatform, from: string, to: string, fetch: () => Promise<CampaignDay[]>) {
  return logRun(shop, platform, async () => {
    const rows = await convertToStoreCurrency(await fetch(), shop.currency, from, to);
    // Fetch first, then replace the window, so a failed pull never wipes stored spend
    // and campaigns with zero spend on a re-run don't linger.
    // Uploaded rows (account "csv") are the merchant's; a connector sync never removes them.
    const del = await db().from("ad_spend_daily").delete().eq("shop_id", shop.id).eq("platform", platform)
      .neq("account_id", CSV_ACCOUNT).gte("date", from).lte("date", to);
    if (del.error) throw new Error(del.error.message);
    if (rows.length) {
      const { error } = await db().from("ad_spend_daily").insert(
        rows.map((r) => ({
          shop_id: shop.id,
          date: r.date,
          platform,
          account_id: r.accountId,
          campaign_id: r.campaignId,
          campaign_name: r.campaignName,
          spend: r.spend,
          purchase_value: r.purchaseValue,
          currency: r.originalCurrency,
          spend_original: r.spendOriginal,
          fx_rate: r.fxRate,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { rows: rows.length };
  });
}

type Converted = CampaignDay & { originalCurrency: string; spendOriginal: number; fxRate: number };

/** Ad accounts can bill in another currency (e.g. USD); convert spend and value at that day's rate. */
async function convertToStoreCurrency(rows: CampaignDay[], storeCcy: string, from: string, to: string): Promise<Converted[]> {
  const ccys = [...new Set(rows.map((r) => r.currency ?? storeCcy))].filter((c) => c !== storeCcy);
  const rates = new Map<string, Map<string, number>>();
  for (const c of ccys) rates.set(c, await dailyRates(c, storeCcy, from, to));
  return rows.map((r) => {
    const ccy = r.currency ?? storeCcy;
    const fx = ccy === storeCcy ? 1 : rates.get(ccy)!.get(r.date);
    if (fx == null) throw new Error(`No ${ccy}→${storeCcy} rate for ${r.date}`);
    return { ...r, spend: r.spend * fx, purchaseValue: r.purchaseValue * fx, originalCurrency: ccy, spendOriginal: r.spend, fxRate: fx };
  });
}

export const syncMeta = (shop: Shop, from: string, to: string) =>
  syncAds(shop, "meta", from, to, () => fetchCampaignDays(from, to));

export const syncGoogle = (shop: Shop, from: string, to: string) =>
  syncAds(shop, "google", from, to, () => fetchGoogleCampaignDays(from, to));

/** Load stored orders for a date range and run them through the engine. */
export async function computeRange(shop: Shop, from: string, to: string) {
  const { config, rules, bulky, costOverrides, fixedCosts } = await loadConfig(shop);

  const orders: OrderInput[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await db()
      .from("orders")
      .select("name, local_date, gateway, shipping_incl, refund_incl, return_status, taxes_included, tax_amount, ship_country, actual_payment_fee, actual_courier, order_lines(sku, title, quantity, line_total_incl, unit_cost)")
      .eq("shop_id", shop.id)
      .eq("cancelled", false)
      .gte("local_date", from)
      .lte("local_date", to)
      .order("created_at")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    for (const o of data ?? [])
      orders.push({
        name: o.name,
        localDate: o.local_date,
        gateway: o.gateway,
        shippingIncl: Number(o.shipping_incl),
        refundIncl: Number(o.refund_incl),
        returnStatus: o.return_status as ReturnStatus,
        taxAmount: Number(o.tax_amount ?? 0),
        taxesIncluded: o.taxes_included ?? undefined,
        shipCountry: o.ship_country,
        actualPaymentFee: o.actual_payment_fee != null ? Number(o.actual_payment_fee) : null,
        actualCourier: o.actual_courier != null ? Number(o.actual_courier) : null,
        lines: (o.order_lines ?? []).map((l) => ({
          sku: l.sku,
          title: l.title,
          quantity: l.quantity,
          lineTotalIncl: Number(l.line_total_incl),
          unitCost: l.unit_cost != null ? Number(l.unit_cost) : l.sku ? costOverrides.get(l.sku) ?? null : null,
        })),
      });
    if (!data || data.length < 1000) break;
  }

  const ads = await db()
    .from("ad_spend_daily")
    .select("date, platform, campaign_id, campaign_name, spend, purchase_value")
    .eq("shop_id", shop.id)
    .gte("date", from)
    .lte("date", to);
  if (ads.error) throw new Error(ads.error.message);

  const results: OrderResult[] = orders.map((o) => computeOrder(o, config, rules, bulky));
  const spendByDate = new Map<string, number>();
  const campaigns = new Map<string, { id: string; platform: string; name: string; spend: number; purchaseValue: number }>();
  const spendByPlatform = new Map<string, number>();
  for (const a of ads.data ?? []) {
    spendByDate.set(a.date, (spendByDate.get(a.date) ?? 0) + Number(a.spend));
    spendByPlatform.set(a.platform, (spendByPlatform.get(a.platform) ?? 0) + Number(a.spend));
    const key = `${a.platform}:${a.campaign_id}`;
    const c = campaigns.get(key) ?? { id: key, platform: a.platform, name: a.campaign_name ?? a.campaign_id, spend: 0, purchaseValue: 0 };
    c.spend += Number(a.spend);
    c.purchaseValue += Number(a.purchase_value);
    campaigns.set(key, c);
  }
  const totalSpend = [...spendByDate.values()].reduce((a, b) => a + b, 0);

  const fixedByDate = new Map(daysBetween(from, to).map((d) => [d, fixedCostsForDay(fixedCosts, d, config)]));
  const totalFixed = [...fixedByDate.values()].reduce((a, b) => a + b, 0);
  const daily = daysBetween(from, to).map((d) => ({
    date: d,
    ...totals(results.filter((r) => r.localDate === d), spendByDate.get(d) ?? 0, config, fixedByDate.get(d) ?? 0),
  }));

  return {
    config,
    results,
    daily,
    total: totals(results, totalSpend, config, totalFixed),
    fixedCosts,
    products: byProduct(results),
    // Ad cost (after the store's VAT treatment) per platform, largest first.
    platforms: [...spendByPlatform.entries()]
      .map(([platform, raw]) => ({ platform, adCost: adCost(raw, config) }))
      .sort((a, b) => b.adCost - a.adCost),
    campaigns: [...campaigns.values()]
      .map((c) => ({ ...c, roas: c.spend > 0 ? c.purchaseValue / c.spend : null }))
      .sort((a, b) => b.spend - a.spend),
    unmatchedGateways: [...new Set(results.map((r) => r.unmatchedGateway).filter(Boolean))] as string[],
  };
}

/** Recompute and store daily results so the dashboard and reports read one source of truth. */
export async function recompute(shop: Shop, from: string, to: string) {
  const r = await computeRange(shop, from, to);
  const { error } = await db()
    .from("daily_results")
    .upsert(
      r.daily.map((d) => ({
        shop_id: shop.id,
        date: d.date,
        orders: d.orders,
        revenue_incl: d.revenueIncl,
        net_revenue: d.netRevenue,
        cogs: d.cogs,
        payment_fees: d.paymentFees,
        courier: d.courier,
        returns_cost: d.returnsCost,
        packaging: d.packaging,
        contribution: d.contribution,
        ad_spend: d.adSpend,
        profit_after_ads: d.profitAfterAds,
        fixed_costs: d.fixedCosts,
        net_profit: d.netProfit,
        missing_cost_skus: d.missingCostSkus,
        computed_at: new Date().toISOString(),
      })),
      { onConflict: "shop_id,date" },
    );
  if (error) throw new Error(error.message);
  return { days: r.daily.length, profitAfterAds: r.total.profitAfterAds, netProfit: r.total.netProfit };
}

/** Full nightly job: Shopify and every configured ad platform for the window, then recompute. */
export async function runSync(from: string, to: string) {
  const shop = await getShop();
  const sinceIso = new Date(`${from}T00:00:00Z`).toISOString();
  const out: Record<string, unknown> = {};
  const errors: string[] = [];
  try { out.shopify = await syncShopify(shop, sinceIso); } catch (e) { errors.push(`shopify: ${e}`); }
  try { out.meta = await syncMeta(shop, from, to); } catch (e) { errors.push(`meta: ${e}`); }
  if (googleConfigured()) {
    try { out.google = await syncGoogle(shop, from, to); } catch (e) { errors.push(`google: ${e}`); }
  } else out.google = "not connected";
  out.recompute = await recompute(shop, from, to);
  return { ...out, errors };
}
