// Daily exchange rates for converting ad spend into the store's currency.
// Source: European Central Bank reference rates via Frankfurter (free, no key). The ECB
// publishes on working days only, so weekends and holidays use the last published rate.
// It covers ~30 major currencies (USD, EUR, GBP, ZAR, INR, AUD, CAD...), not AED or NGN.

import { addDays, daysBetween } from "./dates";

const BASE_URL = process.env.FX_API_URL ?? "https://api.frankfurter.dev/v1";

interface SeriesResponse {
  rates?: Record<string, Record<string, number>>;
}

/** Fills every day in [from, to] with the latest rate published on or before it. */
export function fillDaily(published: Record<string, number>, from: string, to: string): Map<string, number> {
  const known = Object.keys(published).sort();
  const out = new Map<string, number>();
  let i = 0;
  let last: number | undefined;
  for (const d of daysBetween(from, to)) {
    while (i < known.length && known[i] <= d) last = published[known[i++]];
    if (last != null) out.set(d, last);
  }
  return out;
}

/** Rate to multiply `from`-currency amounts by to get `to`-currency amounts, for each day. */
export async function dailyRates(fromCcy: string, toCcy: string, from: string, to: string): Promise<Map<string, number>> {
  if (fromCcy === toCcy) return new Map(daysBetween(from, to).map((d) => [d, 1]));
  // Start a week early so a range that opens on a weekend still has a rate.
  const url = `${BASE_URL}/${addDays(from, -7)}..${to}?base=${fromCcy}&symbols=${toCcy}`;
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as SeriesResponse;
  if (!res.ok || !body.rates) throw new Error(`Exchange rates ${fromCcy}→${toCcy} unavailable (${res.status})`);
  const published: Record<string, number> = {};
  for (const [d, r] of Object.entries(body.rates)) if (r[toCcy] != null) published[d] = r[toCcy];
  if (Object.keys(published).length === 0)
    throw new Error(`No ECB rate for ${fromCcy}→${toCcy}; this currency pair isn't supported yet`);
  const filled = fillDaily(published, from, to);
  // Days after the latest publication (e.g. today before 16:00 CET) use the latest rate.
  const latest = published[Object.keys(published).sort().pop()!];
  for (const d of daysBetween(from, to)) if (!filled.has(d)) filled.set(d, latest);
  return filled;
}
