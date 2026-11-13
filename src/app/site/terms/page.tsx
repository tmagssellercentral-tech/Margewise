import { COMPANY, SUPPORT } from "../brand";

export const metadata = { title: "Terms of service" };

const UPDATED = "13 November 2026";

export default function Terms() {
  return (
    <main className="s-doc">
      <h1>Terms of service</h1>
      <p className="s-small">Last updated {UPDATED}</p>
      <p>
        These terms apply to Margewise, a service provided by {COMPANY} (&quot;we&quot;, &quot;us&quot;). By installing or using Margewise you
        (&quot;the merchant&quot;) agree to them.
      </p>

      <h2>The service</h2>
      <p>
        Margewise reads data from your Shopify store and the advertising accounts you connect, combines it with the costs you enter, and shows
        profit reports. It is a management reporting tool. Its figures depend on the data and settings you provide and are not a substitute for
        your accounting records, tax returns or professional advice.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Keep product costs, fees and other settings accurate; reports are only as good as the inputs.</li>
        <li>Connect only stores and ad accounts you are authorised to use.</li>
        <li>Don&apos;t misuse the service, try to access other merchants&apos; data, or interfere with its operation.</li>
      </ul>

      <h2>Fees and billing</h2>
      <p>
        Paid plans are billed through Shopify, in line with the plan shown when you subscribe. You can cancel at any time from your Shopify admin;
        charges already billed are not refunded except where required by law or by Shopify&apos;s policies. We will give at least 30 days&apos;
        notice of price changes.
      </p>

      <h2>Your data</h2>
      <p>
        Your data remains yours. We use it only to provide the service, as described in our <a href="/privacy">privacy policy</a>. When you
        uninstall Margewise your store&apos;s data is deleted as described there.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We aim to keep Margewise available and accurate, but we don&apos;t guarantee it will be uninterrupted or error-free, or that third-party
        platforms will keep providing data. We may improve or change features over time.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, Margewise is provided &quot;as is&quot;, and our total liability for any claim is limited to the fees you
        paid us in the 12 months before the claim. We are not liable for indirect or consequential losses, such as lost profits or decisions made
        using the reports.
      </p>

      <h2>Ending the service</h2>
      <p>
        You can stop at any time by uninstalling the app. We may suspend accounts that breach these terms, after notice where reasonable.
      </p>

      <h2>Contact</h2>
      <p>{COMPANY} · <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a></p>
    </main>
  );
}
