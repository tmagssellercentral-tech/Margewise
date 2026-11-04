import { db, getShop, loadConfig } from "@/lib/db";
import { addDays, localDate } from "@/lib/dates";
import { findFeeRule } from "@/lib/engine";
import { AppNav, Flash } from "../nav";
import {
  deleteCourierRule, deleteFeeRule, deleteFixedCost, saveCourierRule, saveFeeRule, saveFixedCost,
  saveProduct, saveShipping, saveStore,
} from "./actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "store", label: "Store & tax" },
  { key: "fees", label: "Payment fees" },
  { key: "shipping", label: "Shipping & packaging" },
  { key: "products", label: "Products" },
  { key: "fixed", label: "Fixed costs" },
];

type SP = Promise<Record<string, string | undefined>>;

export default async function Settings({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "store";
  const shop = await getShop();
  return (
    <main className="wrap">
      <AppNav active="settings" shopName={shop.name} />
      <h1 className="pagetitle">Settings</h1>
      <nav className="tabs">
        {TABS.map((t) => (
          <a key={t.key} href={`/settings?tab=${t.key}`} className={tab === t.key ? "on" : ""}>{t.label}</a>
        ))}
      </nav>
      <Flash saved={sp.saved} error={sp.error} />
      {tab === "store" && <StoreTab />}
      {tab === "fees" && <FeesTab />}
      {tab === "shipping" && <ShippingTab />}
      {tab === "products" && <ProductsTab q={sp.q} />}
      {tab === "fixed" && <FixedTab />}
    </main>
  );
}

const money = (n: number, ccy: string) =>
  `${ccy} ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function StoreTab() {
  const shop = await getShop();
  const { config } = await loadConfig(shop);
  const today = localDate(new Date(), shop.timezone);
  const { data: taxCheck } = await db().from("orders").select("tax_amount").eq("shop_id", shop.id)
    .gte("local_date", addDays(today, -60)).limit(500);
  const recent = taxCheck ?? [];
  const noTax = recent.length > 0 && recent.every((o) => Number(o.tax_amount) === 0);
  return (
    <form action={saveStore} className="card form">
      <h2>Store</h2>
      <div className="grid3">
        <label>Store name<input name="name" defaultValue={shop.name} /></label>
        <label>Country (2-letter code)<input name="country" defaultValue={shop.country} maxLength={2} pattern="[A-Za-z]{2}" required /></label>
        <label>Store currency<input name="currency" defaultValue={shop.currency} maxLength={3} pattern="[A-Za-z]{3}" required /></label>
        <label>Time zone<input name="timezone" defaultValue={shop.timezone} placeholder="Africa/Johannesburg" /></label>
      </div>

      <h2>Tax</h2>
      <label>How should tax be removed from revenue?
        <select name="tax_mode" defaultValue={shop.tax_mode}>
          <option value="rate">At my VAT rate below (prices include VAT)</option>
          <option value="shopify">Use the tax Shopify recorded on each order (any country)</option>
        </select>
      </label>
      <p className="hint">
        Use <b>Shopify&apos;s recorded tax</b> when Shopify calculates tax at checkout. This suits US and Canadian
        sales tax, and VAT stores where Shopify charges VAT. Use <b>my VAT rate</b> when your prices include VAT but Shopify isn&apos;t set to charge it.
      </p>
      {noTax && shop.tax_mode === "shopify" && (
        <div className="alert">Shopify recorded no tax on your orders in the last 60 days, so this setting removes no tax at all. Switch to &quot;At my VAT rate&quot; unless your sales really are tax-free.</div>
      )}
      {noTax && shop.tax_mode === "rate" && (
        <p className="hint">Shopify recorded no tax on your recent orders, so &quot;At my VAT rate&quot; is the right choice for this store.</p>
      )}
      <div className="grid3">
        <label className="check"><input type="checkbox" name="vat_registered" defaultChecked={shop.vat_registered} /> Registered for VAT / GST (can claim back VAT on costs)</label>
        <label>VAT / GST rate (%)<input name="vat_rate" type="number" step="0.01" min="0" max="50" defaultValue={+(shop.vat_rate * 100).toFixed(2)} /></label>
        <label className="check"><input type="checkbox" name="prices_include_vat" defaultChecked={shop.prices_include_vat} /> My prices include VAT</label>
        <label className="check"><input type="checkbox" name="ad_spend_includes_vat" defaultChecked={config.adSpendIncludesVat} /> Ad platforms charge me VAT inside the spend figure</label>
      </div>
      <button type="submit">Save store &amp; tax</button>
    </form>
  );
}

async function FeesTab() {
  const shop = await getShop();
  const { rules } = await loadConfig(shop);
  const { data } = await db().from("payment_fee_rules").select("*").eq("shop_id", shop.id).order("gateway_match");
  const today = localDate(new Date(), shop.timezone);
  const { data: seen } = await db().from("orders").select("gateway, actual_payment_fee").eq("shop_id", shop.id)
    .gte("local_date", addDays(today, -90)).limit(5000);
  const gateways = new Map<string, { orders: number; actual: number }>();
  for (const o of seen ?? []) {
    if (!o.gateway) continue;
    const g = gateways.get(o.gateway) ?? { orders: 0, actual: 0 };
    g.orders++;
    if (o.actual_payment_fee != null) g.actual++;
    gateways.set(o.gateway, g);
  }
  return (
    <>
      <div className="card">
        <h2>Payment methods on your orders (last 90 days)</h2>
        <table>
          <thead><tr><th>Payment method</th><th>Orders</th><th>Fee source</th></tr></thead>
          <tbody>
            {[...gateways.entries()].sort((a, b) => b[1].orders - a[1].orders).map(([g, v]) => {
              const rule = findFeeRule(g, rules);
              return (
                <tr key={g}>
                  <td>{g}</td>
                  <td>{v.orders}</td>
                  <td>{v.actual === v.orders ? <span className="badge ok">Actual fees from Shopify</span>
                    : rule ? `Rule "${rule.gatewayMatch}"`
                    : <span className="badge bad">No rule: counted as zero</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint">Shopify Payments reports its real fee on each order, and Margewise uses that automatically. Other gateways need a rule below. A rule matches when a payment method&apos;s name starts with it, and the longest match wins.</p>
      </div>

      <div className="card">
        <h2>Fee rules</h2>
        <div className="gt fees"><div className="gh"><span>Name starts with</span><span>% of order</span><span>Fixed fee</span><span>Minimum</span><span>Note</span><span></span></div>
            {(data ?? []).map((r) => (
              <div key={r.id}>
                  <form action={saveFeeRule} className="rowform">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="gateway_match" defaultValue={r.gateway_match} required />
                    <input name="pct" type="number" step="0.001" defaultValue={+(Number(r.pct) * 100).toFixed(3)} />
                    <input name="fixed_fee" type="number" step="0.01" defaultValue={Number(r.fixed_fee)} />
                    <input name="min_fee" type="number" step="0.01" defaultValue={Number(r.min_fee)} />
                    <input name="note" defaultValue={r.note ?? ""} />
                    <button type="submit">Save</button>
                    <button type="submit" formAction={deleteFeeRule} className="ghost">Delete</button>
                  </form>
                </div>
            ))}
            <div>
                <form action={saveFeeRule} className="rowform">
                  <input name="gateway_match" placeholder="e.g. PayPal" required />
                  <input name="pct" type="number" step="0.001" placeholder="2.9" />
                  <input name="fixed_fee" type="number" step="0.01" placeholder="0.30" />
                  <input name="min_fee" type="number" step="0.01" placeholder="0" />
                  <input name="note" placeholder="Where the rate comes from" />
                  <button type="submit">Add rule</button>
                </form>
              </div>
          </div>
        <p className="hint">Amounts are in {shop.currency}. Enter the % as a number, e.g. 2.95 for 2.95%.</p>
      </div>
    </>
  );
}

async function ShippingTab() {
  const shop = await getShop();
  const { config } = await loadConfig(shop);
  const { data: rules } = await db().from("courier_rules").select("*").eq("shop_id", shop.id).order("zone");
  const f = (k: keyof typeof config) => Number(config[k] ?? 0);
  return (
    <>
      <form action={saveShipping} className="card form">
        <h2>Per order</h2>
        <div className="grid3">
          <label>Packaging per order<input name="packaging_per_order" type="number" step="0.01" defaultValue={f("packagingPerOrder")} /></label>
          <label>Fulfilment / picking per order<input name="fulfilment_per_order" type="number" step="0.01" defaultValue={f("fulfilmentPerOrder")} /></label>
          <label>Handling per returned order<input name="return_handling_per_order" type="number" step="0.01" defaultValue={f("returnHandlingPerOrder")} /></label>
        </div>
        <h2>Default courier cost</h2>
        <p className="hint">Used when no zone rule below matches the order&apos;s destination.</p>
        <div className="grid3">
          <label>Standard parcel<input name="courier_standard" type="number" step="0.01" defaultValue={f("courierStandard")} /></label>
          <label>Bulky parcel<input name="courier_bulky" type="number" step="0.01" defaultValue={f("courierBulky")} /></label>
          <span />
          <label>Return: standard<input name="courier_return_standard" type="number" step="0.01" defaultValue={f("courierReturnStandard")} /></label>
          <label>Return: bulky<input name="courier_return_bulky" type="number" step="0.01" defaultValue={f("courierReturnBulky")} /></label>
        </div>
        <button type="submit">Save shipping</button>
      </form>

      <div className="card">
        <h2>Courier cost by destination</h2>
        <p className="hint">Zone is <b>domestic</b> (same country as the store: {shop.country}), <b>international</b>, or a 2-letter country code such as US or GB. An exact country beats a zone.</p>
        <div className="gt courier"><div className="gh"><span>Zone</span><span>Parcel</span><span>Cost</span><span>Return cost</span><span>Courier</span><span></span></div>
            {(rules ?? []).map((r) => (
              <div key={r.id}>
                  <form action={saveCourierRule} className="rowform">
                    <input name="zone" defaultValue={r.zone} required />
                    <select name="parcel_size" defaultValue={r.parcel_size}><option value="standard">Standard</option><option value="bulky">Bulky</option></select>
                    <input name="cost" type="number" step="0.01" defaultValue={Number(r.cost)} />
                    <input name="return_cost" type="number" step="0.01" defaultValue={Number(r.return_cost)} />
                    <input name="courier" defaultValue={r.courier ?? ""} />
                    <button type="submit">Save</button>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" formAction={deleteCourierRule} className="ghost">Delete</button>
                  </form>
                </div>
            ))}
            <div>
                <form action={saveCourierRule} className="rowform">
                  <input name="zone" placeholder="domestic / international / US" required />
                  <select name="parcel_size"><option value="standard">Standard</option><option value="bulky">Bulky</option></select>
                  <input name="cost" type="number" step="0.01" placeholder="Cost" />
                  <input name="return_cost" type="number" step="0.01" placeholder="Return cost" />
                  <input name="courier" placeholder="e.g. The Courier Guy" />
                  <button type="submit">Add rule</button>
                </form>
              </div>
      </div>
      </div>
    </>
  );
}

async function ProductsTab({ q }: { q?: string }) {
  const shop = await getShop();
  const { bulky, costOverrides } = await loadConfig(shop);
  const today = localDate(new Date(), shop.timezone);
  const { data: lines } = await db().from("order_lines")
    .select("sku, title, quantity, unit_cost, orders!inner(local_date)")
    .eq("shop_id", shop.id).gte("orders.local_date", addDays(today, -120)).limit(10000);
  const bySku = new Map<string, { title: string; units: number; shopifyCost: number | null }>();
  for (const l of lines ?? []) {
    if (!l.sku) continue;
    const r = bySku.get(l.sku) ?? { title: l.title, units: 0, shopifyCost: null };
    r.units += l.quantity;
    if (l.unit_cost != null) r.shopifyCost = Number(l.unit_cost);
    bySku.set(l.sku, r);
  }
  const needle = (q ?? "").toLowerCase();
  const rows = [...bySku.entries()]
    .filter(([sku, r]) => !needle || sku.toLowerCase().includes(needle) || r.title.toLowerCase().includes(needle))
    .sort((a, b) => Number(a[1].shopifyCost != null || costOverrides.has(a[0])) - Number(b[1].shopifyCost != null || costOverrides.has(b[0])) || b[1].units - a[1].units);
  const missing = rows.filter(([sku, r]) => r.shopifyCost == null && !costOverrides.has(sku)).length;
  return (
    <div className="card">
      <h2>Products sold in the last 120 days</h2>
      <form method="get" className="search">
        <input type="hidden" name="tab" value="products" />
        <input name="q" defaultValue={q ?? ""} placeholder="Search SKU or product" />
        <button type="submit">Search</button>
      </form>
      {missing > 0 && <div className="alert">{missing} product{missing > 1 ? "s have" : " has"} no cost. These are listed first.</div>}
      <p className="hint">The cost comes from Shopify (Products → variant → Cost per item). Enter an override only for products whose cost isn&apos;t in Shopify, or when Shopify&apos;s cost is wrong. Amounts are ex VAT, in {shop.currency}.</p>
      <div className="gt products"><div className="gh"><span>SKU / product</span><span>Units</span><span>Shopify cost</span><span>Override cost</span><span>Parcel</span><span></span></div>
          {rows.map(([sku, r]) => (
            <div key={sku}>
                <form action={saveProduct} className="rowform products">
                  <input type="hidden" name="sku" value={sku} />
                  <input type="hidden" name="back" value={`/settings?tab=products${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
                  <span className="sku"><b>{sku}</b><br /><small>{r.title}</small></span>
                  <span>{r.units}</span>
                  <span>{r.shopifyCost != null ? money(r.shopifyCost, shop.currency) : <span className="badge bad">Missing</span>}</span>
                  <input name="cost_override" type="number" step="0.01" defaultValue={costOverrides.get(sku) ?? ""} placeholder="–" />
                  <select name="parcel_size" defaultValue={bulky.has(sku) ? "bulky" : "standard"}><option value="standard">Standard</option><option value="bulky">Bulky</option></select>
                  <button type="submit">Save</button>
                </form>
              </div>
          ))}
      </div>
    </div>
  );
}

