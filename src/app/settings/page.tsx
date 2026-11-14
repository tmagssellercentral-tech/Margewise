import { db, getShop, loadConfig } from "@/lib/db";
import { addDays, localDate } from "@/lib/dates";
import { findFeeRule } from "@/lib/engine";
import { Flash } from "../nav";
import { Shell } from "../shell";
import { FixedCosts } from "../components/fixed-costs";
import {
  addManualSpend, applyFeePreset, saveTxnFee, deleteCourierRule, deleteFeeRule, deleteUploadedSpend, importCourierCsv,
  importSpendCsv, saveCourierRule, saveFeeRule, saveProduct, saveShipping, saveStore,
} from "./actions";
import { PLATFORMS, isConfigured, platformName } from "@/lib/platforms";
import { FEE_PRESETS } from "@/lib/fee-presets";
import { PLANS, PUBLIC_PLANS, planOf, usage } from "@/lib/plans";
import { UpgradeLink } from "../components/plan";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "store", label: "Store & tax" },
  { key: "fees", label: "Payment fees" },
  { key: "shipping", label: "Shipping & packaging" },
  { key: "products", label: "Products" },
  { key: "fixed", label: "Fixed costs" },
  { key: "ads", label: "Ad platforms" },
  { key: "plan", label: "Plan" },
];

type SP = Promise<Record<string, string | undefined>>;

