import { motion } from "framer-motion";

/** Tiny illustrative visuals used in hover previews and carousel cards (static demo data from Chinook). */

export function MiniBars({ values = [523, 304, 195, 190, 156], labels = ["USA", "CAN", "FRA", "BRA", "GER"] }: { values?: number[]; labels?: string[] }) {
  const max = Math.max(...values);
  return (
    <div className="flex h-full items-end gap-2">
      {values.map((v, i) => (
        <div key={i} className="flex h-full flex-1 flex-col justify-end gap-1">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(v / max) * 100}%` }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 90, damping: 14 }}
            className="rounded-t-md bg-gradient-to-t from-amber-700 to-amber-300"
          />
          <span className="text-center font-mono text-[9px] text-muted-foreground">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniLine({ values = [37.62, 27.72, 37.62, 33.66, 37.62, 37.62, 37.62, 37.62, 37.62, 37.62, 49.62, 38.62] }: { values?: number[] }) {
  const max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${90 - ((v - min) / (max - min || 1)) * 70}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="mini-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f59e0b" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${pts} 100,100`} fill="url(#mini-fill)" />
      <motion.polyline
        points={pts}
        fill="none"
        stroke="#fbbf24"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </svg>
  );
}

export function MiniSql({ lines }: { lines: string[] }) {
  return (
    <pre className="h-full overflow-hidden rounded-lg bg-black/40 p-3 font-mono text-[11px] leading-5 text-amber-100">
      {lines.map((l, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
          {l.split(/(\b(?:SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|JOIN|ON|AS|AND|DESC|WITH|SUM|ROUND|COUNT)\b)/).map((part, j) =>
            j % 2 ? <span key={j} className="font-semibold text-amber-400">{part}</span> : part,
          )}
        </motion.div>
      ))}
    </pre>
  );
}

export function MiniMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <div className="label-mono">{label}</div>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-5xl font-bold text-amber-300">
        {value}
      </motion.div>
    </div>
  );
}

export function MiniBlocked() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 font-mono text-xs">
      <div className="rounded-md bg-black/40 p-2 text-amber-100">
        <span className="text-red-400 line-through decoration-2">DELETE FROM Customer</span>
      </div>
      <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-red-200">🛡️ Blocked: read-only queries only</div>
    </div>
  );
}

export function MiniUpload() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 font-mono text-[11px]">
      <div className="rounded-md bg-black/40 p-2 text-muted-foreground">Sales Report 2024.xlsx → 3 sheets</div>
      {["sales_north", "sales_south", "sales_west"].map((t, i) => (
        <motion.div key={t} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">
          ▦ {t} <span className="text-muted-foreground">(order_id, total_amount, order_date)</span>
        </motion.div>
      ))}
    </div>
  );
}

export function MiniFix() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 font-mono text-[11px]">
      <div className="rounded-md bg-black/40 p-2 text-red-300">✗ no such column: Inv.Totl</div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="rounded-md bg-black/40 p-2 text-emerald-300">
        ✓ SUM(i.Total) · 🔧 auto-fixed
      </motion.div>
    </div>
  );
}
