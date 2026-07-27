import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeManifest, _test as routerTest } from '../routes/_router.js';
import { resolveSiblingApkRoot, hasSiblingApk } from './helpers/cross-stack-apk.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apkRoot = resolveSiblingApkRoot();
const apkAvailable = hasSiblingApk();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const readApk = relative => fs.readFileSync(path.join(apkRoot, relative), 'utf8');
const proxyMetadata = JSON.parse(read('metadata.json'));
const apkMetadata = apkAvailable ? JSON.parse(readApk('metadata.json')) : null;
const apkBuild = apkAvailable ? readApk('app/build.gradle.kts') : '';
const proxyProtocol = read('lib/core/mobile-protocol.js');
const apkCache = apkAvailable ? readApk('app/src/main/java/com/example/data/cache/ValoraeCachePolicy.kt') : '';
const monitorHtml = read('public/index.html');
const metrics = read('lib/observability/server-metrics.js');
const persistence = read('lib/observability/monitor-persistence.js');
const sharedState = read('lib/state/shared-state-foundation.js');
const sync = read('routes/sync.js');

if (apkAvailable) {
  assert.equal(proxyMetadata.apkVersion, apkMetadata.versionName);
  assert.match(apkBuild, new RegExp(`versionCode = ${apkMetadata.versionCode}`));
  assert.match(apkBuild, new RegExp(`versionName = \"${apkMetadata.versionName.replaceAll('.', '\\.') }\"`));
  assert.ok(proxyMetadata.contractVersion.includes(`APK ${apkMetadata.checkpoint.match(/^v\d+/)?.[0]}`));
  assert.match(proxyMetadata.contractVersion, /asset modal delivery v4/i);
  assert.match(proxyMetadata.contractVersion, /monitor v367 memory-only/i);
  assert.match(apkMetadata.contractVersion, /Proxy 21\.12\.395/);
  assert.match(apkMetadata.contractVersion, /monitor v367 memory-only/i);

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

} else {
  console.log('full-stack APK assertions skipped in standalone Proxy suite; use VALORAE_APK_ROOT for integrated audit');
}

assert.match(monitorHtml, /valorae-monitor-material3-polish-v367/);
for (const view of ['overview','traffic','request','routes','sources','health','diagnostics','architecture','benchmark','settings']) assert.match(monitorHtml, new RegExp(`data-view-panel="${view}"`));
assert.match(metrics, /mode: 'memory-observability'/);
assert.match(metrics, /persistent: false/);
assert.match(persistence, /const enabled = false/);
assert.match(sharedState, /return boolValue\(process\.env\.VALORAE_SHARED_STATE_ENABLED, true\) \? 'memory' : 'off'/);
assert.match(persistence, /active: false/);
assert.match(sync, /snapshotsEnabled: false/);
assert.match(sync, /backupsEnabled: false/);
assert.match(sync, /sharedRuntimeStateEnabled: false/);

console.log(`full-stack-audit-monitor-v367-${apkMetadata?.checkpoint || 'proxy-standalone'} ok`);
