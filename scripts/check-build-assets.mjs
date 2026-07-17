#!/usr/bin/env node
/**
 * Fast packaging preflight: fail loudly before electron-builder / native IDEs
 * create broken installers with missing icons or a non-bootable static shell.
 */
import { existsSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";

const required = [
  "build/icon.ico",
  "build/icon.png",
  "build/icon.icns",
  "assets/icon.png",
  "assets/splash.png",
  "public/icons/favicon-16.png",
  "public/icons/favicon-32.png",
  "public/icons/apple-touch-icon.png",
  "public/icons/icon-192x192.png",
  "public/icons/icon-512x512.png",
];

const missing = required.filter((file) => !existsSync(file) || statSync(file).size === 0);

if (missing.length > 0) {
  console.error("[build-check] Missing required packaging assets:");
  for (const file of missing) console.error(`  - ${file}`);
  console.error("[build-check] Run npm run packaging:icons before building installers.");
  process.exit(1);
}

if (existsSync("dist/client/index.html")) {
  const html = await readFile("dist/client/index.html", "utf8");
  const hasSpaEntry = /<script type="module" src="\.\/spa\/spa-entry-[^"]+\.js"><\/script>/.test(html);
  const hasSpaCss = /<link rel="stylesheet" href="\.\/spa\/assets\/spa-entry-[^"]+\.css"\s*\/>/.test(html);
  const hasRelativeIcon = html.includes('./icons/favicon-32.png');
  if (!hasSpaEntry || !hasSpaCss || !hasRelativeIcon) {
    console.error("[build-check] dist/client/index.html is not the static packaged shell.");
    console.error("[build-check] Run npm run build so Electron/Capacitor boot the interactive SPA.");
    process.exit(1);
  }
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const electronRange = packageJson.devDependencies?.electron || packageJson.dependencies?.electron || "";
const electronMajorMatch = String(electronRange).match(/\d+/);
const electronMajor = electronMajorMatch ? Number(electronMajorMatch[0]) : 0;

// Electron 22 is the last line that still boots on Windows 7/8/8.1. Newer
// majors (>=23) dropped Win7/8 in Chromium 109. Keep the desktop build pinned
// to 22.x — the modern-CSS problem is solved by scripts/downlevel-css.mjs, not
// by upgrading the runtime.
if (electronMajor < 22 || electronMajor > 22) {
  console.error(`[build-check] Electron major ${electronMajor} is not supported here.`);
  console.error("[build-check] Pin electron to ^22.x so the desktop app still runs on Windows 7/8/8.1.");
  process.exit(1);
}

if (existsSync("dist/client/spa/assets")) {
  const cssFiles = (await readdir("dist/client/spa/assets")).filter((name) => name.endsWith(".css"));
  if (cssFiles.length === 0) {
    console.error("[build-check] Packaged SPA CSS file is missing.");
    console.error("[build-check] Run npm run build:package before packaging Electron.");
    process.exit(1);
  }
  const css = await readFile(`dist/client/spa/assets/${cssFiles[0]}`, "utf8");
  if (!css.includes("--supermarket") || !css.includes("--background")) {
    console.error("[build-check] Packaged CSS does not contain the app color tokens.");
    console.error("[build-check] The desktop build would launch without the correct colors.");
    process.exit(1);
  }
  // Chromium 108 cannot paint these modern color functions. If they survived
  // the downlevel step the packaged desktop app will render washed-out colors
  // on Windows 7/8/10 alike.
  const modernColor = /\b(oklab|oklch|color-mix)\s*\(/i;
  if (modernColor.test(css)) {
    console.error("[build-check] Packaged CSS still contains modern color syntax (oklab/oklch/color-mix).");
    console.error("[build-check] Run scripts/downlevel-css.mjs (invoked by npm run build:package) so Chromium 108 can render the colors.");
    process.exit(1);
  }
}

console.log("[build-check] Packaging assets and static shell look ready.");