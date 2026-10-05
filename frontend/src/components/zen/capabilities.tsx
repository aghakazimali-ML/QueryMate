import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { MiniBars, MiniBlocked, MiniFix, MiniLine, MiniSql, MiniUpload } from "./mini-visuals";

const ITEMS: { title: string; tag: string; text: string; preview: ReactNode }[] = [
  {
    title: "Conversational SQL",
    tag: "LLM · LCEL",
    text: "Gemini or OpenAI writes the query; follow-ups like “now only for USA” reuse the last three turns.",
    preview: <MiniSql lines={["SELECT BillingCountry AS country,", "  ROUND(SUM(Total), 2) AS revenue", "FROM Invoice", "GROUP BY country", "ORDER BY revenue DESC LIMIT 5"]} />,
  },
  { title: "Charts that pick themselves", tag: "Rule-based", text: "Dates become lines, categories become sorted bars, single values become big numbers.", preview: <MiniBars /> },
  { title: "Bring your own files", tag: "CSV · Excel", text: "Every file and sheet becomes a clean snake_case table you can query instantly.", preview: <MiniUpload /> },
  { title: "Read-only by design", tag: "sqlglot", text: "One SELECT only, write keywords blocked, LIMIT injected, read-only connection underneath.", preview: <MiniBlocked /> },
  { title: "Self-correcting", tag: "Retry loop", text: "When the database rejects a query, the error goes back to the model for up to two fixes.", preview: <MiniFix /> },
  { title: "Trends & history", tag: "Export", text: "Every question, query, status and timing is logged and exportable as CSV.", preview: <MiniLine /> },
];

/** Agency-style numbered list; hovering a row floats a live preview that follows the cursor. */
export function Capabilities() {
  const [active, setActive] = useState<number | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 24 });
  const sy = useSpring(y, { stiffness: 220, damping: 24 });

  return (
    <section
      id="capabilities"
      className="relative z-10 -mt-[40svh] rounded-t-[2.5rem] bg-background px-6 pb-32 pt-24"
      onPointerMove={(e) => {
        x.set(e.clientX + 24);
        y.set(e.clientY - 110);
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 md:grid-cols-12">
          <div className="label-mono md:col-span-3">(02) — Capabilities</div>
          <h2 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight md:col-span-9 md:text-6xl">
            Everything an analyst does, <span className="text-muted-foreground">in the time it takes to ask.</span>
          </h2>
        </div>

        <ul className="mt-16 border-t">
          {ITEMS.map((item, i) => (
            <motion.li
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ delay: i * 0.05, duration: 0.6 }}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              className="group relative grid cursor-default grid-cols-12 items-center gap-4 border-b py-7 md:py-9"
            >
              <span className="absolute inset-0 origin-bottom scale-y-0 bg-gradient-to-r from-amber-500/10 to-transparent transition-transform duration-500 group-hover:scale-y-100" />
              <span className="label-mono relative col-span-2 md:col-span-1">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="relative col-span-10 font-display text-2xl font-medium tracking-tight transition-transform duration-500 group-hover:translate-x-3 md:col-span-5 md:text-4xl">
                {item.title}
              </h3>
              <p className="relative col-span-12 text-sm text-muted-foreground md:col-span-4">{item.text}</p>
              <span className="relative col-span-12 flex items-center justify-between md:col-span-2 md:justify-end md:gap-3">
                <span className="label-mono">{item.tag}</span>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-all group-hover:rotate-45 group-hover:text-amber-400" />
              </span>
              <div className="relative col-span-12 h-36 md:hidden">{item.preview}</div>
            </motion.li>
          ))}
        </ul>
      </div>

      <AnimatePresence>
        {active !== null && (
          <motion.div
            key="preview"
            style={{ left: sx, top: sy }}
            initial={{ opacity: 0, scale: 0.6, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="glass glass-chroma pointer-events-none fixed z-50 hidden h-56 w-80 bg-[#140d08]/90 overflow-hidden rounded-2xl p-4 md:block"
          >
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
                {ITEMS[active].preview}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
