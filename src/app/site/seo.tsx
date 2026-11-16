import type { Metadata } from "next";
import { SITE } from "./brand";

/** Structured data for search engines. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const OG = { url: "/site/og.png", width: 1200, height: 630, alt: "Margewise: true profit for Shopify stores" };

/** Per-page metadata with a canonical address on margewise.io (never the /site path). */
export function pageMeta(path: string, title: string, description: string, absoluteTitle = false): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: `${SITE}${path === "/" ? "" : path}` },
    openGraph: { type: "website", siteName: "Margewise", title, description, url: `${SITE}${path}`, images: [OG] },
    twitter: { card: "summary_large_image", title, description, images: [OG.url] },
  };
}

export const faqLd = (faqs: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});

export const crumbsLd = (items: [string, string][]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE}${path}` })),
});
