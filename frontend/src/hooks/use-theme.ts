import { useEffect } from "react";
import { useLocalState } from "./use-local-state";

/** Dark / light toggle (dark "hearth" by default), applied as a class on <html>. */
export function useTheme() {
  const [theme, setTheme] = useLocalState<"dark" | "light">("querymate.theme", "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return { theme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
