// Reads orders from the Shopify Admin GraphQL API with a custom-app access token.

const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2026-07";

export interface ShopifyLine {
  sku: string | null;
  title: string;
  quantity: number;
  discountedTotalSet: { shopMoney: { amount: string } };
  variant: { inventoryItem: { unitCost: { amount: string } | null } | null } | null;
}

export interface ShopifyOrder {
  id: string; // gid://shopify/Order/123
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  sourceName: string | null;
  paymentGatewayNames: string[];
  displayFinancialStatus: string | null;
  totalShippingPriceSet: { shopMoney: { amount: string } };
  totalRefundedSet: { shopMoney: { amount: string } };
  lineItems: { nodes: ShopifyLine[]; pageInfo: { hasNextPage: boolean } };
}

const ORDERS_QUERY = `
query Orders($first: Int!, $after: String, $q: String!) {
  orders(first: $first, after: $after, query: $q, sortKey: UPDATED_AT) {
    nodes {
      id name createdAt cancelledAt sourceName paymentGatewayNames displayFinancialStatus
      totalShippingPriceSet { shopMoney { amount } }
      totalRefundedSet { shopMoney { amount } }
      lineItems(first: 100) {
        nodes {
          sku title quantity
          discountedTotalSet { shopMoney { amount } }
          variant { inventoryItem { unitCost { amount } } }
        }
        pageInfo { hasNextPage }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const store = process.env.SHOPIFY_STORE; // e.g. flexi-muscles.myshopify.com
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!store || !token) throw new Error("SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN must be set");
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://${store}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    const body = await res.json();
    if (!res.ok || body.errors) {
      const throttled = JSON.stringify(body.errors ?? "").includes("THROTTLED");
      if (throttled) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw new Error(`Shopify ${res.status}: ${JSON.stringify(body.errors ?? body).slice(0, 500)}`);
    }
    return body.data as T;
  }
  throw new Error("Shopify API kept throttling; try again later");
}

/** Website orders updated on or after `sinceIso` (catches later refunds and cancellations). */
export async function fetchOrdersUpdatedSince(sinceIso: string): Promise<ShopifyOrder[]> {
  const q = `updated_at:>='${sinceIso}' source_name:web`;
  const out: ShopifyOrder[] = [];
  let after: string | null = null;
  do {
    const data: { orders: { nodes: ShopifyOrder[]; pageInfo: { hasNextPage: boolean; endCursor: string } } } =
      await gql(ORDERS_QUERY, { first: 50, after, q });
    out.push(...data.orders.nodes);
    after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
  } while (after);
  return out;
}

export const money = (m: { shopMoney: { amount: string } } | null | undefined) =>
  m ? Number(m.shopMoney.amount) : 0;

export const numericId = (gid: string) => Number(gid.split("/").pop());
