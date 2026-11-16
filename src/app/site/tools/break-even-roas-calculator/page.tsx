import Link from "next/link";
import { cta, SITE } from "../../brand";
import { crumbsLd, faqLd, JsonLd, pageMeta } from "../../seo";
import { Calculator } from "./calculator";

export const metadata = pageMeta(
  "/tools/break-even-roas-calculator",
  "Break-even ROAS calculator for Shopify and ecommerce",
  "Free break-even ROAS calculator: enter your average order value, product cost, shipping and payment fees to find the minimum ROAS your ads need to be profitable.",
);

const FAQS = [
  { q: "What is break-even ROAS?", a: "The return on ad spend at which an order covers its product and order costs exactly, with nothing left over. Above it, ads make a profit; below it, each ad-driven order loses money." },
  { q: "How do you calculate break-even ROAS?", a: "Divide your average order value (without tax) by what's left after product cost, shipping, payment fees and other order costs. For a $60 order with $30 of costs, break-even ROAS is 60 ÷ 30 = 2.0x." },
  { q: "What is a good ROAS for a Shopify store?", a: "Any ROAS comfortably above your own break-even. A store with 60% margins can profit at 2x, while a store with 30% margins needs well over 3x. That's why a single industry benchmark is misleading." },
  { q: "Is break-even ROAS the same as POAS?", a: "No. POAS is profit before ads divided by ad spend. At break-even ROAS, POAS is exactly 1." },
];

export default function BreakEvenRoas() {
  const path = "/tools/break-even-roas-calculator";
  return (
    <main>
      <JsonLd data={faqLd(FAQS)} />
      <JsonLd data={crumbsLd([["Home", "/"], ["Break-even ROAS calculator", path]])} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "Break-even ROAS calculator", url: `${SITE}${path}`, applicationCategory: "BusinessApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: 0, priceCurrency: "USD" } }} />
      <section className="ph">
        <div className="wrap">
          <p className="crumbs"><Link href="/">Home</Link> / Free tools / Break-even ROAS calculator</p>
          <h1>Break-even ROAS calculator</h1>
          <p className="lead">Find the lowest ROAS your ads can run at without losing money on each order. Enter your average order and its costs.</p>
        </div>
      </section>
      <section style={{ paddingBottom: 72 }}>
        <div className="wrap"><Calculator /></div>
      </section>
      <section className="sec white">
        <div className="wrap prose">
          <h2 style={{ marginTop: 0 }}>How break-even ROAS works</h2>
          <p>Break-even ROAS = average order value ÷ (average order value − product cost − shipping − payment fees − other order costs).</p>
          <p>The bottom half of that fraction is your contribution before ads: the money each order leaves to pay for marketing. Break-even ROAS is simply how many times over your ad spend has to be returned in sales to use up exactly that contribution.</p>
          <h2>Why it beats a benchmark</h2>
          <p>A &quot;good&quot; ROAS depends entirely on your margins. Two stores both running at 3x can be in completely different positions: one making a healthy profit, the other losing money on every order. Your own break-even is the only line that matters.</p>
          <h2>Average orders hide losing orders</h2>
          <p>This calculator uses one average order. In a real store, payment fees, shipping and discounts vary order by order, and so does your break-even. Margewise works it out from every order you take and marks each campaign above or below the line.</p>
          <p style={{ marginTop: 22 }}><Link className="link" href="/solutions/ad-profit-tracking">See how Margewise tracks ad profit</Link></p>
        </div>
      </section>
      <section className="sec">
        <div className="wrap">
          <div className="sec-head"><h2>Questions</h2></div>
          <div className="faq">{FAQS.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
        </div>
      </section>
      <div className="band-wrap">
        <div className="wrap">
          <div className="band">
            <div><h2>Your break-even, calculated from every order</h2><p>Margewise judges each Meta, Google, TikTok, Pinterest and Snapchat campaign against your real break-even ROAS.</p></div>
            <a className="btn mint" href={cta.href}>{cta.label}</a>
          </div>
        </div>
      </div>
    </main>
  );
}
