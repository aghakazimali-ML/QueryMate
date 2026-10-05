import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, KeyRound, Link2, Table2 } from "lucide-react";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DataTable } from "./data-table";

/** Tables -> columns, types, keys and 3 sample rows. */
export function SchemaExplorer({ source }: { source: Source | null }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!source) return <p className="text-sm text-muted-foreground">No data source loaded yet.</p>;

  return (
    <div className="space-y-1.5">
      <div className="text-xs text-muted-foreground">
        {source.label} · {source.tables.length} tables
      </div>
      {source.tables.map((t) => (
        <div key={t.name} className="rounded-xl border bg-card/60">
          <button onClick={() => setOpen(open === t.name ? null : t.name)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium">
            <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", open === t.name && "rotate-90 text-primary")} />
            <Table2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{t.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{t.columns.length}</span>
          </button>
          <AnimatePresence initial={false}>
            {open === t.name && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="space-y-2 px-3 pb-3">
                  <ul className="space-y-0.5 text-xs">
                    {t.columns.map((c) => (
                      <li key={c.name} className="flex items-center gap-1.5">
                        {c.primary_key ? <KeyRound className="h-3 w-3 text-primary" /> : <span className="w-3" />}
                        <span className="font-mono">{c.name}</span>
                        <span className="ml-auto font-mono text-muted-foreground">{c.type}</span>
                      </li>
                    ))}
                  </ul>
                  {t.foreign_keys.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                      <Link2 className="h-3 w-3" />
                      {t.foreign_keys.map((fk) => fk.split(" -> ")[1]).join(", ")}
                    </div>
                  )}
                  {t.sample.length > 0 && (
                    <div className="text-[11px]">
                      <div className="mb-1 text-muted-foreground">Sample rows</div>
                      <DataTable compact columns={t.columns.map((c) => c.name)} rows={t.sample} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
