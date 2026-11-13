import { COMPANY, SUPPORT } from "../brand";

export const metadata = { title: "Support" };

export default function Support() {
  return (
    <main className="s-doc">
      <h1>Support</h1>
      <p>Email <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a> and a real person will reply, usually within one business day.</p>
      <h2>Helpful to include</h2>
      <ul>
        <li>Your store&apos;s myshopify.com address</li>
        <li>The page and date range you were looking at</li>
        <li>A screenshot, if something looks wrong</li>
      </ul>
      <h2>Common questions</h2>
      <h3>Why doesn&apos;t my profit match Shopify&apos;s sales report?</h3>
      <p>Shopify reports sales. Margewise removes VAT or sales tax and refunds, then subtracts product cost, payment fees, shipping, packaging, returns and ad spend. Check that every product has a cost under Settings → Products.</p>
      <h3>How do I remove my data?</h3>
      <p>Uninstall Margewise from your Shopify admin. Your store&apos;s data is deleted within 48 hours of Shopify telling us the app was removed. You can also email us to request deletion at any time.</p>
    </main>
  );
}
