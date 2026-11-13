// Monthly profit and loss statement built from the same numbers as the dashboard.
// Pure: takes one period's results per column, returns rows ready for the page and exports.

import { fixedCostForDay, type FixedCost, type ShopConfig, type Totals } from "./engine";
import { addDays, daysBetween } from "./dates";

export interface PnlPeriod {
  key: string; // YYYY-MM
  label: string; // "Oct 2026", "Nov 2026 (to date)"
  from: string;
  to: string;
}

export interface PnlInput {
  period: PnlPeriod;
  total: Totals;
  platforms: { platform: string; adCost: number }[];
  fixedCosts: FixedCost[];
  config: ShopConfig;
  /** Sales the ad platforms report for their own ads (their attribution). */
  attributed?: number;
}

export type RowKind = "line" | "subtotal" | "total" | "ratio" | "memo" | "heading";

export interface PnlRow {
  key: string;
  label: string;
  kind: RowKind;
  values: (number | null)[]; // one per period, then the total column
  negative?: boolean; // shown as a cost
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The last `n` calendar months ending with the month of `today`; the current month runs to today. */
export function monthPeriods(today: string, n: number): PnlPeriod[] {
  const out: PnlPeriod[] = [];
  let y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  for (let i = 0; i < n; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const from = `${key}-01`;
    const end = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
    const current = i === 0;
    out.unshift({ key, label: `${MONTHS.at(m - 1)} ${y}${current && end > today ? " (to date)" : ""}`, from, to: current && end > today ? today : end });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

const isYm = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/**
 * Columns for a P&L: either the last `months` months, or a custom span of whole months
 * (?from=YYYY-MM&to=YYYY-MM, at most 24, never past today).
 */
export function choosePeriods(today: string, sp: Record<string, string | undefined>) {
  if (isYm(sp.from) && isYm(sp.to)) {
    const end = sp.to > today.slice(0, 7) ? today.slice(0, 7) : sp.to;
    const start = sp.from <= end ? sp.from : end;
    const span = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5)) - Number(start.slice(5)) + 1;
    const n = Math.min(24, span);
    const lastDay = end === today.slice(0, 7) ? today : addDays(`${Number(end.slice(5)) === 12 ? Number(end.slice(0, 4)) + 1 : end.slice(0, 4)}-${String(Number(end.slice(5)) % 12 + 1).padStart(2, "0")}-01`, -1);
    return { key: "custom", from: start, to: end, periods: monthPeriods(lastDay, n) };
  }
  const months = [3, 6, 12].includes(Number(sp.months)) ? Number(sp.months) : 6;
  const periods = monthPeriods(today, months);
  return { key: String(months), from: periods[0].key, to: periods.at(-1)!.key, periods };
}

const PLATFORM: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", pinterest: "Pinterest", snapchat: "Snapchat",
  microsoft: "Microsoft", x: "X", influencer: "Influencers", manual: "Other",
};
const pname = (p: string) => PLATFORM[p] ?? p.replace(/_/g, " ");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildPnl(cols: PnlInput[]): PnlRow[] {
  const sum = (f: (c: PnlInput) => number) => {
    const v = cols.map(f);
    return [...v, v.reduce((a, b) => a + b, 0)];
  };
  const ratio = (num: number[], den: number[]) => num.map((n, i) => (den[i] ? n / den[i] : null));
  const t = (k: keyof Totals) => sum((c) => Number(c.total[k] ?? 0));

  const revenue = t("netRevenue");
  const cogs = t("cogs");
  const gross = revenue.map((v, i) => v - cogs[i]);
  const contribution = t("contribution");
  const ads = t("adSpend");
  const afterAds = t("profitAfterAds");
  const fixed = t("fixedCosts");
  const net = t("netProfit");
  const orders = t("orders");

  const platformKeys = [...new Set(cols.flatMap((c) => c.platforms.map((p) => p.platform)))];
  const adRows: PnlRow[] = platformKeys.map((p) => ({
    key: `ads-${p}`, label: `${pname(p)} ads`, kind: "line", negative: true,
    values: sum((c) => c.platforms.find((x) => x.platform === p)?.adCost ?? 0),
  }));

  // Fixed costs by category, using the same per-day allocation as the dashboard.
  const categories = [...new Set(cols.flatMap((c) => c.fixedCosts.map((f) => f.category)))].sort();
  const fixedRows: PnlRow[] = categories
    .map((cat): PnlRow => ({
      key: `fixed-${cat}`, label: cap(cat), kind: "line", negative: true,
      values: sum((c) => daysBetween(c.period.from, c.period.to)
        .reduce((s, d) => s + c.fixedCosts.filter((f) => f.category === cat).reduce((a, f) => a + fixedCostForDay(f, d, c.config), 0), 0)),
    }))
    .filter((r) => r.values.some((v) => Math.abs(v ?? 0) > 0.005));

  return [
    { key: "revenue", label: "Net revenue (ex VAT, after refunds)", kind: "subtotal", values: revenue },
    { key: "cogs", label: "Product cost", kind: "line", negative: true, values: cogs },
    { key: "gross", label: "Gross profit", kind: "subtotal", values: gross },
    { key: "gross-margin", label: "Gross margin", kind: "ratio", values: ratio(gross, revenue) },
    { key: "h-order", label: "Order costs", kind: "heading", values: [] },
    { key: "fees", label: "Payment fees", kind: "line", negative: true, values: t("paymentFees") },
    { key: "courier", label: "Courier", kind: "line", negative: true, values: t("courier") },
    { key: "packaging", label: "Packaging & fulfilment", kind: "line", negative: true, values: t("packaging") },
    { key: "returns", label: "Returns", kind: "line", negative: true, values: t("returnsCost") },
    { key: "contribution", label: "Contribution (before ads)", kind: "subtotal", values: contribution },
    { key: "contribution-margin", label: "Contribution margin", kind: "ratio", values: ratio(contribution, revenue) },
    { key: "h-ads", label: "Advertising", kind: "heading", values: [] },
    ...(adRows.length ? adRows : [{ key: "ads", label: "Ad spend", kind: "line" as const, negative: true, values: ads }]),
    { key: "after-ads", label: "Profit after ads", kind: "subtotal", values: afterAds },
    { key: "h-fixed", label: "Fixed costs", kind: "heading", values: [] },
    ...(fixedRows.length ? fixedRows : [{ key: "fixed", label: "Fixed costs (none entered)", kind: "line" as const, negative: true, values: fixed }]),
    { key: "net", label: "Net profit", kind: "total", values: net },
    { key: "net-margin", label: "Net margin", kind: "ratio", values: ratio(net, revenue) },
    { key: "h-memo", label: "Key figures", kind: "heading", values: [] },
    { key: "orders", label: "Orders", kind: "memo", values: orders },
    { key: "aov", label: "Average order value (incl VAT)", kind: "memo", values: ratio(t("revenueIncl"), orders) },
    { key: "mer", label: "MER (all sales ÷ ad spend)", kind: "memo", values: ratio(t("revenueIncl"), ads) },
    { key: "blended-roas", label: "Blended ROAS (platform-reported sales ÷ ad spend)", kind: "memo", values: ratio(sum((c) => c.attributed ?? 0), ads).map((v) => v || null) },
  ];
}
