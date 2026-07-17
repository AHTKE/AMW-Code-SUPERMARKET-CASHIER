#!/usr/bin/env node
/**
 * Capacitor regenerates android/app/capacitor.build.gradle on every sync.
 * The generated file can force Java 21, while the project guide supports
 * JDK 17+ local builds. Patch it after sync so Gradle/Android Studio builds
 * do not fail with "invalid source release: 21".
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const file = "android/app/capacitor.build.gradle";

if (!existsSync(file)) {
  console.log("[android] capacitor.build.gradle not found; skipping Java patch.");
  process.exit(0);
}

const original = await readFile(file, "utf8");
const patched = original.replaceAll("JavaVersion.VERSION_21", "JavaVersion.VERSION_17");

if (patched !== original) {
  await writeFile(file, patched, "utf8");
  console.log("[android] patched Capacitor Gradle Java target to VERSION_17.");
} else {
  console.log("[android] Capacitor Gradle Java target already compatible.");
}