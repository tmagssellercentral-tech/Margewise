import { buildSheet, toCsv, toXlsx } from "@/lib/exports";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KINDS = new Set(["overview", "products", "orders", "pnl"]);

/** Downloads behind the dashboard password: /api/export/<kind>?format=csv|xlsx plus the page's range. */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.has(kind)) return new Response("Unknown export", { status: 404 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const sheet = await buildSheet(kind, sp);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `margewise-${kind}-${stamp}`;
  if (sp.format === "xlsx") {
    const buf = await toXlsx(sheet);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(toCsv(sheet), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"`, "Cache-Control": "no-store" },
  });
}
