import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/public-sans";
import "./site.css";
import { COMPANY, SITE, SUPPORT } from "./brand";
import { SOLUTIONS } from "./content";
import { Header } from "./header";
import { JsonLd } from "./seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Margewise: true profit analytics for Shopify stores", template: "%s | Margewise" },
  description:
    "Margewise is a Shopify profit app that shows your real net profit after product costs, payment fees, shipping, returns, tax and ad spend from Meta, Google, TikTok, Pinterest and Snapchat. Free up to 100 orders a month.",
  applicationName: "Margewise",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  openGraph: { type: "website", siteName: "Margewise", locale: "en_US", images: [{ url: "/site/og.png", width: 1200, height: 630, alt: "Margewise: true profit for Shopify stores" }] },
  twitter: { card: "summary_large_image", images: ["/site/og.png"] },
  icons: { icon: "/margewise-icon.svg" },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <a className="skip" href="#main">Skip to content</a>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Margewise",
        url: SITE,
        logo: `${SITE}/margewise-icon.png`,
        email: SUPPORT,
        contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SUPPORT, availableLanguage: "English" },
      }} />
      <Header />
      <div id="main">{children}</div>
      <footer className="ftr">
        <div className="wrap">
          <div className="cols">
            <div>
              <Link href="/" className="logo"><img src="/margewise-icon.svg" alt="" width={28} height={28} /><em>Marge<span>wise</span></em></Link>
              <p className="about">True profit analytics for Shopify stores. Every order costed, every ad judged against break-even, in any currency.</p>
            </div>
            <div>
              <h4>Solutions</h4>
              <ul>{SOLUTIONS.map((s) => <li key={s.slug}><Link href={`/solutions/${s.slug}`}>{s.nav}</Link></li>)}</ul>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li><Link href="/pricing">Pricing</Link></li>
                <li><Link href="/integrations">Integrations</Link></li>
                <li><Link href="/solutions">All features</Link></li>
              </ul>
            </div>
            <div>
              <h4>Free tools</h4>
              <ul>
                <li><Link href="/tools/break-even-roas-calculator">Break-even ROAS calculator</Link></li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><Link href="/support">Support</Link></li>
                <li><Link href="/affiliates">Affiliate programme</Link></li>
                <li><a href={`mailto:${SUPPORT}`}>{SUPPORT}</a></li>
                <li><Link href="/privacy">Privacy policy</Link></li>
                <li><Link href="/terms">Terms of service</Link></li>
              </ul>
            </div>
          </div>
          <div className="base">
            <span>© {new Date().getFullYear()} Margewise is a product of {COMPANY}</span>
            <span>Profit analytics for Shopify stores</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
