import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: { chunkSizeWarningLimit: 700 },
  server: {
    // Local dev: forward API calls to `uvicorn api.main:app --reload` on port 8000.
    proxy: { "/api": "http://localhost:8000" },
  },
});
