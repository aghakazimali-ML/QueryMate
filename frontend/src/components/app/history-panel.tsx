import { useEffect, useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { HistoryEntry } from "@/lib/types";
import { downloadText } from "@/lib/utils";

/** Query history with stats and CSV export (stored per session on the API). */
export function HistoryPanel({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.history().then(setRows).catch((e) => setError(e.message));
  }, [refreshKey]);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (!rows.length) return <p className="py-10 text-center text-muted-foreground">No questions yet. Ask something in the Chat tab.</p>;

  const ok = rows.filter((r) => r.status === "✅").length;
  const avg = rows.reduce((s, r) => s + r.time_ms, 0) / rows.length / 1000;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Questions", rows.length],
          ["Succeeded", ok],
          ["Avg time", `${avg.toFixed(2)}s`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-card/70 backdrop-blur p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-black text-primary">{value}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={async () => downloadText("querymate_history.csv", await api.historyCsv())}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
        >
          <Download className="h-4 w-4" /> Export history (CSV)
        </button>
        <button
          onClick={async () => {
            await api.clearHistory();
            setRows([]);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:border-red-500 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" /> Clear
        </button>
      </div>
      <div className="overflow-auto rounded-2xl border bg-card/70 backdrop-blur">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              {["Time", "Question", "SQL", "Status", "Rows", "ms"].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t align-top">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{r.timestamp}</td>
                <td className="min-w-[14rem] px-3 py-2">{r.question}</td>
                <td className="max-w-[24rem] px-3 py-2">
                  <code className="line-clamp-3 font-mono text-xs text-muted-foreground" title={r.sql}>{r.sql}</code>
                </td>
                <td className="px-3 py-2" title={r.error}>{r.status}{r.auto_fixed && " 🔧"}</td>
                <td className="px-3 py-2 tabular-nums">{r.rows}</td>
                <td className="px-3 py-2 tabular-nums">{Math.round(r.time_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
