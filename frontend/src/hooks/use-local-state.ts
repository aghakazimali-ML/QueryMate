import { useEffect, useState } from "react";

/** useState persisted to localStorage (or sessionStorage), failing soft when storage is blocked. */
export function useLocalState<T>(key: string, initial: T, storage: "local" | "session" = "local") {
  const store = () => (storage === "local" ? window.localStorage : window.sessionStorage);
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = store().getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      store().setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: keep in memory */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);
  return [value, setValue] as const;
}
