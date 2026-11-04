// Margewise profit engine.
// Pure functions only: no database or network access, so the maths can be tested
// against the September 2026 answer-key spreadsheet line for line.

export type ReturnStatus =
  | "none"
  | "returned_restocked"
  | "returned_written_off"
  | "failed_delivery";

export interface ShopConfig {
  vatRegistered: boolean;
  vatRate: number; // 0.15
  pricesIncludeVat: boolean;
  packagingPerOrder: number;
  fulfilmentPerOrder: number;
  returnHandlingPerOrder: number;
  courierStandard: number;
  courierBulky: number;
  courierReturnStandard: number;
  courierReturnBulky: number;
  adSpendIncludesVat: boolean;
  /**
   * "rate": strip VAT at vatRate (the original South African model, matches the answer key).
   * "shopify": strip the tax Shopify actually recorded on each order. Works for VAT-inclusive
   * prices (UK, EU, AU, ZA) and for sales tax added at checkout (US, CA).
   */
  taxMode?: "rate" | "shopify";
  /** ISO country of the store, used to tell domestic from international shipments. */
  country?: string;
  courierRules?: CourierRule[];
  /**
   * Shopify's third-party transaction fee (e.g. 0.02 on Basic) on orders not paid through
   * Shopify Payments or a manual method. Shopify bills it in total, not per order.
   */
  shopifyTxnFeePct?: number;
}

export interface CourierRule {
  zone: string; // ISO country code, "domestic" or "international"
  parcelSize: string; // "standard" | "bulky"
  cost: number;
  returnCost: number;
}

export type FixedCostFrequency = "daily" | "weekly" | "monthly" | "yearly" | "once";

export interface FixedCost {
  name: string;
  category: string;
  amount: number;
  frequency: FixedCostFrequency;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  vatClaimable: boolean;
}

export interface FeeRule {
  gatewayMatch: string;
  pct: number;
  fixedFee: number;
  minFee: number;
  maxFee?: number | null;
}

export interface OrderLineInput {
  sku: string | null;
  title?: string | null;
  quantity: number;
  lineTotalIncl: number; // after discounts
  unitCost: number | null; // landed cost ex VAT
}

export interface OrderInput {
  name: string;
  localDate: string; // YYYY-MM-DD in the shop's timezone
  gateway: string | null;
  shippingIncl: number;
  refundIncl: number;
  returnStatus: ReturnStatus;
  lines: OrderLineInput[];
  /** Total tax Shopify recorded on the order (used when taxMode is "shopify"). */
  taxAmount?: number;
  /** True when line and shipping prices already include tax. */
  taxesIncluded?: boolean;
  shipCountry?: string | null;
  /** Fee the gateway actually charged (e.g. Shopify Payments), replacing the rate rule. */
  actualPaymentFee?: number | null;
  /** Courier cost from an imported invoice, replacing the zone rule. */
  actualCourier?: number | null;
}

export interface LineResult {
  sku: string | null;
  title: string | null;
  quantity: number;
  share: number;
  netRevenue: number;
  cogs: number;
  paymentFee: number;
  courier: number;
  returnsCost: number;
  packaging: number;
  contribution: number;
}

export interface OrderResult {
  name: string;
  localDate: string;
  totalIncl: number;
  bulky: boolean;
  netRevenue: number;
  cogs: number;
  paymentFee: number;
  courier: number;
  returnsCost: number;
  packaging: number;
  contribution: number;
  missingCostSkus: string[];
  unmatchedGateway: string | null;
  lines: LineResult[];
}

