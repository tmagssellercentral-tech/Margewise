import { PUBLIC_PLANS } from "@/lib/plans";
import type { PlanCard } from "./plans";

const FOR: Record<string, string> = {
  free: "For new stores finding their first profitable product",
  starter: "For stores starting to spend on ads",
  growth: "For brands scaling ads and repeat customers",
  scale: "For high-volume stores and multi-channel brands",
};

const FEATURES: Record<string, string[]> = {
  free: [
    "Net profit after every cost",
    "Profit & loss by month",
    "Product profit by SKU",
    "Meta, Google, TikTok, Pinterest and Snapchat ads connected",
    "MER, ROAS, break-even ROAS, POAS",
    "Payment fees, shipping, returns, tax",
    "Excel and CSV exports",
  ],
  starter: ["Customer acquisition cost (CAC)", "New vs returning customers"],
  growth: ["Every campaign against break-even", "Repeat purchase rate", "Customer lifetime value", "LTV:CAC ratio"],
  scale: ["More than three times Growth's order volume", "Over 5,000 orders? Ask about Plus"],
};

const INHERIT: Record<string, string | undefined> = { starter: "Everything in Free, plus", growth: "Everything in Starter, plus", scale: "Everything in Growth, plus" };

export const PLAN_CARDS: PlanCard[] = PUBLIC_PLANS.map((p) => ({
  key: p.key,
  name: p.name,
  forWho: FOR[p.key],
  monthly: p.monthly ?? 0,
  annual: p.annual,
  orders: `Up to ${p.orderLimit!.toLocaleString("en-US")} orders a month`,
  features: FEATURES[p.key],
  inherit: INHERIT[p.key],
  pick: p.key === "growth",
}));
