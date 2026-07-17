#!/usr/bin/env node
/**
 * Builds src/spa-entry.tsx as a standalone client bundle for Electron and
 * Capacitor. Bypasses TanStack Start's SSR-hydration client entry (which
 * throws "Invariant failed" when there is no server-injected router state).
 *
 * Output: dist/client/spa/spa-entry-[hash].js (+ CSS)
 */
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readdir, writeFile, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

const outDir = "dist/client/spa";
if (existsSync(outDir)) await rm(outDir, { recursive: true, force: true });

await build({
  configFile: false,
  root: process.cwd(),
  base: "./",
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: { "@": join(process.cwd(), "src") },
  },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir,
    emptyOutDir: true,
    // Electron 22 ships Chromium 108 (the last release that still runs on
    // Windows 7/8/8.1). We target that engine and rely on scripts/downlevel-css.mjs
    // to translate Tailwind v4's modern color syntax (oklab/oklch/color-mix)
    // into sRGB fallbacks Chromium 108 renders identically.
    target: "chrome108",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: "src/spa-entry.tsx",
      output: {
        entryFileNames: "spa-entry-[hash].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});

// Find the emitted entry + css to write a manifest the shell generator reads.
async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = join(dir, name);
    const st = await stat(full);
    if (st.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}
const allFiles = (await walk(outDir)).map((p) => relative(outDir, p).replace(/\\/g, "/"));
const entryJs = allFiles.find((f) => /^spa-entry-[^/]*\.js$/.test(f));
const cssFile = allFiles.find((f) => /\.css$/.test(f));
await writeFile(
  join(outDir, "manifest.json"),
  JSON.stringify({ entry: entryJs, css: cssFile }, null, 2),
);
console.log(`[spa-entry] built ${entryJs}${cssFile ? " + " + cssFile : ""}`);
