"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

const PRESETS = [
  ["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["14d", "Last 14 days"], ["30d", "Last 30 days"],
  ["mtd", "This month"], ["lastmonth", "Last month"], ["custom", "Custom range…"],
];

/** Compact date-range control: a preset menu, with date fields when "Custom" is picked. */
export function RangePicker({ current, from, to, max }: { current: string; from: string; to: string; max: string }) {
  const router = useRouter();
  const path = usePathname();
  const [mode, setMode] = useState(current);
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  return (
    <div className="picker">
      <select aria-label="Date range" value={mode} onChange={(e) => {
        const v = e.target.value;
        setMode(v);
        if (v !== "custom") router.push(`${path}?range=${v}`);
      }}>
        {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {mode === "custom" && (
        <form onSubmit={(e) => { e.preventDefault(); if (f <= t) router.push(`${path}?from=${f}&to=${t}`); }}>
          <input type="date" aria-label="From" value={f} max={max} onChange={(e) => setF(e.target.value)} />
          <span>–</span>
          <input type="date" aria-label="To" value={t} max={max} onChange={(e) => setT(e.target.value)} />
          <button type="submit">Apply</button>
        </form>
      )}
    </div>
  );
}
