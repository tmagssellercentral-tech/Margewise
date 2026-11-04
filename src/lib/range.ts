import { addDays, isYmd } from "./dates";

export const PRESETS = [
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "14d", label: "Last 14 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "mtd", label: "This month" },
  { key: "lastmonth", label: "Last month" },
];

export function resolveRange(preset: string, today: string, from?: string, to?: string) {
  if (isYmd(from ?? null) && isYmd(to ?? null) && from! <= to!) return { from: from!, to: to!, key: "custom" };
  const y = addDays(today, -1);
  switch (preset) {
    case "yesterday": return { from: y, to: y, key: preset };
    case "7d": return { from: addDays(today, -7), to: y, key: preset };
    case "30d": return { from: addDays(today, -30), to: y, key: preset };
    case "mtd": return { from: today.slice(0, 8) + "01", to: today, key: preset };
    case "lastmonth": {
      const first = today.slice(0, 8) + "01";
      const end = addDays(first, -1);
      return { from: end.slice(0, 8) + "01", to: end, key: preset };
    }
    default: return { from: addDays(today, -14), to: y, key: "14d" };
  }
}

