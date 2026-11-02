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
}

export interface FeeRule {
  gatewayMatch: string;
  pct: number;
  fixedFee: number;
  minFee: number;
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

export function computeOrder(
  o: OrderInput,
  c: ShopConfig,
  rules: FeeRule[],
  bulkySkus: Set<string>,
): OrderResult {
  const mult = costMultiplier(c);
  const div = revenueDivisor(c);
  const linesTotal = o.lines.reduce((s, l) => s + l.lineTotalIncl, 0);
  const totalIncl = linesTotal + o.shippingIncl;
  const bulky = o.lines.some((l) => l.sku != null && bulkySkus.has(l.sku));

  const rule = findFeeRule(o.gateway, rules);
  const paymentFee = rule
    ? Math.max(rule.pct * totalIncl + rule.fixedFee, rule.minFee) * mult
    : 0;
  const courier = (bulky ? c.courierBulky : c.courierStandard) * mult;
  const returnsCost =
    o.returnStatus === "none"
      ? 0
      : ((bulky ? c.courierReturnBulky : c.courierReturnStandard) + c.returnHandlingPerOrder) * mult;
  const packaging = (c.packagingPerOrder + c.fulfilmentPerOrder) * mult;
  const stockComesBack =
    o.returnStatus === "returned_restocked" || o.returnStatus === "failed_delivery";

  const missing: string[] = [];
  const lines: LineResult[] = o.lines.map((l, i) => {
    // Shipping and refunds sit on the first line, exactly as in the spreadsheet.
    const ship = i === 0 ? o.shippingIncl : 0;
    const refund = i === 0 ? o.refundIncl : 0;
    const share = totalIncl === 0 ? 0 : (l.lineTotalIncl + ship) / totalIncl;
    const netRevenue = (l.lineTotalIncl + ship - refund) / div;
    if (l.unitCost == null && l.sku) missing.push(l.sku);
    const cogs = stockComesBack ? 0 : l.quantity * (l.unitCost ?? 0);
    const lp = paymentFee * share;
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
    unmatchedGateway: o.gateway && !rule ? o.gateway : null,
    lines,
  };
}

/** Ad spend as a cost to the business. */
export function adCost(spend: number, c: ShopConfig): number {
  const exVat = c.adSpendIncludesVat && c.vatRegistered ? spend / (1 + c.vatRate) : spend;
  return exVat * (c.adSpendIncludesVat ? 1 : costMultiplier(c));
}

export function totals(results: OrderResult[], adSpendRaw: number, c: ShopConfig): Totals {
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
