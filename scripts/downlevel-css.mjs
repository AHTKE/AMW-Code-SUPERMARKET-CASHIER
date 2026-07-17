#!/usr/bin/env node
/**
 * Downlevel packaged SPA CSS so it renders identically inside Chromium 108
 * (Electron 22 — the last Electron line that still boots on Windows 7/8/8.1).
 *
 * Tailwind v4 emits Tailwind's opacity/mix utilities as `color-mix(in oklab, ...)`,
 * a syntax that only landed in Chromium 111. Chromium 108 silently drops those
 * declarations, which is what produced the washed-out / missing colors in the
 * packaged desktop app.
 *
 * We convert the exact patterns Tailwind emits into equivalent legacy syntax:
 *
 *   color-mix(in oklab, hsl(var(--X))       P%, transparent) → hsl(var(--X) / P%)
 *   color-mix(in oklab, hsl(H S% L% ...)    P%, transparent) → hsl(H S% L% / P%)
 *   color-mix(in oklab, var(--X)            P%, transparent) → var(--X)           (opacity dropped — no legacy syntax can inject alpha into a resolved var color; the base color still paints)
 *   color-mix(in oklab, currentcolor        P%, transparent) → currentcolor       (same reason)
 *   color-mix(in oklab, <A>                 P%, <B>)          → <A>               (two-color blends can't be resolved statically; keep the dominant color)
 *
 * `hsl(<h> <s> <l> / <a>)` is CSS Color Level 4 space-separated syntax that
 * Chromium 65+ understands, so no visible difference on our theme tokens.
 * All non-Tailwind, non-color-mix rules are left untouched.
 *
 * Runs after scripts/build-spa-entry.mjs.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const assetsDir = "dist/client/spa/assets";
if (!existsSync(assetsDir)) {
  console.log("[downlevel-css] dist/client/spa/assets not found — skipping.");
  process.exit(0);
}

/** Find matching `)` for the `(` at openIndex. Returns index of the `)`. */
function findMatchingParen(src, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split top-level comma-separated args inside a css function body. */
function splitArgs(body) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      out.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(body.slice(start).trim());
  return out;
}

/** Split a "<color> <percentage>" arg into { color, pct }. */
function splitColorAndPct(arg) {
  // Percentage always sits at the end, outside of any parentheses.
  const m = arg.match(/^(.*?)(?:\s+(\d+(?:\.\d+)?%))\s*$/);
  if (!m) return { color: arg.trim(), pct: null };
  return { color: m[1].trim(), pct: m[2] };
}

/** Inject an alpha channel into a color expression when possible. */
function injectAlpha(color, pct) {
  const trimmed = color.trim();
  // hsl(var(--x))            → hsl(var(--x) / P%)
  // hsl(H S% L%)             → hsl(H S% L% / P%)
  // hsla(...)                → same, replace/append alpha
  const hslMatch = trimmed.match(/^hsla?\(([\s\S]+)\)$/i);
  if (hslMatch) {
    let inner = hslMatch[1].trim();
    // Drop any existing alpha after `/`.
    inner = inner.replace(/\s*\/[\s\S]*$/, "");
    // Normalise `H, S%, L%` (comma form) → space form so `/ alpha` is valid.
    if (inner.includes(",")) inner = inner.split(",").map((s) => s.trim()).join(" ");
    return `hsl(${inner} / ${pct})`;
  }
  // rgb(R G B) / rgb(R,G,B)  → rgba equivalent when numeric, else give up.
  const rgbMatch = trimmed.match(/^rgba?\(([\s\S]+)\)$/i);
  if (rgbMatch) {
    let inner = rgbMatch[1].trim().replace(/\s*\/[\s\S]*$/, "");
    if (inner.includes(",")) inner = inner.split(",").map((s) => s.trim()).join(" ");
    return `rgb(${inner} / ${pct})`;
  }
  // currentcolor / var(--x) / named colors: no legacy way to attach alpha
  // without dropping the reference, so keep the base color.
  return trimmed;
}

function transformColorMix(css) {
  const marker = "color-mix(";
  let out = "";
  let i = 0;
  while (i < css.length) {
    const idx = css.indexOf(marker, i);
    if (idx === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, idx);
    const openParen = idx + marker.length - 1;
    const closeParen = findMatchingParen(css, openParen);
    if (closeParen === -1) {
      // malformed — bail out and keep the rest verbatim
      out += css.slice(idx);
      break;
    }
    const body = css.slice(openParen + 1, closeParen);
    const args = splitArgs(body);
    // Expect: <interpolation-method>, <color1 [pct]>, <color2 [pct]>
    if (args.length !== 3 || !/^in\s+/i.test(args[0])) {
      out += css.slice(idx, closeParen + 1);
      i = closeParen + 1;
      continue;
    }
    const first = splitColorAndPct(args[1]);
    const second = splitColorAndPct(args[2]);
    let replacement;
    if (second.color.toLowerCase() === "transparent") {
      // <color> P%, transparent → alpha-injected color
      replacement = first.pct ? injectAlpha(first.color, first.pct) : first.color;
    } else if (first.color.toLowerCase() === "transparent") {
      replacement = second.pct ? injectAlpha(second.color, second.pct) : second.color;
    } else {
      // Two real colors — no static blend possible. Keep the dominant one.
      const p = first.pct ? parseFloat(first.pct) : 50;
      replacement = p >= 50 ? first.color : second.color;
    }
    out += replacement;
    i = closeParen + 1;
  }
  return out;
}

const files = (await readdir(assetsDir)).filter((f) => f.endsWith(".css"));
if (files.length === 0) {
  console.log("[downlevel-css] no CSS files to process.");
  process.exit(0);
}

for (const file of files) {
  const full = join(assetsDir, file);
  const source = await readFile(full, "utf8");
  const rewritten = transformColorMix(source);
  const remaining = (rewritten.match(/color-mix\s*\(/gi) || []).length;
  await writeFile(full, rewritten);
  console.log(
    `[downlevel-css] rewrote ${file} (${source.length} → ${rewritten.length} bytes, color-mix() remaining: ${remaining})`,
  );
  if (remaining > 0) {
    console.error(
      `[downlevel-css] FAIL: ${remaining} unresolved color-mix() call(s) remain in ${file}.`,
    );
    process.exit(1);
  }
}
