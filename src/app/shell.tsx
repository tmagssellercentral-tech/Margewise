import Link from "next/link";

const NAV = [
  { href: "/", key: "overview", label: "Overview", icon: "M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z" },
  { href: "/pnl", key: "pnl", label: "Profit & loss", icon: "M4 4h16v16H4zM8 9h8M8 13h8M8 17h5" },
  { href: "/expenses", key: "expenses", label: "Expenses", icon: "M7 3h10l2 3v15l-3-2-2 2-2-2-2 2-2-2-3 2V6zM9 9h6M9 13h6" },
  { href: "/products", key: "products", label: "Products", icon: "M20 7 12 3 4 7v10l8 4 8-4zM4 7l8 4 8-4M12 11v10" },
  { href: "/marketing", key: "marketing", label: "Marketing", icon: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zm13-3a5 5 0 0 1 0 8m2.5-10.5a8.5 8.5 0 0 1 0 13" },
  { href: "/orders", key: "orders", label: "Orders", icon: "M6 2h12l2 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zM4 6h16M9 10a3 3 0 0 0 6 0" },
  { href: "/settings", key: "settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" },
];

export function Shell({ active, shopName, children, demo }: { active: string; shopName: string; children: React.ReactNode; demo?: boolean }) {
  return (
    <div className="shell">
      <aside className="side">
        <Link href="/" className="brand"><img src="/margewise-icon.svg" alt="" width={26} height={26} className="mark" />Marge<span>wise</span></Link>
        <nav>
          {NAV.map((n) => (
            <Link key={n.key} href={n.href} className={active === n.key ? "on" : ""}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={n.icon} /></svg>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="content">
        {demo && <div className="demo">Demo data: Flexi Muscles, September 2026, with example fixed costs.</div>}
        {children}
      </main>
    </div>
  );
}
