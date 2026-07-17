#!/usr/bin/env node
/**
 * Builds only the static client artifacts used by Electron and Capacitor.
 * Native packages do not run the Nitro server bundle, so skipping it removes
 * server-only packaging warnings while keeping the web build script unchanged.
 */
import { spawnSync } from 'node:child_process';

const commands = [
  ['vite', ['build']],
  ['node', ['scripts/copy-output-to-dist.mjs']],
  ['node', ['scripts/build-spa-entry.mjs']],
  ['node', ['scripts/downlevel-css.mjs']],
  ['node', ['scripts/generate-static-shell.mjs']],
];

for (const [cmd, args] of commands) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, POS_PACKAGE_BUILD: '1' },
  });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}