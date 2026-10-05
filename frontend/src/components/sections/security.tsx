import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";

const BLOCKED = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "ATTACH", "PRAGMA"];
const STATS = [
  { n: 500, s: "", label: "Row limit" },
  { n: 2, s: "×", label: "Auto-fix retries" },
  { n: 15, s: "s", label: "Query timeout" },
  { n: 57, s: "", label: "Automated tests" },
];

/** Security: blocked keywords get struck through on scroll; counters count up. */
export function Security() {
  return (
    <section id="security" className="relative bg-background px-6 py-32">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-12">
        <div className="label-mono md:col-span-3">(05) — Security</div>
        <div className="md:col-span-9">
          <h2 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Read-only. <span className="text-muted-foreground">Always.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Every query is parsed by <span className="text-foreground">sqlglot</span> before it touches your data: one statement,
            SELECT only, a row limit, and a read-only connection underneath. Blocked queries are never sent back for “fixing”.
          </p>
          <div className="mt-10 flex flex-wrap gap-2">
            {BLOCKED.map((kw, i) => (
              <motion.span
                key={kw}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="relative rounded-full border px-4 py-1.5 font-mono text-sm"
              >
                {kw}
                <motion.span
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.05, duration: 0.3 }}
                  className="absolute left-3 right-3 top-1/2 h-px origin-left bg-red-400"
                />
              </motion.span>
            ))}
          </div>
          <div className="mt-14 grid grid-cols-2 border-t md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="border-b py-6 pr-4 md:border-b-0 md:border-r md:last:border-r-0 md:[&:not(:first-child)]:pl-6">
                <div className="font-display text-5xl font-bold text-amber-400">
                  <AnimatedCounter to={s.n} suffix={s.s} />
                </div>
                <div className="label-mono mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
