#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const platform = process.argv[2];
if (!['android', 'ios'].includes(platform)) {
  console.error('[cap] usage: node scripts/ensure-cap-platform.mjs <android|ios>');
  process.exit(1);
}

if (existsSync(platform)) {
  console.log(`[cap] ${platform}/ already exists; skipping cap add ${platform}.`);
  process.exit(0);
}

const result = spawnSync('npx', ['cap', 'add', platform], { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);