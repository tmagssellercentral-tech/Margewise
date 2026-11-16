// Copy for the solution pages. Each page targets what a store owner would search for.

export interface Solution {
  slug: string;
  nav: string; // menu label
  blurb: string; // one line in the menu and footer
  title: string; // <title>
  description: string; // meta description
  h1: string;
  intro: string;
  image: string;
  imageAlt: string;
  points: { t: string; d: string }[];
  faqs: { q: string; a: string }[];
}

export const SOLUTIONS: Solution[] = [
  {
    slug: "profit-dashboard",
    nav: "Profit dashboard",
    blurb: "Net profit for any day, week or month",
    title: "Shopify profit dashboard: real-time net profit after every cost",
    description:
      "See your Shopify store's net profit for today, this week or any date range, after product costs, payment fees, shipping, returns, tax and ad spend.",
    h1: "Your net profit, today, not at month end",
    intro:
      "Shopify tells you what you sold. Margewise tells you what you kept. Every order is costed the moment it arrives, so the number on your dashboard is profit after product cost, payment fees, shipping, packaging, returns, tax and ads.",
    image: "/site/overview.webp",
    imageAlt: "Margewise overview showing net profit, net revenue, total costs, orders and ad spend for a demo store",
    points: [
      { t: "Any date range", d: "Today, yesterday, the last 7 or 30 days, this month or a custom range, compared with the period before." },
      { t: "Where the money went", d: "A breakdown of every cost as a share of revenue, so you can see which one is eating your margin." },
      { t: "Revenue you can trust", d: "Sales are shown without VAT or sales tax and after refunds, so profit is never overstated." },
      { t: "Profit per order", d: "Average order value, profit per order and contribution before ads, the numbers that decide how much you can spend to win a customer." },
    ],
    faqs: [
      { q: "How is net profit calculated?", a: "Net revenue (sales after discounts and refunds, without tax) minus product cost, payment fees, shipping, packaging, returns, ad spend and your fixed costs." },
      { q: "How often does it update?", a: "New, changed and refunded orders update within minutes. Ad spend syncs every night, and you can sync on demand." },
    ],
  },
  {
    slug: "ad-profit-tracking",
    nav: "Ad profit tracking",
    blurb: "MER, ROAS and POAS against your break-even",
    title: "Ad profit tracking for Shopify: MER, blended ROAS, break-even ROAS and POAS",
    description:
      "Track Meta, Google, TikTok, Pinterest and Snapchat ad spend against real profit. Margewise shows MER, blended ROAS, break-even ROAS and POAS, and marks every campaign above or below break-even.",
    h1: "Know which ads make money, not just sales",
    intro:
      "A 3x ROAS can still lose money. Margewise works out the ROAS your store needs to break even from your actual costs, then marks each ad platform, and on Growth and above each campaign, above or below that line.",
    image: "/site/marketing.webp",
    imageAlt: "Margewise marketing page with ad spend, MER, blended ROAS, break-even ROAS, POAS and campaigns marked above or below break-even",
    points: [
      { t: "MER", d: "All store sales divided by all ad spend. The honest measure of whether advertising is working, whatever the platforms claim." },
      { t: "Blended ROAS", d: "Sales the ad platforms report, divided by ad spend, across every platform at once." },
      { t: "Break-even ROAS", d: "The return you need just to cover product and order costs, worked out from your own numbers." },
      { t: "POAS", d: "Profit before ads per unit of ad spend. Above 1, the ads paid for themselves." },
    ],
    faqs: [
      { q: "Which ad platforms are supported?", a: "Meta (Facebook and Instagram), Google Ads, TikTok, Pinterest and Snapchat connect directly, read-only. For any other channel, upload a CSV or enter spend by hand." },
      { q: "Does Margewise change my ads?", a: "No. Access is read-only: Margewise reads daily spend and conversion value per campaign and never creates or edits anything." },
      { q: "What about ad spend in another currency?", a: "Each day's spend is converted to your store currency at that day's European Central Bank rate." },
    ],
  },
  {
    slug: "product-profit",
    nav: "Product profit",
    blurb: "Margin and profit for every SKU",
    title: "Shopify product profit: margin and profit by SKU",
    description:
      "See revenue, cost, margin and profit for every product and variant in your Shopify store, so you know which products to push and which to fix or drop.",
    h1: "Find the products that carry your store",
    intro:
      "Best sellers are not always best earners. Margewise shows revenue, units, product cost, margin and profit for every SKU, using the cost in Shopify or one you set in Margewise.",
    image: "/site/products.webp",
    imageAlt: "Margewise products page listing revenue, units, cost and margin by SKU for a demo store",
    points: [
      { t: "Profit by SKU", d: "Revenue, units sold, product cost and gross margin for each product and variant." },
      { t: "Your costs, your way", d: "Use the cost per item in Shopify, or set your own cost for any SKU in Margewise." },
      { t: "Missing costs flagged", d: "Products without a cost are listed, so they don't quietly inflate your profit." },
      { t: "Excel and CSV export", d: "Download any table for your own analysis or your accountant." },
    ],
    faqs: [
      { q: "Where do product costs come from?", a: "From the cost per item in Shopify. You can override it for any SKU in Margewise." },
      { q: "Can I include packaging?", a: "Yes. Add a packaging cost per order, or by parcel size for bulky items." },
    ],
  },
  {
    slug: "profit-and-loss",
    nav: "Profit & loss report",
    blurb: "A monthly P&L your accountant will recognise",
    title: "Shopify P&L report: monthly profit and loss statement",
    description:
      "A monthly profit and loss statement for your Shopify store, from revenue down to net profit, with fixed costs included and an Excel export for your accountant.",
    h1: "A real profit and loss statement, every month",
    intro:
      "Built by a chartered accountant, the Margewise P&L follows the shape your accountant expects: net revenue, cost of goods, gross profit, order costs, marketing, fixed costs and net profit, month by month.",
    image: "/site/profit-and-loss.webp",
    imageAlt: "Margewise profit and loss statement by month for a demo store",
    points: [
      { t: "Month by month", d: "Compare months side by side and see where margin moved." },
      { t: "Fixed costs included", d: "Add rent, salaries, software and other overheads, monthly or one-off, so net profit is complete." },
      { t: "Tax handled", d: "Prices including VAT or sales tax added at checkout: revenue is always shown without it." },
      { t: "Download to Excel", d: "One click for a formatted workbook to share or file." },
    ],
    faqs: [
      { q: "Is this a replacement for my accounting software?", a: "No. It is a management P&L built from your orders and ad spend, so you see profit daily instead of waiting for the books to close." },
    ],
  },
  {
    slug: "customer-ltv-cac",
    nav: "Customer LTV & CAC",
    blurb: "What a customer costs and what they're worth",
    title: "Shopify customer acquisition cost (CAC) and lifetime value (LTV)",
    description:
      "Track new versus returning customers, customer acquisition cost, repeat purchase rate, lifetime value and LTV:CAC for your Shopify store.",
    h1: "What each customer costs, and what they're worth",
    intro:
      "Margewise separates first orders from repeat orders, so you can see what you pay to win a new customer and how much they spend over time.",
    image: "/site/overview-costs.webp",
    imageAlt: "Margewise customer metrics: new vs returning orders, CAC, repeat purchase rate, LTV and LTV:CAC for a demo store",
    points: [
      { t: "New vs returning", d: "Revenue and orders from first-time and repeat customers." },
      { t: "CAC", d: "Ad spend divided by new customers, for any date range." },
      { t: "Repeat rate and LTV", d: "How many customers come back and what they're worth over time." },
      { t: "LTV:CAC", d: "Whether the customers you're buying are worth what you pay for them." },
    ],
    faqs: [
      { q: "Do you store customer names or emails?", a: "No. Margewise uses only Shopify's internal customer number to tell new customers from returning ones." },
      { q: "Which plan includes these?", a: "CAC and new versus returning customers are on Starter and above. Repeat rate, LTV and LTV:CAC are on Growth and above." },
    ],
  },
  {
    slug: "cost-tracking",
    nav: "Fees, shipping & tax",
    blurb: "The costs most dashboards guess",
    title: "Shopify cost tracking: payment fees, shipping, returns and tax",
    description:
      "Track the real cost of every Shopify order: payment gateway fees by provider, courier cost by destination, packaging, returns and VAT or sales tax, in any currency.",
    h1: "Every cost on every order, not an average",
    intro:
      "Payment fees, couriers and tax differ by country and by provider. Margewise reads Shopify Payments' actual fees, applies your gateway's published rates and costs shipping by destination and parcel size.",
    image: "/site/overview.webp",
    imageAlt: "Margewise breakdown of where the money went: product cost, ads, courier, payment fees, packaging and fixed costs for a demo store",
    points: [
      { t: "Payment fees", d: "Actual Shopify Payments fees, ready-made rates for PayPal, Mollie, Amazon Pay and local gateways like PayFast, Peach, Paystack, Flutterwave and Razorpay, and your own contract rate for Klarna, Afterpay or anything else." },
      { t: "Shipping and couriers", d: "Cost by destination and parcel size, or upload your courier's invoice for the exact cost of each order." },
      { t: "Returns and packaging", d: "Return costs and packaging per order, so refunds don't hide what they really cost you." },
      { t: "VAT and sales tax", d: "Tax-inclusive or tax-exclusive pricing, handled per store. Revenue is always shown without tax." },
    ],
    faqs: [
      { q: "Does it work outside the US and UK?", a: "Yes. Fee packs cover the US, Canada, the UK, Europe, Australia, South Africa, Nigeria, Kenya, India, the UAE and Saudi Arabia, and any store can set its own rates." },
    ],
  },
];

export const solution = (slug: string) => SOLUTIONS.find((s) => s.slug === slug);

export const FAQ = [
  { q: "What does Margewise do?", a: "Margewise is a Shopify app that calculates your true profit: revenue after product costs, payment fees, shipping, packaging, returns, tax, ad spend and fixed costs, for every order and any date range." },
  { q: "How much does it cost?", a: "Free for up to 100 orders a month. Paid plans start at $29 a month, with a 14-day free trial and 20% off when you pay yearly." },
  { q: "Which ad platforms connect?", a: "Meta, Google Ads, TikTok, Pinterest and Snapchat connect directly, read-only. Any other channel can be added by CSV upload or manual entry." },
  { q: "Will it work for my country and currency?", a: "Yes. Margewise works in your store's currency, converts ad spend from other currencies daily and handles VAT-inclusive and sales-tax pricing." },
  { q: "Is my data safe?", a: "Access is read-only, sign-ins are encrypted, and Margewise stores no customer names, emails or addresses. Uninstalling deletes your store's data." },
];
