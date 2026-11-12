import { db, getShop } from "@/lib/db";
import { localDate } from "@/lib/dates";
import { deleteFixedCost, saveFixedCost } from "../settings/actions";

const money = (n: number, ccy: string) =>
  `${ccy} ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORIES = ["salaries", "rent", "software", "accounting", "insurance", "utilities", "marketing (non-ads)", "loan repayments", "other"];
const FREQS = [["monthly", "Monthly"], ["weekly", "Weekly"], ["yearly", "Yearly"], ["daily", "Daily"], ["once", "Once-off"]];
const perMonth = (amount: number, f: string) =>
  f === "monthly" ? amount : f === "weekly" ? (amount * 52) / 12 : f === "yearly" ? amount / 12 : f === "daily" ? (amount * 365) / 12 : 0;

export async function FixedCosts({ back }: { back: string }) {
  const shop = await getShop();
  const { data } = await db().from("fixed_costs").select("*").eq("shop_id", shop.id).order("category").order("name");
  const today = localDate(new Date(), shop.timezone);
  const active = (data ?? []).filter((x) => x.start_date <= today && (!x.end_date || x.end_date >= today));
  const monthly = active.reduce((s, x) => s + perMonth(Number(x.amount), x.frequency), 0);
  const costRow = (x?: Record<string, string | number | boolean | null>) => (
    <form action={saveFixedCost} className="rowform fixed">
      <input type="hidden" name="back" value={back} />
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

