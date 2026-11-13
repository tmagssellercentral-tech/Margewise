import { COMPANY, SUPPORT } from "../brand";

export const metadata = { title: "Privacy policy" };

const UPDATED = "13 November 2026";

export default function Privacy() {
  return (
    <main className="s-doc">
      <h1>Privacy policy</h1>
      <p className="s-small">Last updated {UPDATED}</p>
      <p>
        Margewise is a profit-reporting app for Shopify stores, operated by {COMPANY} (&quot;we&quot;, &quot;us&quot;). This policy explains what
        data Margewise collects when a merchant installs it, why, where it is kept and how to have it deleted. Questions go to{" "}
        <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>.
      </p>

      <h2>Who this covers</h2>
      <p>
        Merchants who install Margewise, and the merchants&apos; customers whose orders pass through it. For customer data, the merchant is the
        controller and we act as their processor: we use it only to produce the merchant&apos;s reports.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Store details</b> from Shopify: store name, domain, currency, time zone and country.</li>
        <li><b>Orders</b>: order number and date, line items, quantities, prices, discounts, shipping charged, tax, refunds, payment method and payment fees, and the shipping country.</li>
        <li><b>Customers</b>: only Shopify&apos;s internal customer number for each order, so we can tell new customers from returning ones. We do not store customer names, email addresses, phone numbers or street addresses.</li>
        <li><b>Products</b>: SKUs, titles and the unit cost recorded in Shopify.</li>
        <li><b>Advertising data</b> from ad accounts the merchant connects (such as Meta, Google, TikTok, Pinterest and Snapchat): daily spend and conversion value per campaign. We read this data only; we never change ads.</li>
        <li><b>Settings the merchant enters</b>: costs, fee rules, courier rates, fixed expenses and uploaded files such as courier invoices.</li>
        <li><b>Account contact</b>: the email address the merchant uses to contact us or to receive reports.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Only to calculate and show the merchant&apos;s profit reports, send reports the merchant asks for, provide support and keep the service
        secure. We do not sell data, use it for advertising, or combine one merchant&apos;s data with another&apos;s.
      </p>

      <h2>Where it is stored and who processes it</h2>
      <ul>
        <li><b>Supabase</b> (database), hosted in Frankfurt, Germany.</li>
        <li><b>Vercel</b> (application hosting).</li>
        <li><b>Shopify</b> and the advertising platforms the merchant connects, as the sources of the data.</li>
      </ul>
      <p>Data is encrypted in transit. Access is limited to the people who run Margewise and only for support or maintenance.</p>

      <h2>How long we keep it</h2>
      <p>
        For as long as Margewise is installed. When a merchant uninstalls the app, Shopify notifies us and we delete that store&apos;s data within
        48 hours of Shopify&apos;s deletion request. Merchants can ask us to delete their data at any time by emailing {SUPPORT}.
      </p>

      <h2>Requests from shoppers</h2>
      <p>
        When a shopper asks a merchant for their data, or asks for it to be erased, Shopify forwards the request to us. Because we hold only an
        order&apos;s customer number and no personal details, we either report what we hold or delete it, and confirm to the merchant.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live (for example under the GDPR, the UK GDPR, South Africa&apos;s POPIA or the UAE&apos;s data protection law), you
        may have the right to access, correct, delete or move your data and to object to its processing. Email {SUPPORT} and we will respond
        within 30 days. You may also complain to your local data protection authority.
      </p>

      <h2>Changes</h2>
      <p>We will update this page when our practices change, and tell installed merchants about material changes.</p>

      <h2>Contact</h2>
      <p>{COMPANY} · <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a></p>
    </main>
  );
}
