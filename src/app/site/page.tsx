import Link from "next/link";
import { cta, SITE } from "./brand";
import { FAQ, SOLUTIONS } from "./content";
import { PLAN_CARDS } from "./plan-data";
import { Plans } from "./plans";
import { SolutionTabs } from "./solution-tabs";
import { faqLd, JsonLd, pageMeta } from "./seo";

export const metadata = pageMeta(
  "/",
  "Margewise: true profit analytics for Shopify stores",
  "See your Shopify store's real net profit after product costs, payment fees, shipping, returns, tax and ad spend from Meta, Google, TikTok, Pinterest and Snapchat. MER, ROAS and break-even ROAS on every campaign. Free up to 100 orders a month.",
  true,
);

// One illustrative order, costed line by line. Widths are each amount as a share of the sale.
const ORDER = { total: 104, lines: [["VAT (20%)", 17.33], ["Product cost", 36.4], ["Ads, this order's share", 20.8], ["Courier", 9.5], ["Payment fees", 2.18], ["Packaging", 1.04]] as [string, number][] };
const kept = ORDER.total - ORDER.lines.reduce((s, [, v]) => s + v, 0);
const gbp = (n: number) => `£${n.toFixed(2)}`;

const COSTS = [
  ["Product cost", "Cost of goods", "The cost per item from Shopify, or your own per SKU. Products without a cost are flagged."],
  ["Payment fees", "Gateways", "Shopify Payments' actual fee on each order, and published rates for PayPal, Mollie, PayFast, Paystack, Razorpay and more."],
  ["Shipping", "Couriers", "What the courier charges by destination and parcel size, or the exact amount from your courier's invoice."],
  ["Returns & packaging", "Order costs", "Return shipping, handling and packaging per order, so refunds show their real cost."],
  ["Tax", "VAT and sales tax", "Removed from revenue whether your prices include VAT or tax is added at checkout."],
  ["Ads & overheads", "Marketing and fixed costs", "Daily spend from Meta, Google, TikTok, Pinterest and Snapchat, CSV for any other channel, plus rent, salaries and software."],
];

const FORMULAS = [
  ["MER", "Store sales ÷ ad spend", "Every sale your store made against every rand, dollar or pound on ads. The number platforms can't inflate."],
  ["Blended ROAS", "Platform-reported sales ÷ ad spend", "What Meta, Google and the rest claim, added up. Compare it with MER to see how much they double-count."],
  ["Break-even ROAS", "Revenue ÷ profit before ads", "The ROAS you need just to cover product and order costs, from your own numbers, not an industry average."],
  ["POAS", "Profit before ads ÷ ad spend", "Profit returned for every unit of ad spend. Above 1, your ads paid for themselves."],
];

