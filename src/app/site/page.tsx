import { SUPPORT } from "./brand";

export const metadata = { title: "True profit for every Shopify store" };

const FEATURES = [
  { t: "True profit on every order", d: "Product cost, payment fees, shipping, packaging, returns and VAT or sales tax, worked out order by order, not estimated." },
  { t: "Every ad platform in one place", d: "Meta, Google, TikTok, Pinterest and Snapchat sync automatically. Anything else by CSV. Spend in other currencies is converted daily." },
  { t: "Know if your ads pay", d: "Blended ROAS against your break-even ROAS, POAS, and every campaign marked above or below the line." },
  { t: "A real P&L, every month", d: "Revenue down to net profit with your fixed costs, month by month. Download to Excel for your accountant." },
  { t: "Customers, CAC and LTV", d: "New versus returning customers, cost to acquire each one, repeat purchase rate and lifetime value." },
  { t: "Tax done right, anywhere", d: "Prices with VAT included or sales tax added at checkout. Revenue is always shown without tax, so profit is never overstated." },
];

const MARKETS = [
  ["Payment fees", "Actual Shopify Payments fees, plus ready-made rates for PayPal, Mollie, Klarna and local gateways such as PayFast, Peach, Ozow, Paystack and Razorpay."],
  ["Shipping", "Courier cost by destination and parcel size, or upload your courier's invoice for the exact cost of each order."],
  ["Currencies", "Store and ad accounts in different currencies are reconciled at each day's European Central Bank rate."],
];

export default function Home() {
  return (
    <main>
      <section className="s-hero">
        <div>
          <p className="s-eyebrow">For Shopify stores</p>
          <h1>Know what you actually keep from every sale.</h1>
          <p className="s-lead">
            Margewise turns your Shopify orders, product costs and ad spend into one honest number: profit after every cost. Built by an
            ecommerce operator and chartered accountant, for founders who want to scale what&apos;s profitable, not just what sells.
          </p>
          <div className="s-ctas">
            <a className="s-btn big" href={`mailto:${SUPPORT}?subject=Margewise%20early%20access`}>Get early access</a>
            <span>Coming soon to the Shopify App Store</span>
          </div>
        </div>
        <div className="s-mock" aria-label="Illustration of the Margewise dashboard">
          <div className="m-card hero"><span>Net profit</span><b>$18,420</b><em>▲ 12.4% vs last month</em></div>
          <div className="m-row">
            <div className="m-card"><span>Revenue</span><b>$142,900</b></div>
            <div className="m-card"><span>Ad spend</span><b>$31,200</b></div>
          </div>
          <div className="m-row">
            <div className="m-card"><span>ROAS</span><b>3.42x</b><em className="ok">above break-even 2.6x</em></div>
            <div className="m-card"><span>CAC</span><b>$38</b><em>LTV : CAC 3.1x</em></div>
          </div>
          <p className="m-note">Illustrative figures</p>
        </div>
      </section>

      <section className="s-section" id="features">
        <h2>Everything between revenue and profit</h2>
        <p className="s-sub">Most dashboards stop at sales or ROAS. Margewise follows every rand, dollar and euro to the bottom line.</p>
        <div className="s-grid">
          {FEATURES.map((f) => (
            <div key={f.t} className="s-feature"><h3>{f.t}</h3><p>{f.d}</p></div>
          ))}
        </div>
      </section>

      <section className="s-section alt">
        <h2>Accurate wherever you sell</h2>
        <p className="s-sub">Stores in the US, UK and Europe get everything they expect. Stores in Africa, the Middle East and other fast-growing markets get the local detail most profit apps leave out.</p>
        <div className="s-grid three">
          {MARKETS.map(([t, d]) => (
            <div key={t} className="s-feature"><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="s-section cta">
        <h2>Be one of the first stores on Margewise</h2>
        <p className="s-sub">We&apos;re onboarding a small group of brands before the App Store launch. Tell us about your store and we&apos;ll be in touch.</p>
        <a className="s-btn big" href={`mailto:${SUPPORT}?subject=Margewise%20early%20access`}>Email {SUPPORT}</a>
      </section>
    </main>
  );
}
