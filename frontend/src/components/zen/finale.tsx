import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { ShaderCanvas } from "./shader-canvas";
import { APP_PATH, GITHUB_URL } from "@/lib/utils";

/** Closing CTA: the shader returns behind a card that opens up as you scroll in, then the footer. */
export function Finale() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const inset = useTransform(scrollYProgress, [0, 0.8], ["12%", "0%"]);
  const radius = useTransform(scrollYProgress, [0, 0.8], ["3rem", "0rem"]);
  const clip = useTransform([inset, radius] as never, ([i, r]: string[]) => `inset(${i} ${i} 0 ${i} round ${r})`);

  return (
    <section ref={ref} className="relative">
      <motion.div style={{ clipPath: clip }} className="noise relative flex min-h-[100svh] flex-col justify-between overflow-hidden">
        <ShaderCanvas className="absolute inset-0" fold={2.6} scale={1.3} resolution={0.5} seed={13} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/50" />
        <div className="relative mx-auto w-full max-w-7xl px-6 pt-40">
          <div className="label-mono !text-amber-200/80">(06) — Start</div>
        </div>
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-16">
          <h2 className="font-display text-[14vw] font-bold leading-[0.85] tracking-[-0.05em] text-[#fff4e2] mix-blend-overlay md:text-[10vw]">
            Stop writing
            <br />
            SQL. Ask.
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-white/20 pt-8">
            <p className="max-w-md text-white/75">Open the app, pick the Chinook demo or drop in your own CSV, and ask your first question.</p>
            <Link to={APP_PATH} className="group inline-flex items-center gap-3 rounded-full bg-amber-400 px-7 py-4 text-base font-semibold text-black">
              Launch QueryMate
              <ArrowUpRight className="h-5 w-5 transition-transform group-hover:rotate-45" />
            </Link>
          </div>
        </div>
      </motion.div>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} Agha Kazim Ali — Python Data Analyst & AI Developer</span>
        <span className="flex gap-6">
          <a href="https://www.upwork.com/" className="hover:text-amber-400">Upwork</a>
          <a href="https://www.linkedin.com/" className="hover:text-amber-400">LinkedIn</a>
          <a href={GITHUB_URL} className="hover:text-amber-400">GitHub</a>
        </span>
      </footer>
    </section>
  );
}
