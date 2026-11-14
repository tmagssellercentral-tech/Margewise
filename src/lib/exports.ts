// Turns a report into a downloadable table (CSV or Excel). Each sheet lists typed columns so
// Excel gets real numbers with currency and percentage formats, not text.

import ExcelJS from "exceljs";
import { buildPnl, type PnlRow } from "./pnl";
import { getMonthly, getReport } from "./report";

export type ColType = "text" | "date" | "int" | "money" | "pct" | "ratio";
export interface Sheet {
  name: string;
  currency: string;
  title: string;
  subtitle: string;
  columns: { key: string; label: string; type: ColType }[];
  rows: Record<string, string | number | null>[];
  bold?: Set<number>; // row indexes to emphasise (P&L subtotals)
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function buildSheet(kind: string, sp: Record<string, string | undefined>): Promise<Sheet> {
  if (kind === "pnl") {
    const { shop, cols } = await getMonthly(sp);
    const rows = buildPnl(cols.map((c) => ({ period: c.period, total: c.data.total, platforms: c.data.platforms, fixedCosts: c.data.fixedCosts, config: c.data.config, attributed: c.data.campaigns.reduce((s, x) => s + x.purchaseValue, 0) })));
    const keys = [...cols.map((c) => c.period.key), "total"];
    const bold = new Set<number>();
    const out = rows.map((r: PnlRow, i) => {
      if (r.kind === "subtotal" || r.kind === "total" || r.kind === "heading") bold.add(i);
      const o: Record<string, string | number | null> = { line: r.label };
      keys.forEach((k, j) => {
        const v = r.values.at(j);
        o[k] = r.kind === "heading" || v == null ? null : r.kind === "ratio" ? v : r.kind === "memo" && (r.key === "mer" || r.key === "blended-roas") ? r2(v) : r2(r.negative ? -v : v);
      });
      o.kind = r.kind;
      return o;
    });
    return {
      name: "P&L", currency: shop.currency,
      title: `${shop.name}: profit and loss`,
      subtitle: `${cols[0].period.label} to ${cols.at(-1)!.period.label} · ${shop.currency} · costs shown as negatives`,
      columns: [{ key: "line", label: "", type: "text" }, ...cols.map((c) => ({ key: c.period.key, label: c.period.label, type: "money" as ColType })), { key: "total", label: "Total", type: "money" }],
      rows: out,
      bold,
    };
  }

  const { shop, range, cur } = await getReport(sp, "30d", false);
  const span = `${range.from} to ${range.to} · ${shop.currency}`;

  if (kind === "products") {
    return {
      name: "Products", currency: shop.currency, title: `${shop.name}: profit by product`, subtitle: `${span} · profit is before ads and fixed costs`,
      columns: [
        { key: "sku", label: "SKU", type: "text" }, { key: "title", label: "Product", type: "text" }, { key: "units", label: "Units", type: "int" },
        { key: "netRevenue", label: "Net revenue", type: "money" }, { key: "cogs", label: "Product cost", type: "money" },
        { key: "profit", label: "Profit", type: "money" }, { key: "margin", label: "Margin", type: "pct" }, { key: "perUnit", label: "Profit per unit", type: "money" },
      ],
      rows: cur.products.map((p) => ({
        sku: p.sku, title: p.title ?? p.sku, units: p.units, netRevenue: r2(p.netRevenue), cogs: r2(p.cogs), profit: r2(p.contribution),
        margin: p.netRevenue ? p.contribution / p.netRevenue : null, perUnit: p.units ? r2(p.contribution / p.units) : null,
      })),
    };
  }

  if (kind === "orders") {
    return {
      name: "Orders", currency: shop.currency, title: `${shop.name}: profit by order`, subtitle: `${span} · contribution is before ads and fixed costs`,
      columns: [
        { key: "order", label: "Order", type: "text" }, { key: "date", label: "Date", type: "date" }, { key: "paid", label: "Paid (incl VAT)", type: "money" },
        { key: "netRevenue", label: "Net revenue", type: "money" }, { key: "cogs", label: "Product cost", type: "money" },
        { key: "fees", label: "Payment fees", type: "money" }, { key: "courier", label: "Courier", type: "money" },
        { key: "packaging", label: "Packaging", type: "money" }, { key: "returns", label: "Returns", type: "money" },
        { key: "contribution", label: "Contribution", type: "money" }, { key: "margin", label: "Margin", type: "pct" },
        { key: "missing", label: "SKUs missing a cost", type: "text" },
      ],
      rows: [...cur.results].sort((a, b) => b.localDate.localeCompare(a.localDate)).map((o) => ({
        order: o.name, date: o.localDate, paid: r2(o.totalIncl), netRevenue: r2(o.netRevenue), cogs: r2(o.cogs), fees: r2(o.paymentFee),
        courier: r2(o.courier), packaging: r2(o.packaging), returns: r2(o.returnsCost), contribution: r2(o.contribution),
        margin: o.netRevenue ? o.contribution / o.netRevenue : null, missing: o.missingCostSkus.join(", ") || null,
      })),
    };
  }

  // Overview: one row per day.
  return {
    name: "Daily", currency: shop.currency, title: `${shop.name}: daily profit`, subtitle: span,
    columns: [
      { key: "date", label: "Date", type: "date" }, { key: "orders", label: "Orders", type: "int" },
      { key: "revenueIncl", label: "Sales (incl VAT)", type: "money" }, { key: "netRevenue", label: "Net revenue", type: "money" },
      { key: "cogs", label: "Product cost", type: "money" }, { key: "paymentFees", label: "Payment fees", type: "money" },
      { key: "courier", label: "Courier", type: "money" }, { key: "packaging", label: "Packaging", type: "money" },
      { key: "returnsCost", label: "Returns", type: "money" }, { key: "contribution", label: "Contribution", type: "money" },
      { key: "adSpend", label: "Ad spend", type: "money" }, { key: "profitAfterAds", label: "Profit after ads", type: "money" },
      { key: "fixedCosts", label: "Fixed costs", type: "money" }, { key: "netProfit", label: "Net profit", type: "money" },
    ],
    rows: cur.daily.map((d) => ({
      date: d.date, orders: d.orders, revenueIncl: r2(d.revenueIncl), netRevenue: r2(d.netRevenue), cogs: r2(d.cogs), paymentFees: r2(d.paymentFees),
      courier: r2(d.courier), packaging: r2(d.packaging), returnsCost: r2(d.returnsCost), contribution: r2(d.contribution),
      adSpend: r2(d.adSpend), profitAfterAds: r2(d.profitAfterAds), fixedCosts: r2(d.fixedCosts), netProfit: r2(d.netProfit),
    })),
  };
}

const csvCell = (v: string | number | null) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(s: Sheet): string {
  const head = s.columns.map((c) => csvCell(c.type === "pct" ? `${c.label} (%)` : c.label || "Line"));
  const body = s.rows.map((r) => s.columns.map((c, j) => {
    const v = r[c.key];
    if (j === 0 && r.kind === "ratio" && typeof v === "string") return csvCell(`${v} (%)`);
    if (v == null) return "";
    if (typeof v === "number" && (c.type === "pct" || (s.name === "P&L" && r.kind === "ratio"))) return (Math.round(v * 1000) / 10).toString();
    return csvCell(v);
  }).join(","));
  // BOM so Excel opens the file as UTF-8.
  return "﻿" + [head.join(","), ...body].join("\r\n") + "\r\n";
}

export async function toXlsx(s: Sheet): Promise<Buffer> {
  const ccy = s.currency;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Margewise";
  const ws = wb.addWorksheet(s.name, { views: [{ state: "frozen", ySplit: 4, xSplit: s.name === "P&L" ? 1 : 0 }] });
  const { sym } = await import("@/app/components/ui");
  const money = `"${sym(ccy)}"#,##0.00;[Red]-"${sym(ccy)}"#,##0.00`;
  ws.addRow([s.title]).font = { bold: true, size: 14 };
  ws.addRow([s.subtitle]).font = { color: { argb: "FF5D6A63" } };
  ws.addRow([]);
  const header = ws.addRow(s.columns.map((c) => c.label));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F6B4F" } }; });
  s.rows.forEach((r, i) => {
    const row = ws.addRow(s.columns.map((c) => {
      const v = r[c.key];
      return c.type === "date" && typeof v === "string" ? new Date(`${v}T00:00:00Z`) : v;
    }));
    s.columns.forEach((c, j) => {
      const cell = row.getCell(j + 1);
      const ratioRow = s.name === "P&L" && r.kind === "ratio";
      const merRow = s.name === "P&L" && r.kind === "memo";
      cell.numFmt = ratioRow || c.type === "pct" ? "0.0%" : merRow ? "#,##0.00" : c.type === "money" ? money : c.type === "int" ? "#,##0" : c.type === "date" ? "yyyy-mm-dd" : "@";
    });
    if (s.bold?.has(i)) row.font = { bold: true };
    if (r.kind === "total") row.eachCell((cell) => { cell.border = { top: { style: "thin" }, bottom: { style: "double" } }; });
  });
  s.columns.forEach((c, j) => {
    ws.getColumn(j + 1).width = c.type === "text" ? (s.name === "P&L" && j === 0 ? 38 : 28) : c.type === "date" ? 12 : 16;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
