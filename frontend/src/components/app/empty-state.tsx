import { motion } from "framer-motion";
import { MessageSquareText } from "lucide-react";

/** Welcome + six example question buttons. */
export function EmptyState({ examples, onPick, isDemo }: { examples: string[]; onPick: (q: string) => void; isDemo: boolean }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center py-10 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 12 }}
        className="label-mono rounded-full border px-4 py-1.5"
      >
        (00) — Ask anything
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
        What do you want to <span className="italic text-primary">know?</span>
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-2 text-muted-foreground">
        {isDemo ? "You're connected to the Chinook music store. Try one of these:" : "Ask anything about your data in plain English."}
      </motion.p>
      {isDemo && (
        <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
          {examples.map((q, i) => (
            <motion.button
              key={q}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.06 }}
              whileHover={{ y: -3 }}
              onClick={() => onPick(q)}
              className="glass group flex items-start gap-3 rounded-2xl p-4 text-left text-sm transition-colors hover:border-primary"
            >
              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {q}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
