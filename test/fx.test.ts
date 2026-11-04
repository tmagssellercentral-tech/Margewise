import { afterEach, describe, expect, it, vi } from "vitest";
import { dailyRates, fillDaily } from "../src/lib/fx";

describe("exchange rates", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("carries Friday's rate over the weekend", () => {
    const m = fillDaily({ "2026-10-02": 17.5, "2026-10-05": 17.8 }, "2026-10-02", "2026-10-05");
    expect([...m.values()]).toEqual([17.5, 17.5, 17.5, 17.8]);
  });

  it("is 1 for the same currency without calling out", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    const m = await dailyRates("ZAR", "ZAR", "2026-10-01", "2026-10-02");
    expect([...m.values()]).toEqual([1, 1]);
    expect(f).not.toHaveBeenCalled();
  });

  it("starts a week early and fills days after the last publication", async () => {
    let url = "";
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      url = u;
      return new Response(JSON.stringify({ rates: { "2026-09-30": { ZAR: 17.2 }, "2026-10-02": { ZAR: 17.4 } } }));
    }));
    const m = await dailyRates("USD", "ZAR", "2026-10-03", "2026-10-05");
    expect(url).toContain("/2026-09-26..2026-10-05?base=USD&symbols=ZAR");
    expect([...m.entries()]).toEqual([["2026-10-03", 17.4], ["2026-10-04", 17.4], ["2026-10-05", 17.4]]);
  });

  it("explains an unsupported currency", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ rates: { "2026-10-01": {} } }))));
    await expect(dailyRates("AED", "ZAR", "2026-10-01", "2026-10-02")).rejects.toThrow(/isn't supported/);
  });
});
