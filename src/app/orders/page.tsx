import { db, getShop } from "@/lib/db";
import { computeRange } from "@/lib/sync";
import { localDate } from "@/lib/dates";
import { resolveRange } from "@/lib/range";
import { ExportLinks } from "../components/export-links";
import { RangePicker } from "../components/range-picker";
import { Flash } from "../nav";
import { Shell } from "../shell";
import { saveOrder } from "../settings/actions";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

const STATUS = [
  ["none", "Delivered"],
  ["returned_restocked", "Returned: back in stock"],
  ["returned_written_off", "Returned: written off"],
  ["failed_delivery", "Failed delivery"],
];

export default async function Orders({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const shop = await getShop();
  const today = localDate(new Date(), shop.timezone);
  const range = resolveRange(sp.range ?? "30d", today, sp.from, sp.to);
  const [{ data: orders }, r] = await Promise.all([
    db().from("orders")
      .select("id, name, local_date, gateway, shipping_incl, return_status, actual_courier, cancelled, order_lines(line_total_incl)")
      .eq("shop_id", shop.id).gte("local_date", range.from).lte("local_date", range.to)
      .order("created_at", { ascending: false }).limit(2000),
    computeRange(shop, range.from, range.to),
  ]);
  const byName = new Map(r.results.map((x) => [x.name, x]));
  const qs = range.key === "custom" ? `from=${range.from}&to=${range.to}` : `range=${range.key}`;
  const fmt = (n: number) => n.toLocaleString(shop.currency === "ZAR" ? "en-ZA" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const returns = (orders ?? []).filter((o) => o.return_status !== "none").length;

  return (
    <Shell active="orders" shopName={shop.name}>
      <header className="pagehead">
        <div>
          <h1>Orders</h1>
          <p className="sub">{range.from} to {range.to} · {(orders ?? []).length} orders · {returns} returned or failed</p>
        </div>
        <div className="headtools">
          <RangePicker current={range.key} from={range.from} to={range.to} max={today} />
          <ExportLinks kind="orders" query={range.key === "custom" ? `from=${range.from}&to=${range.to}` : `range=${range.key}`} />
        </div>
      </header>
      <Flash saved={sp.saved} error={sp.error} />
      <p className="hint">
        Mark returns and failed deliveries here. <b>Back in stock</b> and <b>failed delivery</b> cancel the product cost, because the item comes back. <b>Written off</b> keeps it.
        Both add the return courier and handling cost. If you know the real courier cost of an order, for example from an invoice, enter it to replace the standard rate.
      </p>
      <div className="panel">
        <div className="gt orders">
          <div className="gh"><span>Order</span><span>Date</span><span>Paid ({shop.currency})</span><span>Payment</span><span>Status</span><span>Actual courier</span><span>Contribution</span></div>
          {(orders ?? []).map((o) => {
            const res = byName.get(o.name);
            const paid = (o.order_lines ?? []).reduce((s: number, l: { line_total_incl: number }) => s + Number(l.line_total_incl), 0) + Number(o.shipping_incl);
            return (
              <form key={o.id} action={saveOrder} className="rowform">
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="back" value={`/orders?${qs}`} />
                <span><b>{o.name}</b>{o.cancelled && <small> (cancelled)</small>}</span>
                <span>{o.local_date}</span>
                <span>{fmt(res?.totalIncl ?? paid)}</span>
                <span>{o.gateway ?? "–"}</span>
                <select name="return_status" defaultValue={o.return_status}>
                  {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input name="actual_courier" type="number" step="0.01" defaultValue={o.actual_courier ?? ""} placeholder={res ? fmt(res.courier) : "–"} />
                <span className="rowend">
                  <span className={res && res.contribution < 0 ? "neg" : "pos"}>{res ? fmt(res.contribution) : "–"}</span>
                  <button type="submit">Save</button>
                </span>
              </form>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
