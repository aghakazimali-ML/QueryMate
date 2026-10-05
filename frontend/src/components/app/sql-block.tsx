import { useState } from "react";
import { Check, Copy } from "lucide-react";

const KEYWORDS =
  /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|AS|AND|OR|NOT|IN|IS|NULL|LIKE|BETWEEN|CASE|WHEN|THEN|ELSE|END|WITH|UNION|ALL|DISTINCT|DESC|ASC|BY|OVER|PARTITION|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|PRAGMA|ATTACH)\b/gi;
const FUNCS = /\b(COUNT|SUM|AVG|MIN|MAX|ROUND|STRFTIME|COALESCE|CAST|SUBSTR|LOWER|UPPER|DATE|EXTRACT|DATE_TRUNC)\b(?=\s*\()/gi;

function highlight(sql: string): string {
  const escaped = sql.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Strings first, then keywords/functions/numbers outside of the string spans we produced.
  return escaped
    .split(/('(?:[^']|'')*')/g)
    .map((part, i) =>
      i % 2
        ? `<span class="text-emerald-400">${part}</span>`
        : part
            .replace(FUNCS, '<span class="text-sky-300">$1</span>')
            .replace(KEYWORDS, (m) => `<span class="font-semibold text-amber-400">${m.toUpperCase()}</span>`)
            .replace(/(?<![\w#">-])(\d+(?:\.\d+)?)\b/g, '<span class="text-orange-300">$1</span>'),
    )
    .join("");
}

/** Syntax-highlighted, copyable SQL. */
export function SqlBlock({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => {
          navigator.clipboard?.writeText(sql);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded-md p-1.5 text-amber-200/70 hover:bg-white/10 hover:text-amber-100"
        aria-label="Copy SQL"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <pre className="overflow-x-auto rounded-xl bg-[#1b120b] p-4 pr-12 font-mono text-[13px] leading-6 text-amber-50">
        <code dangerouslySetInnerHTML={{ __html: highlight(sql) }} />
      </pre>
    </div>
  );
}
