"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SOLUTIONS } from "./content";
import { cta } from "./brand";

const caret = <svg className="caret" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;

export function Header() {
  const [open, setOpen] = useState(false); // Solutions menu (desktop)
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    const onClick = (e: MouseEvent) => { if (dd.current && !dd.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setMobile(false); } };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("scroll", onScroll); document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <header className={`hdr${scrolled ? " scrolled" : ""}`}>
      <div className="wrap">
        <Link href="/" className="logo" aria-label="Margewise home">
          <img src="/margewise-icon.svg" alt="" width={30} height={30} /><em>Marge<span>wise</span></em>
        </Link>
        <nav className="nav" aria-label="Main">
          <div className={`dd${open ? " open" : ""}`} ref={dd}
            onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <button type="button" aria-expanded={open} aria-controls="solutions-menu" onClick={() => setOpen((o) => !o)}>Solutions {caret}</button>
            <div className="panel" id="solutions-menu">
              {SOLUTIONS.map((s) => (
                <Link key={s.slug} href={`/solutions/${s.slug}`} onClick={() => setOpen(false)}><b>{s.nav}</b><span>{s.blurb}</span></Link>
              ))}
              <Link className="all" href="/solutions" onClick={() => setOpen(false)}>See everything Margewise does</Link>
            </div>
          </div>
          <Link href="/pricing">Pricing</Link>
          <Link href="/integrations">Integrations</Link>
          <Link href="/tools/break-even-roas-calculator">Free calculator</Link>
          <Link href="/support">Support</Link>
        </nav>
        <div className="hdr-cta">
          <Link className="btn ghost small" href="/pricing">See pricing</Link>
          <a className="btn primary small" href={cta.href}>{cta.label}</a>
          <button type="button" className="burger" aria-label={mobile ? "Close menu" : "Open menu"} aria-expanded={mobile} aria-controls="mobile-menu" onClick={() => setMobile((m) => !m)}>
            <svg viewBox="0 0 20 20" aria-hidden="true">{mobile
              ? <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              : <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}</svg>
          </button>
        </div>
      </div>
      <div className={`mobile${mobile ? " open" : ""}`} id="mobile-menu">
        <div className="wrap" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setMobile(false); }}>
          <h4>Solutions</h4>
          {SOLUTIONS.map((s) => <Link key={s.slug} href={`/solutions/${s.slug}`}>{s.nav}</Link>)}
          <h4>Margewise</h4>
          <Link href="/pricing">Pricing</Link>
          <Link href="/integrations">Integrations</Link>
          <Link href="/tools/break-even-roas-calculator">Break-even ROAS calculator</Link>
          <Link href="/support">Support</Link>
          <a className="btn primary" href={cta.href}>{cta.label}</a>
        </div>
      </div>
    </header>
  );
}
