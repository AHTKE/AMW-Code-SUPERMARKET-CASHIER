// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  nitro: process.env.POS_PACKAGE_BUILD === "1" ? false : undefined,
  tanstackStart: {
    // Note: a static SPA shell (dist/client/index.html) is generated after
    // `vite build` by scripts/generate-static-shell.mjs so Electron and
    // Capacitor (Android/iOS) can load the app from a file:// URL without
    // needing the Nitro SSR worker.
  },
  vite: {
    // Required for Electron: file:// URLs need relative asset paths.
    base: "./",
    build: {
      chunkSizeWarningLimit: 1200,
    },
  },
});
