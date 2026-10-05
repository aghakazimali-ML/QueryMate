import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { APP_PATH } from "@/lib/utils";

const LINKS = [
  ["Capabilities", "#capabilities"],
  ["Studies", "#studies"],
  ["Process", "#process"],
  ["Security", "#security"],
] as const;

/** Blurred, minimal agency header that condenses after the hero. */
export function ZenHeader() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 80));

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.8 }}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4"
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-5 py-3 transition-all duration-500 ${
          solid ? "glass" : "bg-transparent"
        }`}
      >
        <a href="#" className="font-display text-lg font-bold tracking-tight text-white">
          QueryMate<sup className="ml-0.5 text-[10px] text-amber-400">©</sup>
        </a>
        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} className="label-mono !text-white/70 transition-colors hover:!text-amber-300">
              {label}
            </a>
          ))}
        </nav>
        <Link
          to={APP_PATH}
          className="group relative overflow-hidden rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-black"
        >
          <span className="relative z-10">Launch app</span>
          <span className="absolute inset-0 -translate-x-full bg-white transition-transform duration-500 group-hover:translate-x-0" />
        </Link>
      </div>
    </motion.header>
  );
}
