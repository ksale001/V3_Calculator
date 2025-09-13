import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  // Use relative paths so it works on GitHub Pages subpaths
  base: "./",
  plugins: [react()],
});

