import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

/** Sticky paragraph whose words light up one by one as you scroll (21st.dev "Text Reveal"). */
export function TextReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref });
  const words = text.split(" ");

  return (
    <div ref={ref} className={cn("relative z-0 h-[220vh]", className)}>
      <div className="sticky top-0 mx-auto flex h-screen max-w-5xl items-center px-6">
        <p className="flex flex-wrap font-display text-3xl font-semibold leading-tight tracking-tight md:text-5xl lg:text-6xl">
          {words.map((word, i) => {
            const start = i / words.length;
            const end = start + 1 / words.length;
            return (
              <Word key={i} progress={scrollYProgress} range={[start, end]}>
                {word}
              </Word>
            );
          })}
        </p>
      </div>
    </div>
  );
}

function Word({ children, progress, range }: { children: ReactNode; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0, 1]);
  const y = useTransform(progress, range, [12, 0]);
  return (
    <span className="relative mx-1 lg:mx-2.5">
      <span className="absolute opacity-15">{children}</span>
      <motion.span style={{ opacity, y }} className="text-amber-300">
        {children}
      </motion.span>
    </span>
  );
}
