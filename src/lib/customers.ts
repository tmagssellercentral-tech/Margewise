// New vs returning customers, CAC, repeat rate and LTV. Pure: the caller supplies the orders in
// range (with anonymous customer numbers), each customer's first order, and all-time totals.

export interface CustomerOrder {
  shopifyId: number;
  customerId: number | null;
  netRevenue: number;
}

export interface LifetimeSummary {
  customers: number;
  repeatCustomers: number;
  orders: number;
  netIncl: number; // all-time paid, after refunds, incl VAT
  firstOrderAt: string | null;
}

export interface CustomerMetrics {
  known: boolean; // false until customer numbers are available
  customers: number;
  newCustomers: number;
  returningCustomers: number;
  newOrders: number;
  returningOrders: number;
  guestOrders: number;
  newRevenue: number;
  returningRevenue: number;
  returningCustomerRate: number | null; // share of this period's customers who had bought before
  returningRevenueShare: number | null;
  cac: number | null; // ad spend ÷ new customers
  repeatRate: number | null; // all-time share of customers with 2+ orders
  ordersPerCustomer: number | null; // all-time
  ltvRevenue: number | null; // all-time net revenue (ex VAT) per customer
  ltvProfit: number | null; // ltvRevenue × contribution margin (an estimate)
  ltvToCac: number | null;
  historySince: string | null;
}

export function computeCustomerMetrics(input: {
  orders: CustomerOrder[];
  firstOrder: Map<number, number>; // customer → their first order's Shopify id
  adSpend: number;
  summary: LifetimeSummary | null;
  revenueDivisor: number; // e.g. 1.15 when prices include 15% VAT
  contributionMargin: number | null;
}): CustomerMetrics {
  const { orders, firstOrder, adSpend, summary, revenueDivisor, contributionMargin } = input;
  const withCustomer = orders.filter((o) => o.customerId != null);
  const known = withCustomer.length > 0;
  const customers = new Set(withCustomer.map((o) => o.customerId!));
  const newSet = new Set<number>();
  let newOrders = 0, returningOrders = 0, newRevenue = 0, returningRevenue = 0;
  for (const o of withCustomer) {
    const isNew = firstOrder.get(o.customerId!) === o.shopifyId;
    if (isNew) { newOrders++; newRevenue += o.netRevenue; newSet.add(o.customerId!); }
    else { returningOrders++; returningRevenue += o.netRevenue; }
  }
  const newCustomers = newSet.size;
  const returningCustomers = customers.size - newCustomers;
  const div = (a: number, b: number) => (b ? a / b : null);
  const ltvRevenue = summary && summary.customers ? summary.netIncl / revenueDivisor / summary.customers : null;
  const ltvProfit = ltvRevenue != null && contributionMargin != null ? ltvRevenue * contributionMargin : null;
  const cac = newCustomers && adSpend ? adSpend / newCustomers : null;
  return {
    known,
    customers: customers.size,
    newCustomers,
    returningCustomers,
    newOrders,
    returningOrders,
    guestOrders: orders.length - withCustomer.length,
    newRevenue,
    returningRevenue,
    returningCustomerRate: div(returningCustomers, customers.size),
    returningRevenueShare: div(returningRevenue, newRevenue + returningRevenue),
    cac,
    repeatRate: summary ? div(summary.repeatCustomers, summary.customers) : null,
    ordersPerCustomer: summary ? div(summary.orders, summary.customers) : null,
    ltvRevenue,
    ltvProfit,
    ltvToCac: ltvProfit != null && cac ? ltvProfit / cac : null,
    historySince: summary?.firstOrderAt ?? null,
  };
}
