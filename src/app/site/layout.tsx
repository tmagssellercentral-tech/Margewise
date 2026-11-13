import type { Metadata } from "next";
import Link from "next/link";
import "./site.css";
import { SUPPORT } from "./brand";

export const metadata: Metadata = {
  title: { default: "Margewise: true profit for Shopify stores", template: "%s · Margewise" },
  description: "See what every order really earns after product costs, payment fees, shipping, returns, tax and ads from every platform.",
  robots: { index: true, follow: true },
  metadataBase: new URL("https://margewise.io"),
};


export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <header className="s-head">
        <Link href="/" className="s-logo"><img src="/margewise-icon.svg" alt="" width={30} height={30} />Marge<span>wise</span></Link>
        <nav>
          <Link href="/#features">Features</Link>
          <Link href="/support">Support</Link>
          <a className="s-btn" href={`mailto:${SUPPORT}?subject=Margewise%20early%20access`}>Get early access</a>
        </nav>
      </header>
      {children}
      <footer className="s-foot">
        <div>
          <div className="s-logo small">Marge<span>wise</span></div>
        </div>
        <nav>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of service</Link>
          <Link href="/support">Support</Link>
          <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>
        </nav>
      </footer>
    </div>
  );
}
