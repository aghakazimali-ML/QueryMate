import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, ChevronDown, Download, KeyRound, Lightbulb, Loader2, SearchX, ShieldAlert, Timer, Wrench } from "lucide-react";
import type { QueryResult } from "@/lib/types";
import { cn, downloadText, toCSV } from "@/lib/utils";
import { DataTable } from "./data-table";
import { ResultChart } from "./result-chart";
import { SqlBlock } from "./sql-block";

const ERROR_STYLE = {
  blocked: { icon: ShieldAlert, title: "Blocked for safety", hint: "QueryMate is read-only, so it never changes your data." },
  auth: { icon: KeyRound, title: "API key problem", hint: "Check the key in Settings." },
  timeout: { icon: Timer, title: "Query took too long", hint: "Try a narrower question." },
  sql: { icon: AlertTriangle, title: "Couldn't build a working query", hint: "Try rephrasing, or name the table you mean." },
  llm: { icon: AlertTriangle, title: "The AI model didn't respond", hint: "Try again in a moment." },
} as const;

/** Summary -> chart -> table -> SQL -> actions. */
export function ResultCard({
  result,
  explanation,
  onExplain,
}: {
  result: QueryResult;
  explanation?: string;
  onExplain: () => Promise<void>;
}) {
  const [showSql, setShowSql] = useState(false);
  const [explaining, setExplaining] = useState(false);

  if (result.error_kind) {
    const style = ERROR_STYLE[result.error_kind];
    return (
      <div className={cn("rounded-2xl border p-4", result.error_kind === "blocked" ? "border-red-500/40 bg-red-500/10" : "border-amber-500/40 bg-amber-500/10")}>
        <div className="flex items-center gap-2 font-semibold">
          <style.icon className="h-5 w-5" /> {style.title}
        </div>
        <p className="mt-1 text-sm">{result.error}</p>
        <p className="mt-1 text-xs text-muted-foreground">{style.hint}</p>
        {result.sql && (
          <div className="mt-3">
            <SqlBlock sql={result.sql} />
          </div>
        )}
      </div>
    );
  }

  const empty = result.row_count === 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">🧠 AI answer</span>
        {result.auto_fixed && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
            <Wrench className="h-3 w-3" /> Auto-fixed query
          </span>
        )}
      </div>

      {empty ? (
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-4 text-sm">
          <SearchX className="h-5 w-5 text-primary" /> {result.summary}
        </div>
      ) : (
        <>
          <div className="leading-relaxed [&_strong]:text-primary"><ReactMarkdown>{result.summary}</ReactMarkdown></div>
          <ResultChart chart={result.chart} />
          <DataTable columns={result.columns} rows={result.rows} />
        </>
      )}

      <div className="text-xs text-muted-foreground">
        ⏱️ {(result.elapsed_ms / 1000).toFixed(2)}s · {result.row_count.toLocaleString()} rows
        {result.limit_added && " · LIMIT added automatically"}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowSql(!showSql)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:border-primary">
          🔍 View SQL <ChevronDown className={cn("h-4 w-4 transition-transform", showSql && "rotate-180")} />
        </button>
        <button
          disabled={empty}
          onClick={() => downloadText("querymate_result.csv", toCSV(result.columns, result.rows))}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:border-primary disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Download CSV
        </button>
        <button
          disabled={!!explanation || explaining}
          onClick={async () => {
            setExplaining(true);
            setShowSql(true);
            await onExplain();
            setExplaining(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:border-primary disabled:opacity-50"
        >
          {explaining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />} Explain this SQL
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showSql && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-3 overflow-hidden">
            <SqlBlock sql={result.sql} />
            {explanation && (
              <div className="prose-sm rounded-xl border bg-card p-4 text-sm leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_p]:my-1.5 [&_code]:font-mono [&_code]:text-primary">
                <ReactMarkdown>{explanation}</ReactMarkdown>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
