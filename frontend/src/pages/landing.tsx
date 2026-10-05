import { useEffect } from "react";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { TextReveal } from "@/components/ui/text-reveal";
import { Marquee } from "@/components/ui/marquee";
import { ZenHeader } from "@/components/zen/header";
import { ZenHero } from "@/components/zen/hero";
import { Capabilities } from "@/components/zen/capabilities";
import { GlassCarousel } from "@/components/zen/glass-carousel";
import { Finale } from "@/components/zen/finale";
import { PipelineScroll } from "@/components/sections/pipeline-scroll";
import { Security } from "@/components/sections/security";

const STACK = ["Python 3.11", "FastAPI", "LangChain LCEL", "Gemini", "OpenAI", "SQLAlchemy 2", "sqlglot", "pandas", "React 19", "WebGL", "Framer Motion", "Tailwind 4", "pytest", "Docker"];

/** Marketing page (Zen-style: shader hero, layered sections, glass carousel). Always dark. */
export default function Landing() {
  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!had) root.classList.remove("dark");
    };
  }, []);

  return (
    <main className="relative bg-background text-foreground">
      <ScrollProgress />
      <ZenHeader />
      <ZenHero />
      <Capabilities />
      <TextReveal text="Your data already knows the answer. QueryMate asks it the right question, in SQL you never have to write." />
      <GlassCarousel />
      <div className="border-y bg-background py-6">
        <Marquee duration="50s">
          {STACK.map((s) => (
            <span key={s} className="flex items-center gap-4 whitespace-nowrap font-display text-2xl font-medium text-muted-foreground">
              {s} <span className="text-amber-400">✦</span>
            </span>
          ))}
        </Marquee>
      </div>
      <PipelineScroll />
      <Security />
      <Finale />
    </main>
  );
}
