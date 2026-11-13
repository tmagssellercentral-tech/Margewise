import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Margewise",
  description: "True profit for your Shopify store, after every cost.",
  robots: { index: false },
};

const NAV = [
  ["/pnl", "Profit & loss"], ["/expenses", "Expenses"], ["/products", "Products"],
  ["/marketing", "Marketing"], ["/orders", "Orders"], ["/settings", "Settings"],
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Inside the Shopify admin (middleware verified the store), load App Bridge and use the admin's
  // own navigation instead of Margewise's side menu.
  const embedded = !!(await headers()).get("x-mw-shop");
  return (
    <html lang="en">
      {embedded && (
        <head>
          <meta name="shopify-api-key" content={process.env.SHOPIFY_APP_CLIENT_ID ?? ""} />
          {/* eslint-disable-next-line @next/next/no-sync-scripts */}
          <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
        </head>
      )}
      <body className={embedded ? "embedded" : undefined}>
        {embedded && (
          <s-app-nav>
            <a href="/" rel="home">Overview</a>
            {NAV.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          </s-app-nav>
        )}
        {children}
      </body>
    </html>
  );
}
