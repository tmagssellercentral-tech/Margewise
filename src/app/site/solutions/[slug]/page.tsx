import Link from "next/link";
import { notFound } from "next/navigation";
import { cta } from "../../brand";
import { SOLUTIONS, solution } from "../../content";
import { crumbsLd, faqLd, JsonLd, pageMeta } from "../../seo";

export const dynamicParams = false;
export const generateStaticParams = () => SOLUTIONS.map((s) => ({ slug: s.slug }));

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P) {
  const s = solution((await params).slug);
  return s ? pageMeta(`/solutions/${s.slug}`, s.title, s.description) : {};
}

export default async function SolutionPage({ params }: P) {
  const s = solution((await params).slug);
  if (!s) notFound();
  const others = SOLUTIONS.filter((o) => o.slug !== s.slug).slice(0, 3);
  return (
    <main>
      <JsonLd data={crumbsLd([["Home", "/"], ["Solutions", "/solutions"], [s.nav, `/solutions/${s.slug}`]])} />
      {s.faqs.length > 0 && <JsonLd data={faqLd(s.faqs)} />}
      <section className="ph">
        <div className="wrap">
          <p className="crumbs"><Link href="/">Home</Link> / <Link href="/solutions">Solutions</Link> / {s.nav}</p>
          <h1>{s.h1}</h1>
          <p className="lead">{s.intro}</p>
          <div className="ctas">
            <a className="btn primary" href={cta.href}>{cta.label}</a>
            <Link className="btn ghost" href="/pricing">See pricing</Link>
          </div>
        </div>
      </section>
      <section className="showcase" style={{ background: "linear-gradient(var(--paper) 0 40%, var(--forest) 40% 100%)" }}>
        <div className="wrap">
          <div className="shot">
            <div className="bar" aria-hidden="true"><i /><i /><i /></div>
            <img src={s.image} alt={s.imageAlt} width={1600} height={900} fetchPriority="high" />
          </div>
          <p className="cap">Shown with a demo store.</p>
        </div>
      </section>
      <section className="sec">
        <div className="wrap">
          <div className="sec-head"><h2>What you get</h2></div>
          <div className="points">
            {s.points.map((p) => <div key={p.t}><h3>{p.t}</h3><p>{p.d}</p></div>)}
          </div>
        </div>
      </section>
      {s.faqs.length > 0 && (
        <section className="sec white">
          <div className="wrap">
            <div className="sec-head"><h2>Questions</h2></div>
            <div className="faq">{s.faqs.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
          </div>
        </section>
      )}
      <section className="sec">
        <div className="wrap">
          <div className="sec-head"><h2>Also in Margewise</h2></div>
          <div className="more">
            {others.map((o) => <Link key={o.slug} href={`/solutions/${o.slug}`}><b>{o.nav}</b><span>{o.blurb}</span></Link>)}
          </div>
        </div>
      </section>
      <div className="band-wrap">
        <div className="wrap">
          <div className="band">
            <div><h2>See it on your own store</h2><p>Free up to 100 orders a month. Your last 60 days load as soon as you install.</p></div>
            <a className="btn mint" href={cta.href}>{cta.label}</a>
          </div>
        </div>
      </div>
    </main>
  );
}
