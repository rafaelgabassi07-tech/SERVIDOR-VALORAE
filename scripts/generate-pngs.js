import fs from 'node:fs';
import path from 'node:path';

// Brand PNGs are committed artifacts rendered from public/assets/valorae-logo.svg.
// This script intentionally validates them instead of generating placeholder images.
const assetsDir = path.resolve('public/assets');
const expected = new Map([
  ['valorae-favicon-48.png', [48, 48]],
  ['valorae-icon-192.png', [192, 192]],
  ['valorae-icon-512.png', [512, 512]],
  ['valorae-icon-1024.png', [1024, 1024]],
]);

function pngDimensions(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature || buffer.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error('Invalid PNG signature');
  }
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

for (const [name, dimensions] of expected) {
  const file = path.join(assetsDir, name);
  const buffer = fs.readFileSync(file);
  const actual = pngDimensions(buffer);
  if (actual[0] !== dimensions[0] || actual[1] !== dimensions[1]) {
    throw new Error(`${name}: expected ${dimensions.join('x')}, got ${actual.join('x')}`);
  }
  if (buffer.length < 500) throw new Error(`${name}: suspiciously small brand asset`);
}

console.log('Canonical VALORAE brand PNG assets validated.');
