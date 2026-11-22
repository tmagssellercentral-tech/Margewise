import Link from "next/link";
import { PUBLIC_PLANS } from "@/lib/plans";
import { affiliateApply, SUPPORT } from "../brand";
import { crumbsLd, faqLd, JsonLd, pageMeta } from "../seo";

export const metadata = pageMeta(
  "/affiliates",
  "Affiliate programme: earn up to 3.5× the plan price on every store you refer",
  "Refer Shopify stores to Margewise and earn 50% of what they pay for their first two months, then 25% for the next ten. Paid monthly on what we collect.",
);

// Commission on one store that stays subscribed for the full 12 months.
const yearOne = (monthly: number) => monthly * 0.5 * 2 + monthly * 0.25 * 10;
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const PAID = PUBLIC_PLANS.filter((p) => p.monthly && p.monthly > 0) as { key: string; name: string; monthly: number }[];

const STEPS: [string, string][] = [
  ["Apply", "Tell us who you are and how you'll share Margewise. We reply within two working days."],
  ["Share your link", "Send Shopify store owners to Margewise with your own referral link: in content, emails, client work or communities."],
  ["Earn for 12 months", "When a store you referred pays for a plan, you earn 50% of what they pay for two months, then 25% for the next ten."],
];

const FAQS = [
  { q: "Who can join?", a: "Anyone who works with Shopify store owners: agencies, freelancers, accountants and bookkeepers, ecommerce creators and consultants. You don't need to be a Margewise customer." },
  { q: "How much can I earn?", a: "50% of what each referred store pays in its first two paid months, then 25% for the next ten: up to 3.5 times the monthly plan price per store over a year. Commission is paid on what the store actually pays, so it stops if they cancel." },
  { q: "What about annual plans?", a: "Annual plans earn the same as monthly ones. We split the annual payment into twelve monthly amounts and pay commission on each month as it falls due: 50% for the first two, 25% for the next ten." },
  { q: "Do free plans or free trials count?", a: "No. Commission starts with a store's first paid charge, and the twelve months run from that payment. A store that moves from the free plan to a paid plan counts from its first payment." },
  { q: "When do I get paid?", a: "Monthly. Each commission is held for 30 days to cover refunds and chargebacks, then paid once your balance reaches $50." },
  { q: "How long does my link last?", a: "60 days. If a store installs Margewise within 60 days of clicking your link, the referral is yours, unless they click another affiliate's link afterwards." },
];

export default function Affiliates() {
  return (
    <main>
      <JsonLd data={crumbsLd([["Home", "/"], ["Affiliate programme", "/affiliates"]])} />
      <JsonLd data={faqLd(FAQS)} />
      <section className="ph">
        <div className="wrap">
          <p className="crumbs"><Link href="/">Home</Link> / Affiliate programme</p>
          <h1>Earn up to 3.5× the plan price on every store you refer</h1>
          <p className="lead">50% of what each store pays for its first two months, then 25% for the next ten. Paid monthly, on every store that stays.</p>
          <p style={{ marginTop: 28 }}><a className="btn primary" href={affiliateApply}>Apply to join</a></p>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 40 }}>
        <div className="wrap">
          <div className="sec-head"><h2>What one referral earns</h2><p className="sub">For a store that stays on its plan for a full year.</p></div>
          <div style={{ overflowX: "auto" }}>
            <table className="compare">
              <thead><tr><th>Plan</th><th>Store pays</th><th>Months 1–2 (50%)</th><th>Months 3–12 (25%)</th><th>You earn in year one</th></tr></thead>
              <tbody>
                {PAID.map((p) => (
                  <tr key={p.key}>
                    <td><b>{p.name}</b></td>
                    <td>{usd(p.monthly)} a month</td>
                    <td>{usd(p.monthly * 0.5)} a month</td>
                    <td>{usd(p.monthly * 0.25)} a month</td>
                    <td><b>{usd(yearOne(p.monthly))}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="s-small" style={{ marginTop: 14, fontSize: 15 }}>Ten Growth stores that stay a year earn you {usd(yearOne(PAID.find((p) => p.key === "growth")?.monthly ?? 59) * 10)}. Annual plans earn the same, paid month by month.</p>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head"><h2>How it works</h2></div>
          <ol className="aff-steps">
            {STEPS.map(([t, d]) => (<li key={t}><b>{t}</b><p>{d}</p></li>))}
          </ol>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div className="sec-head"><h2>Questions</h2></div>
          <div className="faq">{FAQS.map((f) => (<details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>))}</div>
          <p className="s-small" style={{ marginTop: 20, fontSize: 15 }}>The full rules are in the <Link href="/affiliate-terms">affiliate programme terms</Link>. Questions: {SUPPORT}.</p>
        </div>
      </section>

      <div className="band-wrap">
        <div className="wrap">
          <div className="band">
            <div><h2>Know Shopify store owners?</h2><p>Help them see their real profit, and earn for a year on every store that signs up.</p></div>
            <a className="btn mint" href={affiliateApply}>Apply to join</a>
          </div>
        </div>
      </div>
    </main>
  );
}
