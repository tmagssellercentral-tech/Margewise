// The daily profit email: yesterday's net profit and the numbers behind it, sent each morning in the
// store's own time zone to the addresses the store chose in Settings → Daily email. Sent through
// Resend (RESEND_API_KEY, EMAIL_FROM). Every email carries a one-click unsubscribe link.

import { db, type Shop } from "./db";
import { addDays, localDate } from "./dates";
import { computeRange } from "./sync";
import { makeState } from "./meta-connect";
import { platformName } from "./platforms";
import { fmt, pct, x } from "../app/components/ui";

/** Local hour (store time zone) from which the email goes out. */
export const SEND_HOUR = 7;
export const MAX_RECIPIENTS = 5;
const APP = () => process.env.APP_URL ?? "https://app.margewise.io";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;

/** Splits a typed list of addresses (commas, spaces or new lines) and rejects anything that isn't one. */
export function parseRecipients(raw: string): string[] {
  const list = [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
  const bad = list.filter((e) => !EMAIL_RE.test(e));
  if (bad.length) throw new Error(`Not an email address: ${bad.slice(0, 3).join(", ")}`);
  if (list.length > MAX_RECIPIENTS) throw new Error(`Up to ${MAX_RECIPIENTS} addresses`);
  return list;
}

/** The hour of day in a time zone, 0–23. */
export function localHour(now: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
}

/** Whether a store's email is due: past the send hour locally, and not yet sent for today. */
export function isDue(now: Date, timeZone: string, lastSent: string | null): boolean {
  const today = localDate(now, timeZone);
  return localHour(now, timeZone) >= SEND_HOUR && (!lastSent || lastSent < today);
}

const dayLabel = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function dashboardUrl(shop: Shop, tab?: string) {
  const handle = shop.myshopify_domain?.replace(/\.myshopify\.com$/, "");
  const app = process.env.SHOPIFY_APP_HANDLE ?? "margewise-1";
  if (!handle) return `${APP()}${tab ? `/settings?tab=${tab}` : "/"}`;
  return `https://admin.shopify.com/store/${handle}/apps/${app}${tab ? `/settings?tab=${tab}` : ""}`;
}

export const unsubscribeUrl = (shopId: string) => `${APP()}/api/email/unsubscribe?t=${encodeURIComponent(makeState(shopId, 120 * 86400))}`;

type Range = Awaited<ReturnType<typeof computeRange>>;

export interface DailyEmail { subject: string; html: string; text: string; empty: boolean }

/** Builds the email for one day from the same numbers the dashboard shows. */
export function renderDailyEmail(shop: Shop, day: string, d: Range, lastWeek: Range, mtd: Range, unsubscribe: string): DailyEmail {
  const ccy = shop.currency;
  const m = (n: number) => fmt(ccy, n);
  const t = d.total;
  const mer = t.adSpend ? t.revenueIncl / t.adSpend : null;
  const lw = lastWeek.total.netProfit;
  const vsLw = lastWeek.total.orders || lastWeek.total.adSpend ? t.netProfit - lw : null;
  const margin = t.netRevenue ? t.netProfit / t.netRevenue : null;
  const empty = t.orders === 0 && t.adSpend === 0;
  const profitColor = t.netProfit >= 0 ? "#0f6b4f" : "#b4372b";

  const subject = empty
    ? `${shop.name}: no orders or ad spend yesterday`
    : `${shop.name}: ${m(t.netProfit)} net profit yesterday on ${t.orders} order${t.orders === 1 ? "" : "s"}`;

  const rows: [string, string][] = [
    ["Revenue", m(t.revenueIncl)],
    ["Orders", String(t.orders)],
    ["Product costs", m(t.cogs)],
    ["Payment fees", m(t.paymentFees)],
    ["Shipping and packaging", m(t.courier + t.packaging)],
    ["Returns", m(t.returnsCost)],
    ["Ad spend", m(t.adSpend)],
    ["Fixed costs", m(t.fixedCosts)],
  ];
  const adLine = t.adSpend
    ? `MER ${x(mer)} against a break-even ROAS of ${x(t.breakEvenRoas)}: ${mer != null && t.breakEvenRoas != null && mer >= t.breakEvenRoas ? "ads paid for themselves." : "ads cost more than they brought in."}`
    : null;
  const products = d.products.slice(0, 3);
  const platforms = d.platforms.filter((p) => p.adCost > 0);
  const missing = t.missingCostSkus.length;

  const cell = "padding:7px 0;border-bottom:1px solid #e6ebe7;font-size:14px";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f5f7f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#10201b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0c3b2e;padding:18px 24px;color:#ffffff;font-size:15px"><b>Margewise</b> <span style="color:#8be3bc">daily profit</span></td></tr>
<tr><td style="padding:24px 24px 8px">
<div style="font-size:13px;color:#5b6a63">${esc(shop.name)}, ${esc(dayLabel(day))}</div>
${empty
    ? `<div style="font-size:22px;font-weight:700;margin-top:8px">No orders and no ad spend yesterday.</div>`
    : `<div style="font-size:13px;color:#5b6a63;margin-top:14px">Net profit</div>
<div style="font-size:36px;font-weight:800;color:${profitColor};line-height:1.15">${esc(m(t.netProfit))}</div>
<div style="font-size:13px;color:#5b6a63;margin-top:4px">${margin != null ? `${pct(margin)} of net revenue. ` : ""}${vsLw != null ? `${vsLw >= 0 ? "Up" : "Down"} ${esc(m(Math.abs(vsLw)))} on the same day last week.` : ""}</div>`}
</td></tr>
${empty ? "" : `<tr><td style="padding:8px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.map(([k, v]) => `<tr><td style="${cell};color:#39443e">${k}</td><td align="right" style="${cell};font-weight:600">${esc(v)}</td></tr>`).join("")}</table>
${adLine ? `<p style="font-size:14px;line-height:1.5;margin:14px 0 0">${esc(adLine)}</p>` : ""}
${platforms.length ? `<p style="font-size:13px;color:#5b6a63;margin:6px 0 0">${platforms.map((p) => `${esc(platformName(p.platform))} ${esc(m(p.adCost))}`).join(", ")}</p>` : ""}
</td></tr>`}
${products.length ? `<tr><td style="padding:16px 24px 0"><div style="font-size:15px;font-weight:700;margin-bottom:4px">Most profitable products</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${products.map((p) => `<tr><td style="${cell};color:#39443e">${esc(p.title ?? p.sku)} <span style="color:#7a8781">× ${p.units}</span></td><td align="right" style="${cell};font-weight:600">${esc(m(p.contribution))}</td></tr>`).join("")}</table>
<div style="font-size:12px;color:#7a8781;margin-top:4px">Profit after product costs, fees and shipping, before ads.</div></td></tr>` : ""}
<tr><td style="padding:16px 24px 0"><div style="background:#eef6f1;border-radius:10px;padding:12px 14px;font-size:14px">This month so far: <b>${esc(m(mtd.total.netProfit))}</b> net profit on ${esc(m(mtd.total.revenueIncl))} revenue</div></td></tr>
${missing ? `<tr><td style="padding:12px 24px 0"><div style="background:#fff4e0;border-radius:10px;padding:12px 14px;font-size:13px">${missing} product${missing === 1 ? " has" : "s have"} no cost, so profit is overstated. <a href="${esc(dashboardUrl(shop, "products"))}" style="color:#0f6b4f">Add costs</a></div></td></tr>` : ""}
<tr><td style="padding:20px 24px 24px"><a href="${esc(dashboardUrl(shop))}" style="display:inline-block;background:#0f6b4f;color:#ffffff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:8px;font-size:14px">Open Margewise</a></td></tr>
</table>
<p style="font-size:12px;color:#7a8781;max-width:560px;line-height:1.5;margin:14px auto 0">Amounts in ${esc(ccy)}, by order date in your store's time zone. Ad spend for the day can still change slightly as platforms finalise it.<br>
<a href="${esc(dashboardUrl(shop, "email"))}" style="color:#7a8781">Change recipients</a> · <a href="${esc(unsubscribe)}" style="color:#7a8781">Unsubscribe</a></p>
</td></tr></table></body></html>`;

  const text = [
    `${shop.name}, ${dayLabel(day)}`,
    empty ? "No orders and no ad spend yesterday." : `Net profit: ${m(t.netProfit)}${margin != null ? ` (${pct(margin)} of net revenue)` : ""}`,
    ...(empty ? [] : rows.map(([k, v]) => `${k}: ${v}`)),
    ...(adLine ? [adLine] : []),
    ...(products.length ? ["", "Most profitable products:", ...products.map((p) => `- ${p.title ?? p.sku} x ${p.units}: ${m(p.contribution)}`)] : []),
    "",
    `This month so far: ${m(mtd.total.netProfit)} net profit on ${m(mtd.total.revenueIncl)} revenue`,
    ...(missing ? [`${missing} product(s) have no cost, so profit is overstated.`] : []),
    "",
    `Open Margewise: ${dashboardUrl(shop)}`,
    `Unsubscribe: ${unsubscribe}`,
  ].join("\n");

  return { subject, html, text, empty };
}

export async function buildDailyEmail(shop: Shop, day: string): Promise<DailyEmail> {
  const [d, lastWeek, mtd] = await Promise.all([
    computeRange(shop, day, day),
    computeRange(shop, addDays(day, -7), addDays(day, -7)),
    computeRange(shop, `${day.slice(0, 8)}01`, day),
  ]);
  return renderDailyEmail(shop, day, d, lastWeek, mtd, unsubscribeUrl(shop.id));
}

export async function sendEmail(to: string[], mail: DailyEmail, unsubscribe: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email sending isn't set up yet (RESEND_API_KEY)");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Margewise <reports@margewise.io>",
      reply_to: "support@margewise.io",
      to, subject: mail.subject, html: mail.html, text: mail.text,
      headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Email send failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

/** Sends one store's email for yesterday (store time) and records it. */
export async function sendFor(shop: Shop, recipients: string[], now = new Date(), opts: { test?: boolean } = {}) {
  const yesterday = addDays(localDate(now, shop.timezone), -1);
  const mail = await buildDailyEmail(shop, yesterday);
  if (mail.empty && !opts.test) return { skipped: "nothing to report" };
  const unsubscribe = unsubscribeUrl(shop.id);
  await sendEmail(recipients, opts.test ? { ...mail, subject: `[Test] ${mail.subject}` } : mail, unsubscribe);
  return { sent: recipients.length, day: yesterday };
}

/** Run every hour: sends to each store whose morning has arrived and hasn't had today's email. */
export async function sendDueReports(now = new Date(), budgetMs = 240_000) {
  const started = Date.now();
  const { data, error } = await db().from("email_reports").select("shop_id, recipients, last_sent_date, shops(*)").eq("enabled", true);
  if (error) throw new Error(error.message);
  const out: Record<string, unknown>[] = [];
  for (const r of data ?? []) {
    const row = r.shops as unknown as (Shop & { uninstalled_at?: string | null }) | null;
    if (!row || row.uninstalled_at || !r.recipients?.length) continue;
    const shop = { ...row, vat_rate: Number(row.vat_rate) } as Shop;
    if (!isDue(now, shop.timezone, r.last_sent_date)) continue;
    if (Date.now() - started > budgetMs) { out.push({ shop: shop.name, skipped: "out of time" }); continue; }
    const today = localDate(now, shop.timezone);
    try {
      // App Store stores: pull yesterday's final orders and ad spend before reporting on it.
      if (!shop.is_owner) {
        const { refreshDays } = await import("./onboarding");
        await refreshDays(shop, addDays(today, -1), today).catch(() => null);
      }
      const res = await sendFor(shop, r.recipients, now);
      await db().from("email_reports").update({ last_sent_date: today, last_error: null }).eq("shop_id", shop.id);
      out.push({ shop: shop.name, ...res });
    } catch (e) {
      await db().from("email_reports").update({ last_error: String(e).slice(0, 300) }).eq("shop_id", shop.id);
      out.push({ shop: shop.name, error: String(e) });
    }
  }
  return out;
}
