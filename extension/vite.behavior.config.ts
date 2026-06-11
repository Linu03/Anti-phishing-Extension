import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Standalone IIFE bundle for chrome.scripting.executeScript({ files }).
 */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/content/behaviorObserver.ts"),
      name: "AfsBehaviorObserver",
      formats: ["iife"],
      fileName: () => "behaviorObserver.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: true,
      },
    },
  },
});