export default function Home() {
  return (
    <main>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Margewise",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Shopify",
        url: SITE,
        description: "True profit analytics for Shopify stores: net profit after every cost, ad performance against break-even ROAS, product profit, P&L, CAC and LTV.",
        offers: PLAN_CARDS.map((p) => ({ "@type": "Offer", name: p.name, price: p.monthly, priceCurrency: "USD" })),
      }} />
      <JsonLd data={faqLd(FAQ)} />

      <section className="hero">
        <div className="wrap">
          <div>
            <h1>Sales are vanity. Know what you keep.</h1>
            <p className="lead">
              Margewise is the Shopify profit app that costs every order as it happens: product cost, payment fees, shipping, returns,
              tax and ad spend. One honest number, and every ad judged against your break-even.
            </p>
            <div className="ctas">
              <a className="btn primary" href={cta.href}>{cta.label}</a>
              <Link className="btn ghost" href="/pricing">See pricing</Link>
            </div>
            <ul className="facts">
              <li>Free up to 100 orders a month</li>
              <li>14-day free trial on paid plans</li>
              <li>Read-only access</li>
              <li>Any currency</li>
            </ul>
          </div>
          <div className="ledger" aria-label={`Example: a ${gbp(ORDER.total)} order leaves ${gbp(kept)} of profit after costs`}>
            <header><b>Order #1042</b><span>3 items, paid by card</span></header>
            <ol>
              <li style={{ ["--i" as string]: 0 }}>
                <span>Sale</span><span className="amt num">{gbp(ORDER.total)}</span><i style={{ ["--w" as string]: "100%" }} />
              </li>
              {ORDER.lines.map(([label, v], k) => (
                <li key={label} style={{ ["--i" as string]: k + 1 }}>
                  <span>{label}</span><span className="amt num">−{gbp(v)}</span><i style={{ ["--w" as string]: `${(v / ORDER.total) * 100}%` }} />
                </li>
              ))}
            </ol>
            <div className="kept" style={{ ["--i" as string]: ORDER.lines.length + 1 }}>
              <span>What you keep</span>
              <div><b className="num">{gbp(kept)}</b><small>{((kept / ORDER.total) * 100).toFixed(1)}% of the sale</small></div>
            </div>
            <p className="note">Illustrative order. Margewise does this for every order in your store.</p>
          </div>
        </div>
      </section>

      <section className="showcase" aria-label="The Margewise dashboard">
        <div className="wrap">
          <div className="shot">
            <div className="bar" aria-hidden="true"><i /><i /><i /></div>
            <img src="/site/overview.webp" alt="Margewise overview: net profit, revenue, costs, orders, ad spend, MER and break-even ROAS for a demo store" width={1600} height={900} fetchPriority="high" />
          </div>
          <p className="cap">The Margewise overview, shown with a demo store.</p>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <h2>Everything between revenue and profit</h2>
            <p className="sub">Most dashboards stop at sales or ROAS. Margewise follows each order to the bottom line, then shows you where the money went.</p>
          </div>
          <SolutionTabs items={SOLUTIONS} />
        </div>
      </section>

      <section className="sec white">
        <div className="wrap">
          <div className="sec-head">
            <h2>The costs other dashboards guess</h2>
            <p className="sub">Averages hide the orders that lose money. Margewise costs each one with what it actually cost you.</p>
          </div>
          <div className="costs">
            {COSTS.map(([t, k, d]) => (
              <div className="cost" key={t}><p className="k">{k}</p><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec dark">
        <div className="wrap">
          <div className="sec-head">
            <h2>Four numbers that say whether your ads pay</h2>
            <p className="sub">Defined plainly, worked out from your own costs, and shown for every ad platform.</p>
          </div>
          <div className="formulas">
            {FORMULAS.map(([t, eq, d]) => (
              <div className="formula" key={t}><h3>{t}</h3><p className="eq">{eq}</p><p>{d}</p></div>
            ))}
          </div>
          <p style={{ marginTop: 32 }}>
            <Link className="btn mint" href="/tools/break-even-roas-calculator">Work out your break-even ROAS</Link>
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="wrap founder">
          <div>
            <blockquote>Built by a chartered accountant who runs his own Shopify brand.</blockquote>
            <p className="who">Margewise started as the profit report for one store, because Shopify&apos;s sales figures and the bank balance never matched. Now it does the same for yours.</p>
          </div>
          <ul className="trust">
            <li><b>Built on accounting, not estimates</b><span>Revenue without tax, refunds deducted, costs matched to the order they belong to. The same logic your accountant uses.</span></li>
            <li><b>Read-only, always</b><span>Margewise reads your orders and ad reports. It can&apos;t change your store or your ads.</span></li>
            <li><b>Your customers stay private</b><span>No customer names, emails or addresses are stored. Uninstall and your data is deleted.</span></li>
            <li><b>Made for every market</b><span>Local payment gateways, couriers, VAT and daily currency conversion for stores far beyond the US.</span></li>
          </ul>
        </div>
      </section>

      <section className="sec white" id="pricing">
        <div className="wrap">
          <div className="sec-head">
            <h2>Priced by orders, not by features</h2>
            <p className="sub">Start free. Upgrade when your store grows. Billed through Shopify with your other app charges.</p>
          </div>
          <Plans plans={PLAN_CARDS} ctaHref={cta.href} ctaLabel="Start 14-day trial" />
          <p className="plans-note">Prices in US dollars. <Link className="link" href="/pricing">Compare plans in detail</Link></p>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="sec-head"><h2>Questions</h2></div>
          <div className="faq">
            {FAQ.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
        </div>
      </section>

      <div className="band-wrap">
        <div className="wrap">
          <div className="band">
            <div>
              <h2>See your real profit this week</h2>
              <p>Install in a minute. Your last 60 days of orders load straight away.</p>
            </div>
            <a className="btn mint" href={cta.href}>{cta.label}</a>
          </div>
        </div>
      </div>
    </main>
  );
}