export interface Totals {
  orders: number;
  revenueIncl: number;
  netRevenue: number;
  cogs: number;
  paymentFees: number;
  courier: number;
  returnsCost: number;
  packaging: number;
  contribution: number;
  adSpend: number;
  profitAfterAds: number;
  fixedCosts: number;
  netProfit: number;
  poas: number | null;
  breakEvenRoas: number | null;
  missingCostSkus: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 1 when input VAT can be claimed back, otherwise 1 + VAT rate. */
export function costMultiplier(c: ShopConfig): number {
  return c.vatRegistered ? 1 : 1 + c.vatRate;
}

/** Divides customer payments by this to strip output VAT. */
export function revenueDivisor(c: ShopConfig): number {
  return c.vatRegistered && c.pricesIncludeVat ? 1 + c.vatRate : 1;
}

export function findFeeRule(gateway: string | null, rules: FeeRule[]): FeeRule | null {
  if (!gateway) return null;
  const g = gateway.toLowerCase();
  // Longest match wins, so "Stitch Express" beats "Stitch".
  const hits = rules
    .filter((r) => g.startsWith(r.gatewayMatch.toLowerCase()))
    .sort((a, b) => b.gatewayMatch.length - a.gatewayMatch.length);
  return hits[0] ?? null;
}

/** Courier and return cost for an order's destination and parcel size. Exact country beats zone. */
export function courierFor(c: ShopConfig, shipCountry: string | null | undefined, bulky: boolean) {
  const size = bulky ? "bulky" : "standard";
  const fallback = {
    cost: bulky ? c.courierBulky : c.courierStandard,
    returnCost: bulky ? c.courierReturnBulky : c.courierReturnStandard,
  };
  const rules = c.courierRules ?? [];
  if (rules.length === 0) return fallback;
  const country = shipCountry?.toUpperCase() ?? null;
  const domestic = !country || !c.country || country === c.country.toUpperCase();
  const pick = (zone: string) => rules.find((r) => r.zone.toUpperCase() === zone.toUpperCase() && r.parcelSize === size);
  const hit = (country && pick(country)) || pick(domestic ? "domestic" : "international");
  return hit ? { cost: hit.cost, returnCost: hit.returnCost } : fallback;
}

/** Shopify Payments (incl. Shop Pay) and manual methods carry no Shopify transaction fee. */
export function txnFeeExempt(gateway: string | null): boolean {
  if (!gateway) return true;
  return /shopify[_ ]payments|shop pay|manual|bank deposit|cash|cod|gift[_ ]card|bogus/i.test(gateway);
}

export function computeOrder(
  o: OrderInput,
  c: ShopConfig,
  rules: FeeRule[],
  bulkySkus: Set<string>,
): OrderResult {
  const mult = costMultiplier(c);
  const div = revenueDivisor(c);
  const shopifyTax = c.taxMode === "shopify";
  const linesTotal = o.lines.reduce((s, l) => s + l.lineTotalIncl, 0);
  const goods = linesTotal + o.shippingIncl;
  const tax = shopifyTax ? o.taxAmount ?? 0 : 0;
  // What the customer paid. Sales tax added at checkout sits on top of line prices.
  const totalIncl = shopifyTax && o.taxesIncluded === false ? goods + tax : goods;
  const taxShare = shopifyTax && totalIncl > 0 ? tax / totalIncl : 0;
  const bulky = o.lines.some((l) => l.sku != null && bulkySkus.has(l.sku));

  const rule = findFeeRule(o.gateway, rules);
  const paymentFee =
    o.actualPaymentFee != null
      ? o.actualPaymentFee * mult
      : rule
        ? Math.min(Math.max(rule.pct * totalIncl + rule.fixedFee, rule.minFee), rule.maxFee ?? Infinity) * mult
        : 0;
  const txnFee = c.shopifyTxnFeePct && !txnFeeExempt(o.gateway) ? c.shopifyTxnFeePct * totalIncl * mult : 0;
  const zone = courierFor(c, o.shipCountry, bulky);
  const courier = (o.actualCourier != null ? o.actualCourier : zone.cost) * mult;
  const returnsCost =
    o.returnStatus === "none" ? 0 : (zone.returnCost + c.returnHandlingPerOrder) * mult;
  const packaging = (c.packagingPerOrder + c.fulfilmentPerOrder) * mult;
  const stockComesBack =
    o.returnStatus === "returned_restocked" || o.returnStatus === "failed_delivery";

  const missing: string[] = [];
  const lines: LineResult[] = o.lines.map((l, i) => {
    // Shipping and refunds sit on the first line, exactly as in the spreadsheet.
    const ship = i === 0 ? o.shippingIncl : 0;
    const refund = i === 0 ? o.refundIncl : 0;
    const share = goods === 0 ? 0 : (l.lineTotalIncl + ship) / goods;
    const netRevenue = shopifyTax
      ? (share * totalIncl - refund) * (1 - taxShare)
      : (l.lineTotalIncl + ship - refund) / div;
    if (l.unitCost == null && l.sku) missing.push(l.sku);
    const cogs = stockComesBack ? 0 : l.quantity * (l.unitCost ?? 0);
    const lp = (paymentFee + txnFee) * share;
    const lc = courier * share;
    const lr = returnsCost * share;
    const lk = packaging * share;
    return {
      sku: l.sku,
      title: l.title ?? null,
      quantity: l.quantity,
      share,
      netRevenue,
      cogs,
      paymentFee: lp,
      courier: lc,
      returnsCost: lr,
      packaging: lk,
      contribution: netRevenue - cogs - lp - lc - lr - lk,
    };
  });

  const sum = (k: keyof LineResult) => lines.reduce((s, l) => s + (l[k] as number), 0);
  return {
    name: o.name,
    localDate: o.localDate,
    totalIncl,
    bulky,
    netRevenue: sum("netRevenue"),
    cogs: sum("cogs"),
    paymentFee: sum("paymentFee"),
    courier: sum("courier"),
    returnsCost: sum("returnsCost"),
    packaging: sum("packaging"),
    contribution: sum("contribution"),
    missingCostSkus: missing,
    unmatchedGateway: o.gateway && !rule && o.actualPaymentFee == null ? o.gateway : null,
    lines,
  };
}

/** Ad spend as a cost to the business. */
export function adCost(spend: number, c: ShopConfig): number {
  const exVat = c.adSpendIncludesVat && c.vatRegistered ? spend / (1 + c.vatRate) : spend;
  return exVat * (c.adSpendIncludesVat ? 1 : costMultiplier(c));
}

const daysInMonth = (ymd: string) => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7), 0)).getUTCDate();
const daysInYear = (ymd: string) => (new Date(Date.UTC(+ymd.slice(0, 4), 1, 29)).getUTCDate() === 29 ? 366 : 365);

