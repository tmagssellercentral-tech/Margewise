import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Margewise",
  description: "True profit for your Shopify store, after every cost.",
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
