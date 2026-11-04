// CSV parsing for uploads: ad spend from platforms without a connector, and courier invoices.
// Accepts comma, semicolon or tab separators, quoted fields, and headers in any order or case.

export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.split("\n", 1)[0] ?? "";
  const sep = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/** "1 234,56", "R1,234.56", "$12" → number. Comma is a decimal point only when it's the last separator with 1–2 digits after it. */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[^\d.,\-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot && /,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const pick = (r: Record<string, string>, names: string[]) => {
  for (const n of names) if (r[n] != null && r[n] !== "") return r[n];
  return "";
};

export interface SpendRow {
  date: string;
  platform: string;
  campaign: string;
  spend: number;
  conversionValue: number;
  currency: string | null;
}

export function spendRows(text: string): { rows: SpendRow[]; skipped: number[] } {
  const rows: SpendRow[] = [];
  const skipped: number[] = [];
  parseCsv(text).forEach((r, i) => {
    const date = parseDate(pick(r, ["date", "day", "reporting_starts", "time_period"]));
    const spend = parseAmount(pick(r, ["spend", "cost", "amount_spent", "amount", "spend_amount"]));
    const platform = pick(r, ["platform", "channel", "source"]).toLowerCase().replace(/[^a-z0-9]+/g, "_") || "other";
    if (!date || spend == null) return skipped.push(i + 2); // +2: header row and 1-based lines
    rows.push({
      date,
      platform,
      campaign: pick(r, ["campaign", "campaign_name", "name"]) || "(no campaign)",
      spend,
      conversionValue: parseAmount(pick(r, ["conversion_value", "revenue", "purchase_value", "conv_value", "conversions_value"])) ?? 0,
      currency: pick(r, ["currency", "currency_code"]).toUpperCase() || null,
    });
  });
  return { rows, skipped };
}

export function courierRows(text: string): { rows: { order: string; cost: number }[]; skipped: number[] } {
  const rows: { order: string; cost: number }[] = [];
  const skipped: number[] = [];
  parseCsv(text).forEach((r, i) => {
    const order = pick(r, ["order", "order_number", "order_name", "reference", "customer_reference", "ref"]).replace(/^#/, "");
    const cost = parseAmount(pick(r, ["cost", "amount", "total", "charge", "price", "shipping_cost"]));
    if (!order || cost == null) return skipped.push(i + 2);
    rows.push({ order, cost });
  });
  return { rows, skipped };
}
