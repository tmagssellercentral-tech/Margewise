"use client";

import { useState } from "react";

export interface PlanCard {
  key: string;
  name: string;
  forWho: string;
  monthly: number;
  annual: number | null;
  orders: string;
  features: string[];
  inherit?: string;
  pick?: boolean;
}

export function Plans({ plans, ctaHref, ctaLabel }: { plans: PlanCard[]; ctaHref: string; ctaLabel: string }) {
  const [yearly, setYearly] = useState(true);
  return (
    <>
      <div className="billing" role="group" aria-label="Billing period">
        <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
        <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly <em>save 20%</em></button>
      </div>
      <div className="plans">
        {plans.map((p) => {
          const perMonth = yearly && p.annual ? p.annual / 12 : p.monthly;
          const shown = perMonth % 1 ? perMonth.toFixed(2) : String(perMonth);
          return (
            <div key={p.key} className={`plan${p.pick ? " pick" : ""}`}>
              {p.pick && <span className="flag">Most stores pick this</span>}
              <h3>{p.name}</h3>
              <p className="for">{p.forWho}</p>
              <p className="price num">${shown}<small> /month</small></p>
              <p className="billed num">{p.monthly === 0 ? "Free forever" : yearly && p.annual ? `$${p.annual.toLocaleString("en-US")} billed yearly` : "Billed monthly"}</p>
              <p className="orders num">{p.orders}</p>
              <ul>
                {p.inherit && <li className="inherit">{p.inherit}</li>}
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <a className={`btn ${p.pick ? "primary" : "ghost"}`} href={ctaHref}>{p.monthly === 0 ? "Start free" : ctaLabel}</a>
            </div>
          );
        })}
      </div>
    </>
  );
}
