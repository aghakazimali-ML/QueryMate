import { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

/** Auto-growing question box; Enter sends, Shift+Enter adds a line. */
export function ChatInput({ onSend, busy, disabled }: { onSend: (q: string) => void; busy: boolean; disabled?: boolean }) {
  const [text, setText] = useState("");
  const send = () => {
    const q = text.trim();
    if (!q || busy || disabled) return;
    onSend(q);
    setText("");
  };
  return (
    <div className="glass flex items-end gap-2 rounded-2xl p-2 shadow-[0_10px_40px_-20px_var(--glow)] focus-within:border-primary">
      <textarea
        rows={1}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={disabled ? "Load a data source to start…" : "Ask a question about your data…"}
        className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none [field-sizing:content]"
        aria-label="Question"
      />
      <button
        onClick={send}
        disabled={busy || disabled || !text.trim()}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-40"
        aria-label="Send"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
      </button>
    </div>
  );
}
