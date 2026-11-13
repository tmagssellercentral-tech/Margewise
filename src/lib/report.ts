// One place the pages get their numbers from: the selected range, the previous period of the
// same length (for "vs previous" changes) and the last sync per source. In demo mode
// (MARGEWISE_DEMO=1) it serves the September 2026 answer-key data instead of the database.

import { db, getShop, type Shop } from "./db";
import { computeRange } from "./sync";
import { addDays, daysBetween, localDate } from "./dates";
import { resolveRange } from "./range";

export type RangeData = Awaited<ReturnType<typeof computeRange>>;

export interface Report {
  shop: Shop;
  today: string;
  range: { from: string; to: string; key: string };
  cur: RangeData;
  prev: RangeData | null;
  lastSync: { kind: string; status: string; finished_at: string | null }[];
  demo: boolean;
}

export const isDemo = () => process.env.MARGEWISE_DEMO === "1";

export async function getReport(sp: Record<string, string | undefined>, defaultRange = "30d", withPrev = true): Promise<Report> {
  if (isDemo()) {
    const { demoReport } = await import("./demo");
    return demoReport(sp, withPrev);
  }
  const shop = await getShop();
  if (shop.is_owner === false) {
    const { refreshIfStale } = await import("./onboarding");
    const { after } = await import("next/server");
    after(() => refreshIfStale(shop).catch(() => null));
  }
  const today = localDate(new Date(), shop.timezone);
  const range = resolveRange(sp.range ?? defaultRange, today, sp.from, sp.to);
  const days = daysBetween(range.from, range.to).length;
  const [cur, prev, runs] = await Promise.all([
    computeRange(shop, range.from, range.to),
    withPrev ? computeRange(shop, addDays(range.from, -days), addDays(range.from, -1)) : Promise.resolve(null),
    db().from("sync_runs").select("kind, status, finished_at").eq("shop_id", shop.id).order("started_at", { ascending: false }).limit(30),
  ]);
  const latest = new Map<string, { kind: string; status: string; finished_at: string | null }>();
  for (const r of runs.data ?? []) if (!latest.has(r.kind)) latest.set(r.kind, r);
  return { shop, today, range, cur, prev, lastSync: [...latest.values()], demo: false };
}

/** Percentage change, or null when there's nothing to compare against. */
export function change(cur: number, prev: number | null | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
}

/** One computed range per month for the P&L (demo data in demo mode). */
export async function getMonthly(sp: Record<string, string | undefined>) {
  const { choosePeriods } = await import("./pnl");
  if (isDemo()) {
    const { demoRange, demoShop } = await import("./demo");
    const today = "2026-09-30";
    const choice = choosePeriods(today, sp);
    return { shop: demoShop, today, demo: true, choice, cols: choice.periods.map((period) => ({ period, data: demoRange(period.from, period.to) })) };
  }
  const shop = await getShop();
  const today = localDate(new Date(), shop.timezone);
  const choice = choosePeriods(today, sp);
  const data = await Promise.all(choice.periods.map((p) => computeRange(shop, p.from, p.to)));
  return { shop, today, demo: false, choice, cols: choice.periods.map((period, i) => ({ period, data: data[i] })) };
}
