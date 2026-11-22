import Link from "next/link";
import { COMPANY, SUPPORT } from "../brand";
import { pageMeta } from "../seo";

export const metadata = pageMeta("/affiliate-terms", "Affiliate programme terms", "The rules of the Margewise affiliate programme: commission, attribution, payment and conduct.");

const UPDATED = "22 November 2026";

export default function AffiliateTerms() {
  return (
    <main className="s-doc">
      <h1>Affiliate programme terms</h1>
      <p className="s-small">Last updated {UPDATED}</p>
      <p>
        These terms apply to the Margewise affiliate programme run by {COMPANY} (&quot;we&quot;, &quot;us&quot;). By joining the programme you
        (&quot;the affiliate&quot;) agree to them. See the <Link href="/affiliates">affiliate programme page</Link> for a summary.
      </p>

      <h2>1. Joining</h2>
      <p>We review every application and may accept or decline it at our discretion. We may end an affiliate&apos;s participation at any time; commission already earned under these terms is still paid, unless it was earned in breach of them.</p>

      <h2>2. Qualifying referrals</h2>
      <ul>
        <li>A referral qualifies when a Shopify store installs Margewise within 60 days of clicking the affiliate&apos;s link, and then pays for a plan.</li>
        <li>If a store clicks more than one affiliate&apos;s link, the last link clicked before installing gets the referral.</li>
        <li>These don&apos;t qualify: the affiliate&apos;s own stores or stores they own or control; stores that already had Margewise installed; duplicate, test or fake accounts.</li>
      </ul>

      <h2>3. Commission</h2>
      <ul>
        <li>Commission starts with a referred store&apos;s first paid charge and runs for the twelve months after it.</li>
        <li>For the first two monthly payments, the affiliate earns 50% of the amount we collect. For the next ten, 25%.</li>
        <li>Commission is calculated on the subscription amount we actually receive, excluding taxes, usage charges and refunds. It is not paid on the free plan, free trials or any period the store isn&apos;t paying for.</li>
        <li>Annual plans: we divide the annual payment into twelve equal monthly amounts and pay commission on each as it falls due, at the same 50% and 25% rates. Commission is never paid on an annual payment up front.</li>
        <li>If a store cancels, downgrades to the free plan or stops paying, commission stops from that point. If it upgrades or downgrades between paid plans, commission follows the new amount for the remaining months.</li>
      </ul>

      <h2>4. Payment</h2>
      <ul>
        <li>Each commission is held for 30 days after we receive the store&apos;s payment, to cover refunds and chargebacks.</li>
        <li>We pay monthly, in US dollars, once the affiliate&apos;s balance of cleared commission reaches $50. Smaller balances carry over.</li>
        <li>If a payment is refunded or charged back after commission was paid, we deduct that commission from future payments.</li>
        <li>Affiliates must provide the tax information we need before payment (for example a W-9 or W-8BEN form) and are responsible for their own taxes.</li>
      </ul>

      <h2>5. How you may promote Margewise</h2>
      <ul>
        <li>Be honest. Don&apos;t make claims about Margewise&apos;s features, pricing or results that aren&apos;t on our website.</li>
        <li>Disclose that you earn commission, as the law and the platforms you use require.</li>
        <li>Don&apos;t bid on &quot;Margewise&quot; or misspellings of it in search ads, or run ads that look like they come from us.</li>
        <li>Don&apos;t send spam, use misleading coupon or deal sites, or pose as Margewise or Shopify.</li>
        <li>You may use the Margewise name and logo only to promote Margewise, and must stop when you leave the programme.</li>
      </ul>
      <p>We may withhold commission earned in breach of this section and end the affiliate&apos;s participation.</p>

      <h2>6. Changes</h2>
      <p>We may change these terms or the commission rates with 30 days&apos; notice by email. Changes don&apos;t reduce commission on referrals that already qualified before the change.</p>

      <h2>7. Other</h2>
      <p>Affiliates are independent and are not our employees, agents or partners. Tracking can occasionally fail (for example when cookies are blocked); if you believe a referral wasn&apos;t credited, email us and we&apos;ll look into it. Our liability under the programme is limited to commission due under these terms.</p>

      <h2>Contact</h2>
      <p>{SUPPORT}</p>
    </main>
  );
}
