const LINKS = [
  { href: "/", label: "Dashboard", key: "dashboard" },
  { href: "/orders", label: "Orders", key: "orders" },
  { href: "/settings", label: "Settings", key: "settings" },
];

export function AppNav({ active, shopName }: { active: string; shopName: string }) {
  return (
    <div className="appnav">
      <a href="/" className="logo">Marge<span>wise</span></a>
      <span className="shopname">{shopName}</span>
      <nav>
        {LINKS.map((l) => (
          <a key={l.key} href={l.href} className={active === l.key ? "on" : ""}>{l.label}</a>
        ))}
      </nav>
    </div>
  );
}

/** Saved / error banner driven by ?saved=1 or ?error=... after a form submit. */
export function Flash({ saved, error }: { saved?: string; error?: string }) {
  if (error) return <div className="flash bad" role="alert">{error}</div>;
  if (saved) return <div className="flash ok" role="status">Saved. Profit figures have been recalculated.</div>;
  return null;
}
