import { describe, expect, it } from "vitest";
import { courierRows, parseAmount, parseCsv, parseDate, spendRows } from "../src/lib/csv";

describe("CSV parsing", () => {
  it("handles quotes, semicolons, BOM and header case", () => {
    expect(parseCsv('﻿Date;"Campaign Name";Spend\r\n2026-10-01;"Brand; search";"1 234,50"\r\n')).toEqual([
      { date: "2026-10-01", campaign_name: "Brand; search", spend: "1 234,50" },
    ]);
  });
  it("reads amounts in common formats", () => {
    expect(parseAmount("R1,234.56")).toBe(1234.56);
    expect(parseAmount("1 234,56")).toBe(1234.56);
    expect(parseAmount("$12")).toBe(12);
    expect(parseAmount("1.234")).toBe(1.234);
    expect(parseAmount("")).toBeNull();
  });
  it("reads ISO and day-first dates", () => {
    expect(parseDate("2026-10-05")).toBe("2026-10-05");
    expect(parseDate("05/10/2026")).toBe("2026-10-05");
    expect(parseDate("Oct 5")).toBeNull();
  });
  it("turns an ad-spend export into rows and reports bad lines", () => {
    const { rows, skipped } = spendRows("date,platform,campaign,spend,revenue,currency\n2026-10-01,Microsoft Ads,Brand,100,450,usd\nbad,x,y,z,,\n");
    expect(rows).toEqual([{ date: "2026-10-01", platform: "microsoft_ads", campaign: "Brand", spend: 100, conversionValue: 450, currency: "USD" }]);
    expect(skipped).toEqual([3]);
  });
  it("matches courier invoices by order number with or without #", () => {
    const { rows } = courierRows("Reference,Amount\n#1052,R 98.40\n1053,350\n");
    expect(rows).toEqual([{ order: "1052", cost: 98.4 }, { order: "1053", cost: 350 }]);
  });
});
