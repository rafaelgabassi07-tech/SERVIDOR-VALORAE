import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSiblingApkRoot, hasSiblingApk } from './helpers/cross-stack-apk.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const index = read('public/index.html');
const logo = read('public/assets/valorae-logo.svg');

assert.match(index, /<title>VALORAE Proxy<\/title>/);
assert.match(index, /Serviço sob demanda/);
assert.doesNotMatch(index, /<script\b|\/api\/|fetch\s*\(/i);
assert.match(logo, /V-Proxy/i);
assert.equal(fs.existsSync(path.join(root, 'lib/observability/server-metrics.js')), false);
assert.equal(fs.existsSync(path.join(root, 'public/manifest.webmanifest')), false);
assert.equal(fs.existsSync(path.join(root, 'public/monitor-valorae.js')), false);

if (hasSiblingApk()) {
  const apkRoot = resolveSiblingApkRoot();
  const readApk = relative => fs.readFileSync(path.join(apkRoot, relative), 'utf8');
  const analysisEffects = readApk('app/src/main/java/com/example/ui/AnalysisEffects.kt');
  const modalLoader = readApk('app/src/main/java/com/example/ui/AssetModalProgressiveLoader.kt');
  assert.match(analysisEffects, /AnalysisRemoteSuggestionMinChars/);
  assert.match(analysisEffects, /localSuggestions\.size >= AnalysisLocalSuggestionTarget/);
  assert.doesNotMatch(modalLoader, /async\s*\{|select<|longArrayOf\(|delay\(/);
}

console.log('v-proxy static monitor and analysis on-demand OK');
