import { beforeAll, describe, expect, it } from "vitest";
import { makeState, readState } from "../src/lib/meta-connect";

describe("Meta sign-in state", () => {
  beforeAll(() => { process.env.TOKEN_ENC_KEY = Buffer.alloc(32, 3).toString("base64"); });
  it("round-trips the store id", () => {
    expect(readState(makeState("shop-123"))).toBe("shop-123");
  });
  it("rejects tampered, expired and missing state", () => {
    const s = makeState("shop-123");
    const [body, sig] = s.split(".");
    const forged = Buffer.from(JSON.stringify({ s: "other-shop", e: 9e9, n: "x" })).toString("base64url");
    expect(readState(`${forged}.${sig}`)).toBeNull();
    expect(readState(`${body}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(readState(makeState("shop-123", -10))).toBeNull();
    expect(readState(null)).toBeNull();
    expect(readState("garbage")).toBeNull();
  });
});
