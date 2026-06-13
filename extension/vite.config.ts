import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        background: resolve(__dirname, "src/background/main.ts"),
        phishingOverlay: resolve(__dirname, "src/content/phishingOverlay.ts"),
        scanResultToast: resolve(__dirname, "src/content/scanResultToast.ts"),
      },
      output: {
        entryFileNames(chunkInfo) {
          if (chunkInfo.name === "background") {
            return "background.js";
          }
          if (chunkInfo.name === "phishingOverlay") {
            return "phishingOverlay.js";
          }
          if (chunkInfo.name === "scanResultToast") {
            return "scanResultToast.js";
          }
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
