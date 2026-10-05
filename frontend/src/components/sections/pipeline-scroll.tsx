import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { BarChart3, Database, MessageSquare, Play, ShieldCheck, Sparkles, Wrench } from "lucide-react";

const STEPS = [
  { icon: MessageSquare, title: "Question", text: "“Monthly revenue in 2013?” in plain English, with follow-ups like “now only for USA”." },
  { icon: Database, title: "Schema context", text: "Tables, columns, foreign keys and 3 sample rows. Large schemas get a table-selection step first." },
  { icon: Sparkles, title: "LLM writes SQL", text: "Gemini or OpenAI, few-shot prompted, built from LangChain LCEL runnables." },
  { icon: ShieldCheck, title: "SQL guard", text: "sqlglot parses it: one SELECT only, no DROP / DELETE / PRAGMA, LIMIT 500 injected." },
  { icon: Play, title: "Execute", text: "Read-only connection with a hard query timeout." },
  { icon: Wrench, title: "Self-correct", text: "Database errors go back to the model for up to two automatic fixes." },
  { icon: BarChart3, title: "Chart + answer", text: "Rule-based chart, sortable table, CSV export and a 2–3 sentence summary." },
];

/** Pinned section: vertical scroll drives the pipeline cards sideways. */
export function PipelineScroll() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref });
  const x = useTransform(scrollYProgress, [0, 1], ["4%", "-70%"]);
  const line = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section ref={ref} id="process" className="relative h-[380vh] bg-background">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="mx-auto mb-12 grid w-full max-w-7xl gap-6 px-6 md:grid-cols-12">
          <div className="label-mono md:col-span-3">(04) — Process</div>
          <div className="md:col-span-9">
            <h2 className="font-display text-4xl font-semibold tracking-tight md:text-6xl">From words to warehouse, safely.</h2>
            <div className="mt-8 h-px w-full bg-border">
              <motion.div style={{ width: line }} className="h-px bg-amber-400 shadow-[0_0_12px_#f59e0b]" />
            </div>
          </div>
        </div>
        <motion.div style={{ x }} className="flex gap-5 pl-6">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="group relative flex h-[22rem] w-[18rem] shrink-0 flex-col justify-between overflow-hidden rounded-[1.75rem] border bg-card p-7 transition-colors duration-500 hover:border-amber-500/50 md:w-[24rem]"
            >
              <span className="absolute -right-4 -top-6 font-display text-[9rem] font-bold leading-none text-white/[0.04] transition-colors duration-500 group-hover:text-amber-400/10">
                {String(i + 1).padStart(2, "0")}
              </span>
              <step.icon className="h-7 w-7 text-amber-400" strokeWidth={1.5} />
              <div>
                <div className="label-mono">Step {String(i + 1).padStart(2, "0")}</div>
                <h3 className="mt-2 font-display text-3xl font-medium tracking-tight">{step.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{step.text}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
