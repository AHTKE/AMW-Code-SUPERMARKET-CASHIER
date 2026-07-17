#!/usr/bin/env node
/**
 * Copies the Nitro/Vite build output from `.output/public` (Cloudflare Worker
 * static asset dir) into `dist/client` so Electron and Capacitor packagers
 * can find a stable path. Safe to run repeatedly and cross-platform (uses
 * Node's fs APIs — no `cp` / `xcopy`).
 *
 * If `dist/client` already contains assets (e.g. because vite already emitted
 * there directly on some future config), this is a no-op.
 */
import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const candidates = [".output/public", "dist/client", "dist"];
let source = null;

for (const c of candidates) {
  if (!existsSync(c)) continue;
  const entries = await readdir(c).catch(() => []);
  const hasAssets = entries.includes("assets");
  if (hasAssets) {
    source = c;
    break;
  }
}

if (!source) {
  console.error("[copy-output] no build output found. Run `vite build` first.");
  process.exit(1);
}

const target = "dist/client";

if (source === target) {
  console.log(`[copy-output] source == target (${target}); nothing to copy.`);
  process.exit(0);
}

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });

const sz = (await readdir(join(target, "assets")).catch(() => [])).length;
console.log(`[copy-output] copied ${source} → ${target} (${sz} asset files)`);