/** One fixed cost's share for a single day, after reclaimable VAT. */
export function fixedCostForDay(f: FixedCost, ymd: string, c: ShopConfig): number {
  if (ymd < f.startDate || (f.endDate && ymd > f.endDate)) return 0;
  let v: number;
  switch (f.frequency) {
    case "daily": v = f.amount; break;
    case "weekly": v = f.amount / 7; break;
    case "monthly": v = f.amount / daysInMonth(ymd); break;
    case "yearly": v = f.amount / daysInYear(ymd); break;
    case "once": v = ymd === f.startDate ? f.amount : 0; break;
  }
  return f.vatClaimable && c.vatRegistered ? v / (1 + c.vatRate) : v;
}

export function fixedCostsForDay(costs: FixedCost[], ymd: string, c: ShopConfig): number {
  return costs.reduce((s, f) => s + fixedCostForDay(f, ymd, c), 0);
}

export function totals(results: OrderResult[], adSpendRaw: number, c: ShopConfig, fixed = 0): Totals {
  const s = (f: (r: OrderResult) => number) => results.reduce((a, r) => a + f(r), 0);
  const revenueIncl = s((r) => r.totalIncl);
  const contribution = s((r) => r.contribution);
  const ad = adCost(adSpendRaw, c);
  return {
    orders: results.length,
    revenueIncl: round2(revenueIncl),
    netRevenue: round2(s((r) => r.netRevenue)),
    cogs: round2(s((r) => r.cogs)),
    paymentFees: round2(s((r) => r.paymentFee)),
    courier: round2(s((r) => r.courier)),
    returnsCost: round2(s((r) => r.returnsCost)),
    packaging: round2(s((r) => r.packaging)),
    contribution: round2(contribution),
    adSpend: round2(ad),
    profitAfterAds: round2(contribution - ad),
    fixedCosts: round2(fixed),
    netProfit: round2(contribution - ad - fixed),
    poas: ad > 0 ? contribution / ad : null,
    // The Meta-reported ROAS needed just to cover variable costs.
    breakEvenRoas:
      contribution > 0 && ad > 0 ? revenueIncl / (contribution * (adSpendRaw / ad)) : null,
    missingCostSkus: [...new Set(results.flatMap((r) => r.missingCostSkus))],
  };
}

export interface ProductRow {
  sku: string;
  title: string | null;
  units: number;
  netRevenue: number;
  contribution: number;
}

export function byProduct(results: OrderResult[]): ProductRow[] {
  const m = new Map<string, ProductRow>();
  for (const r of results)
    for (const l of r.lines) {
      const key = l.sku ?? l.title ?? "unknown";
      const row = m.get(key) ?? { sku: key, title: l.title, units: 0, netRevenue: 0, contribution: 0 };
      row.units += l.quantity;
      row.netRevenue += l.netRevenue;
      row.contribution += l.contribution;
      m.set(key, row);
    }
  return [...m.values()].sort((a, b) => b.contribution - a.contribution);
}
