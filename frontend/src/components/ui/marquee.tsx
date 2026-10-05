import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Infinite horizontal marquee (21st.dev / Magic UI pattern). Pauses on hover. */
export function Marquee({
  children,
  reverse = false,
  duration = "40s",
  className,
}: {
  children: ReactNode;
  reverse?: boolean;
  duration?: string;
  className?: string;
}) {
  return (
    <div
      style={{ ["--duration" as string]: duration, ["--gap" as string]: "1rem" }}
      className={cn("group flex overflow-hidden [gap:var(--gap)] [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]", className)}
    >
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className={cn(
            "flex shrink-0 animate-marquee justify-around [gap:var(--gap)] group-hover:[animation-play-state:paused]",
            reverse && "[animation-direction:reverse]",
          )}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
