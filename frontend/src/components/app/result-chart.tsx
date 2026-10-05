import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import type { Chart } from "@/lib/types";
import { compactNumber, formatValue } from "@/lib/utils";

const SERIES = ["var(--primary)", "#ea580c", "#facc15", "#a16207", "#78716c"];
const axis = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false } as const;
const tooltip = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--foreground)",
  },
  itemStyle: { color: "var(--foreground)" },
  labelStyle: { color: "var(--muted-foreground)" },
  formatter: (v: unknown) => formatValue(v),
  cursor: { fill: "var(--accent)", opacity: 0.4 },
};

/** Draws the chart the backend's rule-based picker chose. */
export function ResultChart({ chart }: { chart: Chart }) {
  if (chart.kind === "metric") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border bg-gradient-to-br from-accent/60 to-transparent p-6"
      >
        <div className="text-sm text-muted-foreground">{chart.label}</div>
        <div className="mt-1 text-4xl font-black tracking-tight text-primary md:text-5xl">{formatValue(chart.value)}</div>
      </motion.div>
    );
  }
  if (chart.kind === "table" || !chart.x) return null;
  const x = chart.x;
  const name = (k: string) => chart.labels[k] ?? k;

  return (
    <div className="h-80 w-full rounded-2xl border bg-card/70 backdrop-blur p-3 pt-5">
      <ResponsiveContainer width="100%" height="100%">
        {chart.kind === "line" ? (
          <LineChart data={chart.data} margin={{ left: 4, right: 16 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey={x} {...axis} minTickGap={24} />
            <YAxis {...axis} tickFormatter={compactNumber} width={48} />
            <Tooltip {...tooltip} />
            {chart.y.map((y, i) => (
              <Line key={y} type="monotone" dataKey={y} name={name(y)} stroke={SERIES[i % SERIES.length]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} animationDuration={900} />
            ))}
          </LineChart>
        ) : chart.kind === "bar" ? (
          <BarChart data={chart.data} margin={{ left: 4, right: 16 }}>
            <defs>
              <linearGradient id="qm-bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey={x} {...axis} interval={0} angle={chart.data.length > 6 ? -30 : 0} textAnchor={chart.data.length > 6 ? "end" : "middle"} height={chart.data.length > 6 ? 70 : 30} />
            <YAxis {...axis} tickFormatter={compactNumber} width={48} />
            <Tooltip {...tooltip} />
            <Bar dataKey={chart.y[0]} name={name(chart.y[0])} radius={[8, 8, 0, 0]} animationDuration={900}>
              {chart.data.map((_, i) => (
                <Cell key={i} fill="url(#qm-bar)" />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <ScatterChart margin={{ left: 4, right: 16 }}>
            <CartesianGrid stroke="var(--border)" />
            <XAxis type="number" dataKey={x} name={name(x)} {...axis} tickFormatter={compactNumber} />
            <YAxis type="number" dataKey={chart.y[0]} name={name(chart.y[0])} {...axis} tickFormatter={compactNumber} width={48} />
            <Tooltip {...tooltip} />
            <Scatter data={chart.data} fill="var(--primary)" animationDuration={900} />
          </ScatterChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
