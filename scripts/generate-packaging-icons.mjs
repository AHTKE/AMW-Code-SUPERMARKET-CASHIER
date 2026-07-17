#!/usr/bin/env node
/**
 * Regenerates Electron build icons from assets/icon.png.
 * Keeps fresh clones buildable even if generated binary icons were omitted.
 */
import { existsSync } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const source = 'assets/icon.png';

if (!existsSync(source)) {
  console.error('[icons] assets/icon.png is missing.');
  process.exit(1);
}

if (existsSync('build')) {
  const buildPath = await stat('build');
  if (!buildPath.isDirectory()) {
    await rm('build', { force: true });
  }
}
await mkdir('build', { recursive: true });

const script = String.raw`
from pathlib import Path
from PIL import Image

src = Path('assets/icon.png')
out = Path('build')
out.mkdir(exist_ok=True)

img = Image.open(src).convert('RGBA')
if img.width != img.height:
    side = max(img.width, img.height)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((side - img.width) // 2, (side - img.height) // 2))
    img = canvas

img.resize((512, 512), Image.Resampling.LANCZOS).save(out / 'icon.png')
img.save(out / 'icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

def png_bytes(size):
    import io
    b = io.BytesIO()
    img.resize((size, size), Image.Resampling.LANCZOS).save(b, format='PNG')
    return b.getvalue()

def icns_type(size):
    return {
        16: b'icp4', 32: b'icp5', 64: b'icp6',
        128: b'ic07', 256: b'ic08', 512: b'ic09', 1024: b'ic10',
    }[size]

chunks = []
for size in (16, 32, 64, 128, 256, 512, 1024):
    payload = png_bytes(size)
    chunks.append(icns_type(size) + (len(payload) + 8).to_bytes(4, 'big') + payload)
body = b''.join(chunks)
(out / 'icon.icns').write_bytes(b'icns' + (len(body) + 8).to_bytes(4, 'big') + body)
print('[icons] wrote build/icon.ico, build/icon.png, build/icon.icns')
`;

const result = spawnSync('python3', ['-c', script], { stdio: 'inherit' });
process.exit(result.status ?? 1);