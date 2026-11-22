import { SITE } from "../brand";
import { SOLUTIONS } from "../content";

export const dynamic = "force-static";

const PAGES: [string, number][] = [
  ["/", 1], ["/pricing", 0.9], ["/solutions", 0.8],
  ...SOLUTIONS.map((s) => [`/solutions/${s.slug}`, 0.8] as [string, number]),
  ["/integrations", 0.7], ["/tools/break-even-roas-calculator", 0.8],
  ["/affiliates", 0.6], ["/support", 0.4], ["/privacy", 0.2], ["/terms", 0.2], ["/affiliate-terms", 0.2],
];

export function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(([p, pr]) => `  <url><loc>${SITE}${p === "/" ? "/" : p}</loc><lastmod>${today}</lastmod><priority>${pr}</priority></url>`).join("\n")}
</urlset>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
