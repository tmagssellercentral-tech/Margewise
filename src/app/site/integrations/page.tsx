import Link from "next/link";
import { cta } from "../brand";
import { crumbsLd, JsonLd, pageMeta } from "../seo";

export const metadata = pageMeta(
  "/integrations",
  "Integrations: Shopify, Meta, Google Ads, payment gateways and couriers",
  "Margewise connects to Shopify, Meta (Facebook and Instagram) and Google Ads, reads actual Shopify Payments fees, and supports PayPal, Mollie, PayFast, Paystack, Razorpay and more. Any other ad channel or courier by CSV.",
);

type Status = "live" | "soon" | "csv" | "rate";
const LABEL: Record<Status, string> = { live: "Built in", soon: "Direct connection coming", csv: "CSV or manual entry", rate: "Add your own rate" };

const GROUPS: { name: string; intro: string; items: [string, string, Status][] }[] = [
  { name: "Store", intro: "Margewise installs from the Shopify App Store and reads your store directly.", items: [
    ["Shopify", "Orders, refunds, product costs and customers (by ID only), from your online store, point of sale and draft orders. Updates within minutes.", "live"],
  ] },
  { name: "Ad platforms", intro: "Read-only. Daily spend and conversion value per campaign, converted to your store currency.", items: [
    ["Meta", "Facebook and Instagram ads. Sign in with Facebook and choose your ad accounts.", "live"],
    ["Google Ads", "Search, Shopping, Performance Max and YouTube. Sign in with Google, including accounts under a manager.", "live"],
    ["TikTok Ads", "Upload a daily campaign report as CSV today.", "soon"],
    ["Pinterest Ads", "Upload a daily campaign report as CSV today.", "soon"],
    ["Snapchat Ads", "Upload a daily campaign report as CSV today.", "soon"],
    ["Microsoft Advertising", "Export a daily campaign report from Bing and upload it.", "csv"],
    ["X (Twitter) Ads", "Export a daily campaign report and upload it.", "csv"],
    ["Influencers and sponsorships", "Enter payments on the day they ran.", "csv"],
  ] },
  { name: "Payments", intro: "Actual fees where the gateway reports them, published rates where it doesn't, and your contract rate for anything else.", items: [
    ["Shopify Payments", "The actual fee on every order, read from Shopify.", "live"],
    ["PayPal, Mollie and Amazon Pay", "Ready-made fee rules from each provider's published pricing.", "live"],
    ["PayFast, Peach, Ozow and Stitch", "South African gateways, with local card and instant EFT rates.", "live"],
    ["Paystack and Flutterwave", "Nigerian and Kenyan gateways.", "live"],
    ["Razorpay and PayU", "Indian gateways.", "live"],
    ["Klarna, Afterpay, Tabby and others", "Buy now, pay later providers set rates per merchant: add your contract rate once.", "rate"],
  ] },
  { name: "Shipping and exports", intro: "Courier costs by destination and parcel size, or exact costs from the invoice.", items: [
    ["Any courier", "Set rates by destination and parcel size, or upload your courier's invoice for the exact cost of each order.", "rate"],
    ["Excel", "Download formatted reports for your accountant.", "live"],
    ["CSV", "Export any table for your own analysis.", "live"],
  ] },
];

export default function Integrations() {
  return (
    <main>
      <JsonLd data={crumbsLd([["Home", "/"], ["Integrations", "/integrations"]])} />
      <section className="ph">
        <div className="wrap">
          <p className="crumbs"><Link href="/">Home</Link> / Integrations</p>
          <h1>Connects to where your costs come from</h1>
          <p className="lead">Your store, your ad accounts, your payment gateways and your couriers, in one profit number. Every connection is read-only.</p>
        </div>
      </section>
      <section style={{ paddingBottom: 88 }}>
        <div className="wrap ints">
          {GROUPS.map((g) => (
            <div className="int-group" key={g.name}>
              <h2>{g.name}</h2>
              <p className="s-small" style={{ marginBottom: 18, fontSize: 16 }}>{g.intro}</p>
              <div className="int-list">
                {g.items.map(([n, d, s]) => (
                  <div className="int" key={n}><b>{n}</b><p>{d}</p><span className={`status ${s}`}>{LABEL[s]}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="band-wrap">
        <div className="wrap">
          <div className="band">
            <div><h2>Missing a platform you use?</h2><p>Tell us at support@margewise.io. Anything with a daily report can be added by CSV today.</p></div>
            <a className="btn mint" href={cta.href}>{cta.label}</a>
          </div>
        </div>
      </div>
    </main>
  );
}
