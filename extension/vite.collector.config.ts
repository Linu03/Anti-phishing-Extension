import { defineConfig } from "vite";
import { resolve } from "path";

/**
 * Standalone IIFE bundle for chrome.scripting.executeScript({ files }).
 * Content scripts injected this way cannot use ES module import syntax.
 */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/content/pageCollector.ts"),
      name: "AfsPageCollector",
      formats: ["iife"],
      fileName: () => "pageCollector.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: true,
      },
    },
  },
});
