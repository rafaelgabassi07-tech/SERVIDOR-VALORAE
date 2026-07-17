import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  attachProxyMetricsInterceptor,
  getServerMetricsSnapshot,
  resetServerMetricsForTests,
} from '../lib/observability/server-metrics.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const metadata = JSON.parse(read('metadata.json'));
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const contract = JSON.parse(read('contracts/checkpoint119/monitor-live-stream.json'));
const index = read('public/index.html');
const server = read('public/server.html');
const css = read('public/monitor-valorae.css');
const runtime = read('public/monitor-valorae.js');

assert.equal(pkg.valorae.publicVersion, '21.12.382');
assert.equal(pkg.valorae.releasePatch, '21.12.382-quote-state-resilience-v350');
assert.equal(pkg.valorae.checkpoint, 'quote-state-resilience-v350');
assert.equal(metadata.monitorObservabilityVersion, '2026.07.17-checkpoint119-v1');
assert.equal(manifest.version, '21.12.382');
assert.equal(manifest.start_url, '/server.html#live');
assert.equal(contract.contractVersionUnchanged, true);
assert.equal(contract.invariants.apkV528Compatible, true);

assert.equal(index, server, 'as duas URLs do monitor precisam entregar a mesma interface');
assert.doesNotThrow(() => new vm.Script(runtime, { filename: 'monitor-valorae.js' }));
assert.equal((index.match(/<script(?![^>]*\bsrc=)/gi) || []).length, 0);
for (const view of ['live', 'routes', 'health', 'settings']) assert.ok(index.includes(`data-view-panel="${view}"`));
for (const feature of ['eventFeed', 'eventDetail', 'inflightList', 'routeTable', 'trafficChart', 'rawSnapshot']) {
  assert.ok(index.includes(`id="${feature}"`), `${feature} ausente`);
}
assert.doesNotMatch(index, /class="[^"]*\bcard\b/i);
assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css, /backdrop-filter\s*:/i);
assert.doesNotMatch(css, /box-shadow\s*:/i);
assert.ok(css.includes('@media(max-width:760px)'));
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));

function response() {
  const headers = new Map([['content-type', 'application/json']]);
  return {
    statusCode: 200,
    writableEnded: false,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    write() { return true; },
    end() { this.writableEnded = true; return this; },
  };
}

resetServerMetricsForTests();
const req = {
  method: 'POST',
  url: '/api/v1/monitor-v349?ticker=PETR4&range=1y&token=oculto',
  headers: {
    'content-length': '64',
    'content-type': 'application/json',
    'x-request-id': 'monitor-v349-correlation',
    'x-valorae-app': 'VALORAE APK',
    'x-valorae-channel': 'mobile',
  },
};
const res = response();
attachProxyMetricsInterceptor(req, res);
let snapshot = getServerMetricsSnapshot();
assert.equal(snapshot.activeRequests.length, 1);
assert.equal(snapshot.activeRequests[0].bytesIn, 64);
assert.equal(snapshot.activeRequests[0].requestId, 'monitor-v349-correlation');
assert.deepEqual(snapshot.activeRequests[0].safeQuery, { ticker: 'PETR4', range: '1y' });
assert.ok(snapshot.activeRequests[0].queryKeys.includes('token'));
assert.equal(snapshot.activeRequests[0].safeQuery.token, undefined);
res.end('{"ok":true}');
snapshot = getServerMetricsSnapshot();
assert.equal(snapshot.activeRequests.length, 0);
const event = snapshot.proxyOutputMonitor.outputFeed[0];
assert.equal(event.route, '/api/v1/monitor-v349');
assert.equal(event.bytesIn, 64);
assert.equal(event.requestContentType, 'application/json');
assert.equal(event.requestId, 'monitor-v349-correlation');
assert.equal(event.safeQuery.token, undefined);
assert.equal(snapshot.summary.captureCompletenessPercent, 100);

const apkMetadataText = readSiblingApkFile('metadata.json');
const apkProtocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
if (apkMetadataText || apkProtocol) {
  const apkMetadata = JSON.parse(apkMetadataText || '{}');
  assert.equal(apkMetadata.versionCode, 26071702);
  assert.equal(apkMetadata.proxyPatch, '21.12.382-quote-state-resilience-v350');
  assert.match(apkProtocol || '', /Version = "2026\.07\.10\.10"/);
}

console.log('proxy-monitor-live-stream-v349 ok');
