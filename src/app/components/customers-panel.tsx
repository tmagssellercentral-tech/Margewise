import type { CustomerMetrics } from "@/lib/customers";
import { fmt, pct, x } from "./ui";

/** New vs returning customers, CAC, repeat rate and LTV. */
export function CustomersPanel({ c, ccy }: { c: CustomerMetrics | undefined; ccy: string }) {
  if (!c || !c.known) {
    return (
      <section className="panel customers">
        <div className="ph"><h2>Customers</h2></div>
        <div className="empty left">
          <b>Customer metrics are switched off.</b> To show new vs returning customers, CAC, repeat purchase rate and LTV,
          Margewise needs Shopify&apos;s <code>read_customers</code> permission. It stores only an anonymous customer number per order, never names or emails.
          <div>To turn it on, add <code>read_customers</code> to the app&apos;s access scopes in the Shopify Dev Dashboard, then load your order history once.</div>
        </div>
      </section>
    );
  }
  const total = c.newOrders + c.returningOrders;
  const since = c.historySince ? new Date(c.historySince).toLocaleDateString("en-ZA", { month: "short", year: "numeric" }) : null;
  return (
    <section className="panel customers">
      <div className="ph"><h2>Customers</h2><span className="legend"><i className="lg new" />New <i className="lg ret" />Returning</span></div>
      <div className="split" aria-label={`${c.newOrders} orders from new customers, ${c.returningOrders} from returning customers`}>
        <span className="new" style={{ width: `${total ? (c.newOrders / total) * 100 : 0}%` }}>{c.newOrders ? `${c.newOrders} orders from new customers` : ""}</span>
        <span className="ret" style={{ width: `${total ? (c.returningOrders / total) * 100 : 0}%` }}>{c.returningOrders ? `${c.returningOrders} from returning` : ""}</span>
      </div>
      <div className="cstats">
        <div title="Ad spend divided by the number of first-time customers in this period."><span>CAC</span><b>{c.cac != null ? fmt(ccy, c.cac) : "–"}</b><small>ad spend ÷ {c.newCustomers} new customers</small></div>
        <div title="Share of this period's customers who had bought before."><span>Returning customers</span><b>{pct(c.returningCustomerRate, 0)}</b><small>{c.returningCustomers} of {c.customers} customers</small></div>
        <div title="Share of revenue from returning customers in this period."><span>Revenue from returning</span><b>{pct(c.returningRevenueShare, 0)}</b><small>{fmt(ccy, c.returningRevenue)} of {fmt(ccy, c.newRevenue + c.returningRevenue)}</small></div>
        <div title="Share of all customers ever who ordered more than once."><span>Repeat purchase rate</span><b>{pct(c.repeatRate, 0)}</b><small>{c.ordersPerCustomer != null ? `${c.ordersPerCustomer.toFixed(2)} orders per customer` : ""}{since ? `, since ${since}` : ""}</small></div>
        <div title="Average lifetime net revenue per customer, times this period's contribution margin. An estimate."><span>LTV (est. profit)</span><b>{c.ltvProfit != null ? fmt(ccy, c.ltvProfit) : "–"}</b><small>{c.ltvRevenue != null ? `${fmt(ccy, c.ltvRevenue)} revenue per customer` : ""}</small></div>
        <div title="Lifetime profit per customer divided by the cost of acquiring one. Above 3x is generally healthy."><span>LTV : CAC</span><b>{x(c.ltvToCac)}{c.ltvToCac != null && (c.ltvToCac >= 3 ? <em className="badge ok">healthy</em> : c.ltvToCac >= 1 ? <em className="badge">thin</em> : <em className="badge bad">losing</em>)}</b><small>lifetime profit ÷ CAC</small></div>
      </div>
      {c.guestOrders > 0 && <p className="note">{c.guestOrders} order{c.guestOrders > 1 ? "s" : ""} had no customer attached and {c.guestOrders > 1 ? "aren't" : "isn't"} counted here.</p>}
    </section>
  );
}
