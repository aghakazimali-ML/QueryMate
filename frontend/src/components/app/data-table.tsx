import { useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import type { Row } from "@/lib/types";
import { cn, formatValue } from "@/lib/utils";

const PAGE = 10;

/** Sortable, paginated result table. */
export function DataTable({ columns, rows, compact = false }: { columns: string[]; rows: Row[]; compact?: boolean }) {
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.col] as never;
      const y = b[sort.col] as never;
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x > y ? 1 : -1) * sort.dir;
    });
  }, [rows, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const visible = compact ? sorted : sorted.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card/70 backdrop-blur">
      <div className="max-h-[26rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-secondary/95 backdrop-blur">
            <tr>
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">
                  <button
                    className="inline-flex items-center gap-1 hover:text-primary"
                    onClick={() => setSort((s) => ({ col: c, dir: s?.col === c ? ((-s.dir) as 1 | -1) : -1 }))}
                  >
                    {c}
                    <ArrowDownUp className={cn("h-3 w-3 opacity-40", sort?.col === c && "text-primary opacity-100")} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i} className="border-t transition-colors hover:bg-accent/40">
                {columns.map((c) => (
                  <td key={c} className={cn("whitespace-nowrap px-3 py-1.5", typeof row[c] === "number" && "text-right tabular-nums")}>
                    {formatValue(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && pages > 1 && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>
            Rows {page * PAGE + 1}–{Math.min(sorted.length, (page + 1) * PAGE)} of {sorted.length}
          </span>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-md border px-2 py-0.5 disabled:opacity-40">
              Prev
            </button>
            <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-md border px-2 py-0.5 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
