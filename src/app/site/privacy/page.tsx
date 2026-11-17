import { COMPANY, SUPPORT } from "../brand";
import { pageMeta } from "../seo";

export const metadata = pageMeta("/privacy", "Privacy policy", "How Margewise collects, uses, stores and deletes Shopify store and advertising data.");

const UPDATED = "17 November 2026";

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
        <li><b>Supabase</b> (database), hosted in Frankfurt, Germany. Data is encrypted at rest.</li>
        <li><b>Vercel</b> (application hosting).</li>
        <li><b>Resend</b> (email delivery), for the daily profit email when a merchant turns it on: the recipient addresses and the report.</li>
        <li><b>Shopify</b> and the advertising platforms the merchant connects, as the sources of the data.</li>
      </ul>
      <p>Data is encrypted in transit. Access is limited to the people who run Margewise and only for support or maintenance.</p>

      <h2>How long we keep it</h2>
      <p>
        For as long as Margewise is installed. When a merchant uninstalls the app, Shopify notifies us and we delete that store&apos;s data within
        48 hours of Shopify&apos;s deletion request. Merchants can ask us to delete their data at any time by emailing {SUPPORT}.
      </p>

      <h2 id="data-deletion">Deleting your data, including Meta and other ad account data</h2>
      <p>You can remove the data Margewise holds at any time, in any of these ways:</p>
      <ul>
        <li><b>Disconnect an ad account:</b> in Margewise, go to Settings → Ad platforms and click Disconnect. We delete the stored access token at once and stop reading that account. You can also remove Margewise from your Facebook or Meta Business settings under Business integrations; we then lose access immediately.</li>
        <li><b>Delete everything:</b> uninstall Margewise from your Shopify admin. We delete all of the store&apos;s data, including ad spend and campaign data, within 48 hours of Shopify&apos;s deletion request.</li>
        <li><b>Ask us:</b> email {SUPPORT} from the store owner&apos;s email address and we delete the requested data within 30 days and confirm in writing.</li>
      </ul>

      <h2 id="google-user-data">Google user data (Google Ads)</h2>
      <p>
        This section applies when a merchant connects a Google Ads account to Margewise by signing in with Google. It sets out what Google user
        data Margewise accesses, how it is used, shared, protected, kept and deleted.
      </p>
      <h3>What Google user data we access</h3>
      <ul>
        <li><b>Your Google account email address</b> (through the <code>openid</code> and <code>email</code> scopes), shown in Margewise&apos;s settings so you can see which Google account is connected.</li>
        <li><b>Google Ads data</b> (through the <code>https://www.googleapis.com/auth/adwords</code> scope): the list of Google Ads accounts you can access (account ID, name and currency), and for the accounts you choose, daily campaign reports: campaign ID, campaign name, date, cost and conversion value.</li>
        <li><b>An OAuth refresh token</b> issued by Google, so Margewise can fetch new daily reports without asking you to sign in each day.</li>
      </ul>
      <p>We access Google Ads data read-only. Margewise never creates, edits, pauses or deletes campaigns, ads, budgets or any other Google Ads settings, and never reads your Gmail, contacts, files or any other Google data.</p>
      <h3>How we use Google user data</h3>
      <p>
        Only to show the merchant who connected the account their advertising cost and conversion value next to their Shopify sales, so
        Margewise can calculate profit after ad spend and return on ad spend in the merchant&apos;s own reports and daily profit email. We do
        not use Google user data for advertising, to build profiles, for credit decisions, or to develop, improve or train any artificial
        intelligence or machine learning models. We do not combine it with other merchants&apos; data.
      </p>
      <h3>Who we share it with</h3>
      <p>
        We do not sell, rent or share Google user data with anyone, and we do not transfer it to third parties for their own use. It is
        processed only by the service providers that host Margewise on our behalf, under contract and solely to run the service: Supabase
        (database, Frankfurt, Germany) and Vercel (application hosting). It may be disclosed if required by law, or as part of a merger or
        acquisition with the same protections. People at {COMPANY} access it only when the merchant asks us for support, for security
        investigations, or to comply with the law.
      </p>
      <h3>How we protect it</h3>
      <ul>
        <li>The Google refresh token is encrypted with AES-256-GCM before it is stored, and is only decrypted on our servers when fetching reports.</li>
        <li>All data is encrypted in transit (HTTPS/TLS) and encrypted at rest in the database.</li>
        <li>Access to the database and hosting is limited to the people who run Margewise.</li>
        <li>Each merchant&apos;s data is kept separate and is only shown to that merchant&apos;s Shopify store.</li>
      </ul>
      <h3>How long we keep it and how to delete it</h3>
      <ul>
        <li><b>Disconnect:</b> in Margewise, Settings → Ad platforms → Disconnect on the Google Ads card deletes the stored token and connected email address at once and stops all access. You can also remove Margewise at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>, which revokes our access immediately.</li>
        <li><b>Reports already loaded</b> (daily campaign cost and conversion value) stay in the merchant&apos;s reports while Margewise is installed, so past profit figures don&apos;t change, unless the merchant asks us to delete them.</li>
        <li><b>Uninstall:</b> when a merchant uninstalls Margewise from Shopify, we delete all of the store&apos;s data, including all Google Ads data, within 48 hours of Shopify&apos;s deletion request.</li>
        <li><b>On request:</b> email {SUPPORT} and we delete any or all Google user data within 30 days and confirm in writing.</li>
      </ul>
      <h3>Google API Services User Data Policy</h3>
      <p>
        Margewise&apos;s use and transfer of information received from Google APIs to any other app will adhere to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the
        Limited Use requirements.
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
