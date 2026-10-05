import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { ShaderCanvas } from "./shader-canvas";
import { APP_PATH, GITHUB_URL } from "@/lib/utils";

const WORD = "QUERYMATE".split("");

/** Full-bleed metal shader hero with giant blended wordmark; the next section slides over it. */
export function ZenHero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const wordY = useTransform(scrollYProgress, [0, 1], ["0%", "-60%"]);
  const wordScale = useTransform(scrollYProgress, [0, 1], [1, 1.25]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const darken = useTransform(scrollYProgress, [0, 1], [0, 0.75]);

  return (
    <section ref={ref} className="relative h-[140svh]">
      <div className="noise sticky top-0 h-[100svh] overflow-hidden">
        <ShaderCanvas className="absolute inset-0" fold={2.1} resolution={0.55} />
        <motion.div style={{ opacity: darken }} className="absolute inset-0 bg-black" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

        <motion.div style={{ y: copyY, opacity: fade }} className="relative z-10 mx-auto grid h-full max-w-7xl grid-rows-[1fr_auto] px-6 pb-[24vw] pt-28 md:pb-[17vw]">
          <div className="grid content-start gap-10 md:grid-cols-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.9 }}
              className="md:col-span-5"
            >
              <div className="label-mono !text-amber-200/80">(01) — Text-to-SQL · AI data analyst</div>
              <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-tight text-white md:text-6xl">
                Ask your database
                <br />
                <span className="italic text-amber-300">anything.</span>
              </h1>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.9 }}
              className="md:col-span-4 md:col-start-9 md:pt-10"
            >
              <p className="text-base leading-relaxed text-white/75">
                Plain English in. Safe, read-only SQL, a chart, a table and a clear answer out. Built on LangChain, sqlglot and
                FastAPI.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to={APP_PATH} className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
                  Try it live <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
                <a href={GITHUB_URL} className="glass inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white">
                  Source
                </a>
              </div>
            </motion.div>
          </div>
          <div className="flex items-end justify-between">
            <span className="label-mono !text-white/60">Scroll to explore</span>
            <motion.span animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}>
              <ArrowDownRight className="h-5 w-5 text-white/60" />
            </motion.span>
          </div>
        </motion.div>

        {/* Giant wordmark: overlay-blended so the molten metal lights up inside the letters. */}
        <motion.h2
          aria-label="QueryMate"
          style={{ y: wordY, scale: wordScale }}
          className="pointer-events-none absolute inset-x-0 bottom-[-2vw] z-20 flex origin-bottom justify-center whitespace-nowrap font-display text-[16.5vw] font-bold leading-none tracking-[-0.06em] text-[#fff4e2] mix-blend-overlay"
        >
          {WORD.map((ch, i) => (
            <motion.span
              key={i}
              initial={{ y: "110%" }}
              animate={{ y: "0%" }}
              transition={{ delay: 0.15 + i * 0.05, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="inline-block"
            >
              {ch}
            </motion.span>
          ))}
        </motion.h2>
      </div>
    </section>
  );
}