const CATEGORIES = ["salaries", "rent", "software", "accounting", "insurance", "utilities", "marketing (non-ads)", "loan repayments", "other"];
const FREQS = [["monthly", "Monthly"], ["weekly", "Weekly"], ["yearly", "Yearly"], ["daily", "Daily"], ["once", "Once-off"]];
const perMonth = (amount: number, f: string) =>
  f === "monthly" ? amount : f === "weekly" ? (amount * 52) / 12 : f === "yearly" ? amount / 12 : f === "daily" ? (amount * 365) / 12 : 0;

async function FixedTab() {
  const shop = await getShop();
  const { data } = await db().from("fixed_costs").select("*").eq("shop_id", shop.id).order("category").order("name");
  const today = localDate(new Date(), shop.timezone);
  const active = (data ?? []).filter((x) => x.start_date <= today && (!x.end_date || x.end_date >= today));
  const monthly = active.reduce((s, x) => s + perMonth(Number(x.amount), x.frequency), 0);
  const costRow = (x?: Record<string, string | number | boolean | null>) => (
    <form action={saveFixedCost} className="rowform fixed">
      {x && <input type="hidden" name="id" value={String(x.id)} />}
      <input name="name" defaultValue={x ? String(x.name) : ""} placeholder="e.g. Warehouse rent" required />
      <select name="category" defaultValue={x ? String(x.category) : "other"}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      <input name="amount" type="number" step="0.01" defaultValue={x ? Number(x.amount) : ""} placeholder="Amount" required />
      <select name="frequency" defaultValue={x ? String(x.frequency) : "monthly"}>{FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input name="start_date" type="date" defaultValue={x ? String(x.start_date) : today.slice(0, 8) + "01"} required />
      <input name="end_date" type="date" defaultValue={x?.end_date ? String(x.end_date) : ""} />
      <label className="check small"><input type="checkbox" name="vat_claimable" defaultChecked={Boolean(x?.vat_claimable)} /> VAT claimable</label>
      <button type="submit">{x ? "Save" : "Add cost"}</button>
      {x && <button type="submit" formAction={deleteFixedCost} className="ghost">Delete</button>}
    </form>
  );
  return (
    <div className="card">
      <h2>Fixed costs</h2>
      <p className="hint">
        These are costs you pay whether or not you sell: salaries, rent, software, accounting and so on. Each cost is spread evenly across the days it covers,
        so the dashboard can show <b>net profit</b> for any date range. Leave the end date empty for costs that are still running. Tick
        &quot;VAT claimable&quot; when the amount includes VAT you claim back. Don&apos;t include ad spend, product costs or courier costs here, because they&apos;re already counted.
      </p>
      <div className="tiles small">
        <div className="tile"><div className="k">Running now</div><div className="v">{active.length}</div></div>
        <div className="tile"><div className="k">Per month</div><div className="v">{money(monthly, shop.currency)}</div><div className="s">recurring, before VAT claims</div></div>
      </div>
      <div className="gt fixed"><div className="gh"><span>Name</span><span>Category</span><span>Amount</span><span>How often</span><span>From</span><span>To</span><span></span></div>
          {(data ?? []).map((x) => <div key={x.id}>{costRow(x)}</div>)}
          <div>{costRow()}</div>
      </div>
    </div>
  );
}
