import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production build is served by the product's FastAPI under /site/ (assets only; pages stay at /, /platform, ...).
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/site/" : "/",
  build: { outDir: "dist" },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
}));
