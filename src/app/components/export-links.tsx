/** Download buttons for a page's data, keeping its date range. */
export function ExportLinks({ kind, query }: { kind: string; query: string }) {
  const q = query ? `&${query}` : "";
  return (
    <div className="exports" aria-label="Download">
      <a href={`/api/export/${kind}?format=xlsx${q}`} download>⬇ Excel</a>
      <a href={`/api/export/${kind}?format=csv${q}`} download>⬇ CSV</a>
    </div>
  );
}
