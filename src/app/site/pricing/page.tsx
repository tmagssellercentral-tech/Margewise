import Link from "next/link";
import { Fragment } from "react";
import { cta } from "../brand";
import { PLAN_CARDS } from "../plan-data";
import { Plans } from "../plans";
import { crumbsLd, faqLd, JsonLd, pageMeta } from "../seo";

export const metadata = pageMeta(
  "/pricing",
  "Pricing: Shopify profit tracking from $0",
  "Margewise pricing: free up to 100 orders a month, then from $29 a month by order volume. Every plan includes net profit, P&L, product profit and Meta, Google, TikTok, Pinterest and Snapchat ad tracking. 14-day free trial, 20% off yearly.",
);

const Y = <span className="yes" aria-label="Included">✓</span>;
const N = <span className="no" aria-label="Not included">–</span>;

const ROWS: [string, ...(React.ReactNode)[]][] = [
  ["Orders per month", "100", "500", "1,500", "5,000"],
];
const GROUPS: { name: string; rows: [string, boolean, boolean, boolean, boolean][] }[] = [
  { name: "Profit", rows: [
    ["Net profit after every cost", true, true, true, true],
    ["Monthly profit & loss", true, true, true, true],
    ["Product profit by SKU", true, true, true, true],
    ["Fixed costs and overheads", true, true, true, true],
    ["Excel and CSV exports", true, true, true, true],
  ] },
  { name: "Costs", rows: [
    ["Actual Shopify Payments fees", true, true, true, true],
    ["Gateway fee packs for 10 regions", true, true, true, true],
    ["Shipping by destination and parcel size", true, true, true, true],
    ["Returns, packaging, VAT and sales tax", true, true, true, true],
    ["Daily currency conversion", true, true, true, true],
  ] },
  { name: "Ads", rows: [
    ["Meta, Google, TikTok, Pinterest and Snapchat connections", true, true, true, true],
    ["CSV upload for any other channel", true, true, true, true],
    ["MER, blended ROAS, break-even ROAS, POAS", true, true, true, true],
    ["Each platform against break-even", true, true, true, true],
    ["Each campaign against break-even", false, false, true, true],
  ] },
  { name: "Customers", rows: [
    ["Customer acquisition cost (CAC)", false, true, true, true],
    ["New vs returning customers", false, true, true, true],
    ["Repeat purchase rate", false, false, true, true],
    ["Lifetime value and LTV:CAC", false, false, true, true],
  ] },
];

const FAQS = [
  { q: "Is there a free trial?", a: "Yes. Every paid plan starts with a 14-day free trial, and the Free plan has no time limit." },
  { q: "What counts as an order?", a: "Each order your Shopify store takes in a calendar month, from your online store, point of sale or draft orders." },
  { q: "What happens if I go over my plan's orders?", a: "Margewise keeps syncing every order and shows a notice suggesting the plan that fits. On the Free plan, the overview is locked above 100 orders until you upgrade." },
  { q: "How am I billed?", a: "Through Shopify, on the same invoice as your other apps. You can change or cancel your plan at any time from your Shopify admin." },
  { q: "Are development stores free?", a: "Yes. Shopify development and test stores can use every feature free." },
  { q: "What if I have more than 5,000 orders a month?", a: "Email support@margewise.io about the Plus plan, sized to your volume." },
];

export default function Pricing() {
  return (
    <main>
      <JsonLd data={faqLd(FAQS)} />
      <JsonLd data={crumbsLd([["Home", "/"], ["Pricing", "/pricing"]])} />
      <section className="ph">
        <div className="wrap">
          <p className="crumbs"><Link href="/">Home</Link> / Pricing</p>
          <h1>Simple pricing that grows with your orders</h1>
          <p className="lead">Every plan includes true profit, the P&amp;L, product profit and ad tracking against break-even. Higher plans add customer metrics and more orders.</p>
        </div>
      </section>
      <section style={{ paddingBottom: 72 }}>
        <div className="wrap">
          <Plans plans={PLAN_CARDS} ctaHref={cta.href} ctaLabel="Start 14-day trial" />
          <p className="plans-note">Prices in US dollars, billed by Shopify. Yearly plans save 20%.</p>
        </div>
      </section>
      <section className="sec white">
        <div className="wrap">
          <div className="sec-head"><h2>Compare plans</h2></div>
          <div className="scroll-x">
            <table className="compare">
              <thead><tr><th scope="col">Feature</th>{PLAN_CARDS.map((p) => <th key={p.key} scope="col">{p.name}</th>)}</tr></thead>
              <tbody>
                {ROWS.map(([label, ...cells]) => (
                  <tr key={label}><th scope="row">{label}</th>{cells.map((c, i) => <td key={i} className="num"><b>{c}</b></td>)}</tr>
                ))}
                {GROUPS.map((g) => (
                  <Fragment key={g.name}>
                    <tr className="grp"><td colSpan={5}>{g.name}</td></tr>
                    {g.rows.map(([label, ...on]) => (
                      <tr key={label}><th scope="row">{label}</th>{on.map((x, i) => <td key={i}>{x ? Y : N}</td>)}</tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="sec">
        <div className="wrap">
          <div className="sec-head"><h2>Pricing questions</h2></div>
          <div className="faq">{FAQS.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
        </div>
      </section>
      <div className="band-wrap">
        <div className="wrap">
          <div className="band">
            <div><h2>Start free, upgrade when it pays</h2><p>Free for up to 100 orders a month, for as long as you like.</p></div>
            <a className="btn mint" href={cta.href}>{cta.label}</a>
          </div>
        </div>
      </div>
    </main>
  );
}
