#!/usr/bin/env node
/**
 * Generates dist/client/index.html — a static SPA shell so Electron (app://)
 * and Capacitor (Android/iOS WebView) can boot without the Nitro SSR worker.
 * Points to the standalone SPA bundle built by scripts/build-spa-entry.mjs.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const clientDir = "dist/client";
const spaDir = join(clientDir, "spa");
const manifestPath = join(spaDir, "manifest.json");

if (!existsSync(manifestPath)) {
  console.error(`[shell] ${manifestPath} not found — run build-spa-entry.mjs first`);
  process.exit(1);
}

const { entry, css } = JSON.parse(await readFile(manifestPath, "utf8"));
if (!entry) {
  console.error("[shell] SPA entry missing from manifest");
  process.exit(1);
}

const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#F97316" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Supermarket" />
    <meta name="format-detection" content="telephone=no" />
    <title>Supermarket Cashier</title>
    <meta name="description" content="نظام نقاط البيع المتكامل للسوبرماركت والكافيهات" />
    <link rel="icon" href="./icons/favicon-32.png" type="image/png" sizes="32x32" />
    <link rel="icon" href="./icons/favicon-16.png" type="image/png" sizes="16x16" />
    <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" sizes="180x180" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Tajawal:wght@400;500;700&display=swap" />
${css ? `    <link rel="stylesheet" href="./spa/${css}" />\n` : ""}    <style>
      html { margin: 0; padding: 0; min-height: 100vh; background: #2b3438; color: #ffffff; }
      body { margin: 0; padding: 0; min-height: 100vh; font-family: 'Cairo', 'Tajawal', system-ui, sans-serif; }
      #__boot { display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #F97316; font-weight: 700; }
    </style>
  </head>
  <body>
    <div id="root"><div id="__boot">جاري تحميل النظام...</div></div>
    <script type="module" src="./spa/${entry}"></script>
  </body>
</html>
`;

await mkdir(clientDir, { recursive: true });
await writeFile(join(clientDir, "index.html"), html, "utf8");
console.log(`[shell] wrote ${clientDir}/index.html (entry: ./spa/${entry})`);
