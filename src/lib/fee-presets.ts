// Starter payment-fee rules by region, from each provider's published pricing (checked Nov 2026).
// Applying a pack only adds rules for gateways the store doesn't have yet; merchants should still
// check against their own contract. Shopify Payments' real fee is read per order when available,
// so its rule is only a fallback. Buy-now-pay-later providers (Klarna, Afterpay/Clearpay, Affirm,
// Zip, Tabby, Tamara) set rates per merchant, so they're listed as "add your contract rate".

export interface PresetRule {
  gatewayMatch: string;
  pct: number; // 0.029 = 2.9%
  fixedFee: number;
  minFee?: number;
  maxFee?: number;
  note: string;
}

export interface PresetPack {
  key: string;
  name: string;
  currency: string;
  rules: PresetRule[];
  contractOnly: string[];
  shopifyTxnFee?: string;
}

export const FEE_PRESETS: PresetPack[] = [
  {
    key: "za", name: "South Africa", currency: "ZAR",
    rules: [
      { gatewayMatch: "PayFast", pct: 0.032, fixedFee: 2, note: "PayFast cards 3.2% + R2 (Instant EFT 2%), payfast.io/fees" },
      { gatewayMatch: "Peach Payments", pct: 0.0295, fixedFee: 1.5, note: "Peach local cards 2.95% + R1.50, Growth plan" },
      { gatewayMatch: "Ozow", pct: 0.015, fixedFee: 0, minFee: 1, note: "Ozow pay-by-bank 1.5% (cards 2.85%)" },
      { gatewayMatch: "Stitch Express", pct: 0.0295, fixedFee: 0, note: "Stitch Express local cards 2.95%" },
      { gatewayMatch: "Bank Deposit", pct: 0, fixedFee: 0, note: "No gateway fee" },
      { gatewayMatch: "manual", pct: 0, fixedFee: 0, note: "No gateway fee" },
    ],
    contractOnly: ["Yoco online", "Float", "Payflex (if not through Peach)"],
  },
  {
    key: "us", name: "United States", currency: "USD",
    rules: [
      { gatewayMatch: "shopify_payments", pct: 0.029, fixedFee: 0.3, note: "Fallback only: Basic plan 2.9% + 30¢ (Grow 2.7%, Advanced 2.5%)" },
      { gatewayMatch: "paypal", pct: 0.0349, fixedFee: 0.49, note: "PayPal Checkout 3.49% + 49¢" },
      { gatewayMatch: "amazon_pay", pct: 0.029, fixedFee: 0.3, note: "Amazon Pay 2.9% + 30¢" },
    ],
    contractOnly: ["Klarna", "Afterpay", "Affirm", "Shop Pay Installments"],
    shopifyTxnFee: "2% Basic, 1% Grow, 0.6% Advanced, 0.2% Plus",
  },
  {
    key: "ca", name: "Canada", currency: "CAD",
    rules: [
      { gatewayMatch: "shopify_payments", pct: 0.028, fixedFee: 0.3, note: "Fallback only: Basic plan 2.8% + 30¢" },
      { gatewayMatch: "paypal", pct: 0.029, fixedFee: 0.3, note: "PayPal Canada 2.9% + C$0.30" },
    ],
    contractOnly: ["Klarna", "Afterpay", "Affirm"],
    shopifyTxnFee: "2% Basic, 1% Grow, 0.6% Advanced, 0.2% Plus",
  },
  {
    key: "uk", name: "United Kingdom", currency: "GBP",
    rules: [
      { gatewayMatch: "paypal", pct: 0.029, fixedFee: 0.3, note: "PayPal UK 2.9% + 30p" },
    ],
    contractOnly: ["Klarna", "Clearpay"],
    shopifyTxnFee: "2% Basic, 1% Grow, 0.6% Advanced (check your bill)",
  },
  {
    key: "eu", name: "Europe (EUR)", currency: "EUR",
    rules: [
      { gatewayMatch: "shopify_payments", pct: 0.02, fixedFee: 0.25, note: "Fallback only: Basic plan EEA cards 2% + €0.25" },
      { gatewayMatch: "paypal", pct: 0.0299, fixedFee: 0.39, note: "PayPal Germany 2.99% + €0.39" },
      { gatewayMatch: "mollie", pct: 0.018, fixedFee: 0.25, note: "Mollie EEA consumer cards 1.8% + €0.25 (iDEAL €0.32 flat)" },
    ],
    contractOnly: ["Klarna (direct)"],
    shopifyTxnFee: "2% Basic, 1% Grow, 0.6% Advanced, 0.2% Plus",
  },
  {
    key: "au", name: "Australia", currency: "AUD",
    rules: [
      { gatewayMatch: "paypal", pct: 0.029, fixedFee: 0.3, note: "PayPal Australia 2.9% + A$0.30" },
    ],
    contractOnly: ["Afterpay", "Zip"],
    shopifyTxnFee: "2% Basic, 1% Grow, 0.6% Advanced (check your bill)",
  },
  {
    key: "ng", name: "Nigeria", currency: "NGN",
    rules: [
      { gatewayMatch: "Paystack", pct: 0.015, fixedFee: 100, maxFee: 2000, note: "Paystack local 1.5% + ₦100, capped at ₦2,000 (₦100 waived under ₦2,500)" },
      { gatewayMatch: "Flutterwave", pct: 0.02, fixedFee: 0, note: "Flutterwave local cards 2.0%" },
    ],
    contractOnly: [],
  },
  {
    key: "ke", name: "Kenya", currency: "KES",
    rules: [
      { gatewayMatch: "Paystack", pct: 0.029, fixedFee: 0, note: "Paystack Kenya local cards 2.9% (M-PESA 1.5%)" },
      { gatewayMatch: "Flutterwave", pct: 0.032, fixedFee: 0, note: "Flutterwave Kenya local cards 3.2%" },
    ],
    contractOnly: [],
  },
  {
    key: "in", name: "India", currency: "INR",
    rules: [
      { gatewayMatch: "Razorpay", pct: 0.02, fixedFee: 0, note: "Razorpay domestic 2% (+18% GST)" },
      { gatewayMatch: "PayU", pct: 0.02, fixedFee: 0, note: "PayU domestic 2% (+GST)" },
    ],
    contractOnly: [],
  },
  {
    key: "ae", name: "UAE & Saudi Arabia", currency: "AED",
    rules: [],
    contractOnly: ["Shopify Payments (UAE)", "Tabby", "Tamara", "Checkout.com"],
  },
];
