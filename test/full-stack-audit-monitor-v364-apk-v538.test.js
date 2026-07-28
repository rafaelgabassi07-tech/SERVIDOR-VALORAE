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
const html = read('public/index.html');
const sync = read('routes/sync.js');
const security = read('lib/security/client-auth.js');

assert.doesNotMatch(html, /<script\b|\/api\/|fetch\s*\(|XMLHttpRequest|EventSource|WebSocket/i);
assert.match(html, /página estática/i);
assert.equal(fs.existsSync(path.join(root, 'lib/observability/server-metrics.js')), false);
assert.equal(fs.existsSync(path.join(root, 'lib/observability/monitor-persistence.js')), false);
assert.equal(fs.existsSync(path.join(root, 'routes/server/metrics.js')), false);
assert.match(security, /isCanonicalValoraeApkRequest/);
assert.match(sync, /snapshotsEnabled: false/);
assert.match(sync, /backupsEnabled: false/);
assert.match(sync, /sharedRuntimeStateEnabled: false/);

if (apkAvailable) {
  const proxyMetadata = JSON.parse(read('metadata.json'));
  const apkMetadata = JSON.parse(readApk('metadata.json'));
  assert.equal(proxyMetadata.apkVersion, apkMetadata.versionName);
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
      calls.push({ method: match[1].toUpperCase(), route: match[2].replace(/^\/api\/v1/, '') || '/' });
    }
  }
  const uniqueCalls = [...new Map(calls.map(call => [`${call.method} ${call.route}`, call])).values()];
  const manifest = new Set(routeManifest().routes);
  assert.ok(uniqueCalls.length >= 16, 'catálogo direto do APK ficou inesperadamente pequeno');
  for (const call of uniqueCalls) {
    assert.ok(manifest.has(call.route), `rota do APK ausente no Proxy: ${call.method} ${call.route}`);
    assert.ok(routerTest.routeMethods(call.route).includes(call.method), `método incompatível: ${call.method} ${call.route}`);
  }
}

console.log('full-stack on-demand audit ok');
