import Link from "next/link";
import { cta } from "../brand";
import { SOLUTIONS } from "../content";
import { crumbsLd, JsonLd, pageMeta } from "../seo";

export const metadata = pageMeta(
  "/solutions",
  "Shopify profit analytics features",
  "Everything Margewise does for Shopify stores: real-time net profit, ad profit tracking with MER and break-even ROAS, product profit, monthly P&L, CAC and LTV, and order-level cost tracking.",
);

export default function Solutions() {
  return (
    <main>
      <JsonLd data={crumbsLd([["Home", "/"], ["Solutions", "/solutions"]])} />
      <section className="ph">
        <div className="wrap">
          <p className="crumbs"><Link href="/">Home</Link> / Solutions</p>
          <h1>Everything you need to run a profitable store</h1>
          <p className="lead">Six views of the same honest numbers: what you kept, which ads paid, which products carry you, and what your customers are worth.</p>
        </div>
      </section>
      <section style={{ paddingBottom: 88 }}>
        <div className="wrap" style={{ display: "grid", gap: 56 }}>
          {SOLUTIONS.map((s, i) => (
            <article key={s.slug} className={`tabpanel${i % 2 ? " flip" : ""}`}>
              <div>
                <h2 style={{ fontSize: 34 }}>{s.nav}</h2>
                <p className="intro">{s.intro}</p>
                <ul className="ticks">{s.points.slice(0, 2).map((p) => <li key={p.t}><div><b>{p.t}</b><span>{p.d}</span></div></li>)}</ul>
                <Link className="link" href={`/solutions/${s.slug}`}>More about {s.nav.toLowerCase()}</Link>
              </div>
              <div className="shot" style={{ borderColor: "var(--line)" }}>
                <div className="bar" aria-hidden="true"><i /><i /><i /></div>
                <img src={s.image} alt={s.imageAlt} width={1600} height={900} loading={i ? "lazy" : undefined} />
              </div>
            </article>
          ))}
        </div>
      </section>
      <div className="band-wrap">
        <div className="wrap">
          <div className="band">
            <div><h2>One app, every cost</h2><p>Free up to 100 orders a month.</p></div>
            <a className="btn mint" href={cta.href}>{cta.label}</a>
          </div>
        </div>
      </div>
    </main>
  );
}