export default async function Settings({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "store";
  const shop = await getShop();
  return (
    <Shell active="settings" shopName={shop.name}>
      <header className="pagehead"><div><h1>Settings</h1><p className="sub">Costs, fees, tax and connections that feed every profit figure</p></div></header>
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
      {tab === "fixed" && <FixedCosts back="/settings?tab=fixed" />}
      {tab === "ads" && <AdsTab />}
      {tab === "plan" && <PlanTab />}
    </Shell>
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
  const { rules, config } = await loadConfig(shop);
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
        <div className="gt fees"><div className="gh"><span>Name starts with</span><span>% of order</span><span>Fixed fee</span><span>Minimum</span><span>Maximum</span><span>Note</span><span></span></div>
            {(data ?? []).map((r) => (
              <div key={r.id}>
                  <form action={saveFeeRule} className="rowform">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="gateway_match" defaultValue={r.gateway_match} required />
                    <input name="pct" type="number" step="0.001" defaultValue={+(Number(r.pct) * 100).toFixed(3)} />
                    <input name="fixed_fee" type="number" step="0.01" defaultValue={Number(r.fixed_fee)} />
                    <input name="min_fee" type="number" step="0.01" defaultValue={Number(r.min_fee)} />
                    <input name="max_fee" type="number" step="0.01" defaultValue={r.max_fee ?? ""} placeholder="none" />
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
                  <input name="max_fee" type="number" step="0.01" placeholder="none" />
                  <input name="note" placeholder="Where the rate comes from" />
                  <button type="submit">Add rule</button>
                </form>
              </div>
          </div>
        <p className="hint">Amounts are in {shop.currency}. Enter the % as a number, e.g. 2.95 for 2.95%. Leave Maximum empty when there&apos;s no cap.</p>
      </div>

      <form action={applyFeePreset} className="card form">
        <h2>Add standard rates for a region</h2>
        <p className="hint">This adds the published rates of common gateways you don&apos;t have a rule for yet. It never changes your existing rules. Always check them against your own contract.</p>
        <div className="rowform upload">
          <select name="preset" defaultValue={FEE_PRESETS.find((p) => p.currency === shop.currency)?.key ?? "us"}>
            {FEE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.name} ({p.rules.length} rates)</option>)}
          </select>
          <button type="submit">Add rates</button>
        </div>
        <ul className="hint">
          {FEE_PRESETS.filter((p) => p.contractOnly.length).map((p) => (
            <li key={p.key}><b>{p.name}:</b> {p.contractOnly.join(", ")} set rates per merchant, so add your contract rate by hand.</li>
          ))}
        </ul>
      </form>

      <form action={saveTxnFee} className="card form">
        <h2>Shopify transaction fee</h2>
        <p className="hint">
          Shopify charges an extra fee on orders that aren&apos;t paid through Shopify Payments (Shop Pay included) or a manual method. In the US, Canada and EU it&apos;s
          2% on Basic, 1% on Grow, 0.6% on Advanced and 0.2% on Plus. Shopify bills it in total, so Margewise can&apos;t read it per order. Check
          <b> Settings → Billing → Transaction fees</b> in Shopify, and enter 0 if you don&apos;t pay it. Shopify Payments isn&apos;t available in South Africa, so check your bill to see whether it applies.
        </p>
        <div className="rowform upload">
          <label>% of order total<input name="shopify_txn_fee_pct" type="number" step="0.01" min="0" max="5" defaultValue={+((config.shopifyTxnFeePct ?? 0) * 100).toFixed(2)} /></label>
          <button type="submit">Save</button>
        </div>
      </form>
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

      <form action={importCourierCsv} className="card form">
        <h2>Upload a courier invoice (actual cost per order)</h2>
        <p className="hint">
          This works with any courier. Export your invoice or statement as a CSV with an <b>order number</b> column (order, reference or order_number)
          and a <b>cost</b> column (cost, amount or total). Margewise matches each line to the Shopify order and uses that cost instead of the rates above.
          If an order has several lines, for example two parcels, they&apos;re added together. Amounts are ex VAT, in {shop.currency}.
        </p>
        <div className="rowform upload"><input type="file" name="file" accept=".csv,text/csv" required /><button type="submit">Upload invoice</button></div>
      </form>
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

async function AdsTab() {
  const shop = await getShop();
  const today = localDate(new Date(), shop.timezone);
  const [{ data: runs }, { data: uploaded }] = await Promise.all([
    db().from("sync_runs").select("kind, status, finished_at, detail").eq("shop_id", shop.id).order("started_at", { ascending: false }).limit(60),
    db().from("ad_spend_daily").select("platform, date, spend").eq("shop_id", shop.id).eq("account_id", "csv").gte("date", addDays(today, -400)).limit(20000),
  ]);
  const lastRun = new Map<string, { status: string; finished_at: string | null; detail: string | null }>();
  for (const r of runs ?? []) if (!lastRun.has(r.kind)) lastRun.set(r.kind, r);
  const months = new Map<string, { platform: string; month: string; spend: number; days: Set<string> }>();
  for (const u of uploaded ?? []) {
    const k = `${u.platform}|${u.date.slice(0, 7)}`;
    const m = months.get(k) ?? { platform: u.platform, month: u.date.slice(0, 7), spend: 0, days: new Set<string>() };
    m.spend += Number(u.spend);
    m.days.add(u.date);
    months.set(k, m);
  }
  return (
    <>
      <div className="card">
        <h2>Ad platforms</h2>
        <p className="hint">Connected platforms sync every night and re-check the last 3 days. Spend billed in another currency is converted at that day&apos;s European Central Bank rate.</p>
        <table>
          <thead><tr><th>Platform</th><th>How</th><th>Status</th><th>Last sync</th></tr></thead>
          <tbody>
            {PLATFORMS.map((p) => {
              const run = lastRun.get(p.key);
              // Connections set up in the environment belong to the owner store only.
              const on = p.kind === "connector" && shop.is_owner !== false && isConfigured(p);
              return (
                <tr key={p.key}>
                  <td>{p.name}</td>
                  <td>{p.kind === "connector" ? "Automatic" : "CSV or manual"}</td>
                  <td>{p.kind === "upload" ? <span className="hint">{p.note}</span>
                    : on ? (run?.status === "error" ? <span className="badge bad">Error</span> : <span className="badge ok">Connected</span>)
                    : <span className="badge">Not connected</span>}</td>
                  <td>{p.kind === "connector" && run?.finished_at ? new Date(run.finished_at).toLocaleString("en-ZA", { timeZone: shop.timezone }) : "–"}
                    {p.kind === "connector" && run?.status === "error" && <div className="hint">{run.detail?.slice(0, 160)}</div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form action={importSpendCsv} className="card form">
        <h2>Upload ad spend (CSV)</h2>
        <p className="hint">
          Use this for any platform without a connector, such as Microsoft, X, Reddit, Amazon or affiliates. Needed columns: <b>date</b> and <b>spend</b>. Optional: <b>platform</b>, <b>campaign</b>,
          <b> conversion_value</b> (or revenue) and <b>currency</b>. Uploading the same day and campaign again replaces it, so re-uploading a month is safe. Don&apos;t upload spend for
          a platform that&apos;s also connected, or it will be counted twice.
        </p>
        <div className="rowform upload"><input type="file" name="file" accept=".csv,text/csv" required /><button type="submit">Upload spend</button></div>
      </form>

      <form action={addManualSpend} className="card form">
        <h2>Add spend manually</h2>
        <div className="grid3">
          <label>Date<input type="date" name="date" defaultValue={addDays(today, -1)} max={today} required /></label>
          <label>Platform<input name="platform" list="platforms" placeholder="e.g. influencer" required /></label>
          <label>Campaign / description<input name="campaign" placeholder="e.g. @fitcoach reel" /></label>
          <label>Spend<input name="spend" type="number" step="0.01" required /></label>
          <label>Currency<input name="currency" defaultValue={shop.currency} maxLength={3} /></label>
          <label>Sales it brought in (optional)<input name="conversion_value" type="number" step="0.01" /></label>
        </div>
        <datalist id="platforms">{PLATFORMS.filter((p) => p.kind === "upload").map((p) => <option key={p.key} value={p.key} />)}</datalist>
        <button type="submit">Add spend</button>
      </form>

      {months.size > 0 && (
        <div className="card">
          <h2>Uploaded and manual spend</h2>
          <table>
            <thead><tr><th>Platform</th><th>Month</th><th>Days</th><th>Spend ({shop.currency})</th><th></th></tr></thead>
            <tbody>
              {[...months.values()].sort((a, b) => b.month.localeCompare(a.month) || a.platform.localeCompare(b.platform)).map((m) => (
                <tr key={`${m.platform}${m.month}`}>
                  <td>{platformName(m.platform)}</td><td>{m.month}</td><td>{m.days.size}</td><td>{money(m.spend, shop.currency)}</td>
                  <td>
                    <form action={deleteUploadedSpend}>
                      <input type="hidden" name="platform" value={m.platform} /><input type="hidden" name="month" value={m.month} />
                      <button type="submit" className="ghost">Delete month</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const PLAN_POINTS: Record<string, string[]> = {
  free: ["Up to 100 orders a month", "True profit dashboard", "Profit & loss, expenses, exports", "All ad platforms"],
  starter: ["Up to 500 orders a month", "Everything in Free", "Customer acquisition cost (CAC)", "14-day free trial"],
  growth: ["Up to 1,500 orders a month", "Everything in Starter", "Repeat purchase rate and LTV", "Campaign profit vs break-even"],
  scale: ["Up to 5,000 orders a month", "Everything in Growth", "Priority support"],
};

async function PlanTab() {
  const shop = await getShop();
  const today = localDate(new Date(), shop.timezone);
  const u = await usage(shop, today);
  const current = planOf(shop);
  if (current.key === "owner") {
    return <div className="card"><h2>Plan</h2><p className="hint">This is the owner store: every feature, no order limit and no charge.</p></div>;
  }
  return (
    <div className="card">
      <h2>Plan</h2>
      <p>
        You&apos;re on <b>{current.name}</b>{shop.plan_interval === "ANNUAL" ? " (billed yearly)" : ""}.
        {u.limit != null && <> {u.orders.toLocaleString("en-US")} of {u.limit.toLocaleString("en-US")} orders used this month.</>}
      </p>
      <div className="plans">
        {PUBLIC_PLANS.map((p) => (
          <div key={p.key} className={p.key === current.key ? "on" : ""}>
            <h3>{p.name}{p.key === current.key && <span className="badge ok" style={{ marginLeft: 8 }}>Current</span>}</h3>
            <div className="price">{p.monthly ? `$${p.monthly}` : "Free"}<small className="hint">{p.monthly ? " /month" : ""}</small></div>
            {p.annual && <div className="hint">or ${p.annual.toLocaleString("en-US")}/year (20% off)</div>}
            <ul>{PLAN_POINTS[p.key].map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        ))}
      </div>
      <p className="hint">More than {PLANS.scale.orderLimit!.toLocaleString("en-US")} orders a month? Email support@margewise.io about the Plus plan. Prices in US dollars, billed by Shopify with your store&apos;s other charges.</p>
      <UpgradeLink shop={shop}>Change plan</UpgradeLink>
    </div>
  );
}
