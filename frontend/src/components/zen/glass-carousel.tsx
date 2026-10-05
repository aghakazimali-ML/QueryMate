import { useCallback, useEffect, useRef, useState } from "react";
import { motion, type PanInfo } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ShaderCanvas } from "./shader-canvas";
import { MiniBars, MiniBlocked, MiniLine, MiniMetric, MiniSql } from "./mini-visuals";

const STUDIES = [
  { q: "Which 5 countries generated the most revenue?", kind: "Bar chart", body: <MiniBars />, a: "The USA leads with $523.06, ahead of Canada and France." },
  { q: "Show the monthly revenue trend for 2013", kind: "Line chart", body: <MiniLine />, a: "Revenue held near $37.62 most months, dipped in February and peaked at $49.62 in November." },
  { q: "Who is the best sales support agent?", kind: "Metric", body: <MiniMetric value="$833.04" label="Jane Peacock" />, a: "Jane Peacock's customers brought in the most revenue." },
  {
    q: "What are the top-selling genres?",
    kind: "Bar chart",
    body: <MiniBars values={[835, 386, 264, 244, 80]} labels={["ROCK", "LATIN", "METAL", "ALT", "JAZZ"]} />,
    a: "Rock dominates with 835 tracks sold, more than twice Latin.",
  },
  {
    q: "Average invoice total per country",
    kind: "SQL",
    body: <MiniSql lines={["SELECT BillingCountry AS country,", "  ROUND(AVG(Total), 2) AS avg_total", "FROM Invoice", "GROUP BY country", "ORDER BY avg_total DESC"]} />,
    a: "Chile has the highest average invoice at $6.66.",
  },
  { q: "Delete all customers", kind: "Guarded", body: <MiniBlocked />, a: "Blocked. QueryMate never changes your data." },
];

/** Liquid-glass carousel of example "query studies" over a live shader; drag, arrows or keyboard. */
export function GlassCarousel() {
  const [index, setIndex] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const go = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(STUDIES.length - 1, i + d))), []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [go]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
  };

  return (
    <section id="studies" className="noise relative overflow-hidden py-28">
      <ShaderCanvas className="absolute inset-0" fold={1.2} scale={2.4} resolution={0.4} seed={7} glow={0.3} />
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="label-mono !text-amber-200/80">(03) — Query studies</div>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white md:text-6xl">Real questions. Real answers.</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="label-mono !text-white/70">
              {String(index + 1).padStart(2, "0")} / {String(STUDIES.length).padStart(2, "0")}
            </span>
            <button onClick={() => go(-1)} disabled={index === 0} className="glass rounded-full p-3 text-white disabled:opacity-30" aria-label="Previous study">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button onClick={() => go(1)} disabled={index === STUDIES.length - 1} className="glass rounded-full p-3 text-white disabled:opacity-30" aria-label="Next study">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div ref={wrap} tabIndex={0} aria-roledescription="carousel" className="relative mt-14 outline-none">
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={onDragEnd}
          animate={{ x: `calc(50vw - ${index} * (min(78vw, 26rem) + 1.5rem) - min(78vw, 26rem) / 2)` }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
          className="flex cursor-grab gap-6 active:cursor-grabbing"
        >
          {STUDIES.map((s, i) => {
            const focused = i === index;
            return (
              <motion.article
                key={s.q}
                onClick={() => setIndex(i)}
                animate={{ scale: focused ? 1 : 0.86, opacity: focused ? 1 : 0.45, rotateY: (i - index) * -8, filter: focused ? "blur(0px)" : "blur(1.5px)" }}
                transition={{ type: "spring", stiffness: 160, damping: 20 }}
                style={{ transformPerspective: 1200 }}
                className="glass glass-chroma flex h-[26rem] w-[min(78vw,26rem)] shrink-0 select-none flex-col rounded-[1.75rem] p-6 text-white"
              >
                <div className="flex items-center justify-between">
                  <span className="label-mono !text-amber-200/90">Study {String(i + 1).padStart(2, "0")}</span>
                  <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] text-white/80">{s.kind}</span>
                </div>
                <h3 className="mt-5 font-display text-2xl font-medium leading-tight">“{s.q}”</h3>
                <div className="mt-5 min-h-0 flex-1">{focused ? s.body : <div className="h-full rounded-xl bg-white/5" />}</div>
                <p className="mt-4 text-sm text-white/75">{s.a}</p>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
