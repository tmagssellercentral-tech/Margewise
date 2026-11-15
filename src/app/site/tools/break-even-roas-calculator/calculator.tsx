"use client";

import { useState } from "react";

const n = (v: string) => { const x = Number(v.replace(/[\s,]/g, "")); return Number.isFinite(x) && x >= 0 ? x : 0; };

/**
 * Break-even ROAS for an average order: price (without tax) ÷ what's left of it after product
 * and order costs. Below that ROAS, each ad-driven sale loses money.
 */
export function Calculator() {
  const [f, setF] = useState({ price: "60", cost: "21", shipping: "6", feePct: "2.9", feeFixed: "0.30", other: "1.5" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const price = n(f.price);
  const fees = (price * n(f.feePct)) / 100 + n(f.feeFixed);
  const costs = n(f.cost) + n(f.shipping) + fees + n(f.other);
  const margin = price - costs;
  const ok = price > 0 && margin > 0;
  const be = ok ? price / margin : null;
  const m = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const field = (k: keyof typeof f, label: string, hint: string, step = "0.01") => (
    <label>{label}<small>{hint}</small><input inputMode="decimal" type="number" min="0" step={step} value={f[k]} onChange={set(k)} /></label>
  );

  return (
    <div className="calc">
      <form onSubmit={(e) => e.preventDefault()} aria-label="Your average order">
        {field("price", "Average order value", "What a customer pays, without VAT or sales tax")}
        {field("cost", "Product cost per order", "What the items cost you")}
        {field("shipping", "Shipping cost per order", "What you pay the courier, minus what the customer pays for shipping")}
        {field("feePct", "Payment fee (%)", "Shopify Payments, Stripe and PayPal are usually 2.9% to 3.5%", "0.1")}
        {field("feeFixed", "Payment fee per order", "The fixed part, often 0.30")}
        {field("other", "Packaging and other costs per order", "Boxes, inserts, returns allowance")}
      </form>
      <div className="out" aria-live="polite">
        <div>
          <p>Your break-even ROAS</p>
          <div className="big num">{be ? `${be.toFixed(2)}x` : "–"}</div>
        </div>
        <p>
          {be
            ? <>Every ad dollar has to bring back at least <b>${m(be)}</b> in sales just to break even. Campaigns below {be.toFixed(2)}x lose money on each order, even if they look busy.</>
            : "Your costs are higher than the order value, so no ROAS breaks even. Lower costs or raise prices first."}
        </p>
        <div className="rows num">
          <div><span>Order value</span><b>{m(price)}</b></div>
          <div><span>Product, shipping, fees and other costs</span><b>−{m(costs)}</b></div>
          <div><span>Left to spend on ads (break-even)</span><b>{m(Math.max(margin, 0))}</b></div>
          <div><span>Contribution margin</span><b>{price ? `${((Math.max(margin, 0) / price) * 100).toFixed(1)}%` : "–"}</b></div>
        </div>
      </div>
    </div>
  );
}
