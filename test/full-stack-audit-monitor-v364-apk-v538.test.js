import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeManifest, _test as routerTest } from '../routes/_router.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apkRoot = path.resolve(root, '..', 'apk');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const readApk = relative => fs.readFileSync(path.join(apkRoot, relative), 'utf8');
const proxyMetadata = JSON.parse(read('metadata.json'));
const apkMetadata = JSON.parse(readApk('metadata.json'));
const apkBuild = readApk('app/build.gradle.kts');
const proxyProtocol = read('lib/core/mobile-protocol.js');
const apkCache = readApk('app/src/main/java/com/example/data/cache/ValoraeCachePolicy.kt');
const monitorHtml = read('public/index.html');
const metrics = read('lib/observability/server-metrics.js');
const persistence = read('lib/observability/monitor-persistence.js');
const sharedState = read('lib/state/shared-state-foundation.js');
const sync = read('routes/sync.js');

assert.equal(proxyMetadata.apkVersion, apkMetadata.versionName);
assert.equal(apkMetadata.versionCode, 26072503);
assert.match(apkBuild, /versionCode = 26072503/);
assert.match(apkBuild, /versionName = "2026\.07\.25\.03"/);
assert.match(proxyMetadata.contractVersion, /APK v541/);
assert.match(proxyMetadata.contractVersion, /monitor v366/);
assert.match(apkMetadata.contractVersion, /Proxy 21\.12\.394/);
assert.match(apkMetadata.contractVersion, /monitor v(?:364|366)/);

for (const [apkPattern, proxyPattern] of [
  [/QuoteTtlMs\s*=\s*2L \* 60L \* 1000L/, /quote:\s*120/],
  [/RankingTtlMs\s*=\s*15L \* 60L \* 1000L/, /marketRankings:\s*900/],
  [/NewsTtlMs\s*=\s*15L \* 60L \* 1000L/, /news:\s*900/],
  [/PortfolioHistoryTtlMs\s*=\s*5L \* 60L \* 1000L/, /portfolioHistory:\s*300/],
  [/PortfolioReturnsTtlMs\s*=\s*5L \* 60L \* 1000L/, /portfolioReturns:\s*300/],
  [/DividendAgendaTtlMs\s*=\s*15L \* 60L \* 1000L/, /portfolioDividends:\s*900/],
]) {
  assert.match(apkCache, apkPattern);
  assert.match(proxyProtocol, proxyPattern);
}

const kotlinFiles = [];
function walk(current) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const target = path.join(current, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (target.endsWith('.kt')) kotlinFiles.push(target);
  }
}
walk(path.join(apkRoot, 'app/src/main/java'));
const calls = [];
for (const file of kotlinFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/executeJson(Get|Post)(?:Cancellable)?\s*\(\s*"(\/api\/v1\/[^"?]+)"/g)) {
    calls.push({ method: match[1].toUpperCase(), route: match[2].replace(/^\/api\/v1/, '') || '/', file });
  }
}
const uniqueCalls = [...new Map(calls.map(call => [`${call.method} ${call.route}`, call])).values()];
const manifest = new Set(routeManifest().routes);
assert.ok(uniqueCalls.length >= 16, 'catálogo direto do APK ficou inesperadamente pequeno');
for (const call of uniqueCalls) {
  assert.ok(manifest.has(call.route), `rota do APK ausente no Proxy: ${call.method} ${call.route}`);
  assert.ok(routerTest.routeMethods(call.route).includes(call.method), `método incompatível: ${call.method} ${call.route}`);
}

assert.match(monitorHtml, /valorae-monitor-material3-themes-v366/);
for (const view of ['overview','traffic','request','routes','sources','health','diagnostics','architecture','benchmark','settings']) assert.match(monitorHtml, new RegExp(`data-view-panel="${view}"`));
assert.match(metrics, /mode: 'memory-observability'/);
assert.match(metrics, /persistent: false/);
assert.match(persistence, /const enabled = false/);
assert.match(sharedState, /VALORAE_SHARED_STATE_MODE \|\| 'memory'/);
assert.match(sharedState, /VALORAE_SHARED_STATE_REMOTE_ENABLED, false/);
assert.match(sync, /VALORAE_FINANCIAL_SYNC_BACKUPS_ENABLED, false/);

console.log('full-stack-audit-monitor-v366-apk-v541 ok');
