"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Solution } from "./content";

/** Home page: one tab per solution, with its screenshot. Arrow keys move between tabs. */
export function SolutionTabs({ items }: { items: Solution[] }) {
  const [i, setI] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const s = items[i];
  const move = (to: number) => { const n = (to + items.length) % items.length; setI(n); refs.current[n]?.focus(); };
  return (
    <>
      <div className="tabs" role="tablist" aria-label="What Margewise shows you">
        {items.map((t, k) => (
          <button key={t.slug} ref={(el) => { refs.current[k] = el; }} type="button" role="tab" id={`tab-${t.slug}`}
            aria-selected={k === i} aria-controls={`panel-${t.slug}`} tabIndex={k === i ? 0 : -1}
            onClick={() => setI(k)}
            onKeyDown={(e) => { if (e.key === "ArrowRight") move(k + 1); if (e.key === "ArrowLeft") move(k - 1); }}>
            {t.nav}
          </button>
        ))}
      </div>
      <div className="tabpanel" role="tabpanel" id={`panel-${s.slug}`} aria-labelledby={`tab-${s.slug}`}>
        <div>
          <h3>{s.h1}</h3>
          <p className="intro">{s.intro}</p>
          <ul className="ticks">
            {s.points.slice(0, 3).map((p) => <li key={p.t}><div><b>{p.t}</b><span>{p.d}</span></div></li>)}
          </ul>
          <Link className="link" href={`/solutions/${s.slug}`}>More about {s.nav.toLowerCase()}</Link>
        </div>
        <div className="shot" style={{ borderColor: "var(--line)" }}>
          <div className="bar" aria-hidden="true"><i /><i /><i /></div>
          <img src={s.image} alt={s.imageAlt} width={1600} height={900} loading="lazy" />
        </div>
      </div>
    </>
  );
}
