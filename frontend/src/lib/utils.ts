import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names (shadcn / 21st.dev convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const APP_PATH = "/app";
export const GITHUB_URL = import.meta.env.VITE_GITHUB_URL ?? "https://github.com/";

/** 1234.5 -> "1,234.50", 1234 -> "1,234", strings unchanged. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
}

/** Compact axis labels: 12500 -> "12.5k". */
export function compactNumber(value: unknown): string {
  return typeof value === "number" ? Intl.NumberFormat(undefined, { notation: "compact" }).format(value) : String(value);
}

/** Rows -> CSV text (RFC 4180 quoting). */
export function toCSV(columns: string[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(esc).join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n");
}

/** Trigger a browser download of `text`. */
export function downloadText(filename: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
