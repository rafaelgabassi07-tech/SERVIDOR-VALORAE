import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dispatchRoute, routeManifest } from '../routes/_router.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

function mockRes() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    writableEnded: false,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    end(value = '') { this.body = Buffer.isBuffer(value) ? value : String(value); this.writableEnded = true; return this; },
    status(code) { this.statusCode = code; return this; },
    send(value) { return this.end(value); },
  };
}

async function invoke(headers = {}) {
  const res = mockRes();
  await dispatchRoute({
    method: 'GET',
    url: '/api/v1/health',
    headers,
    socket: { remoteAddress: '127.0.9.1' },
  }, res);
  return res;
}

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');
const router = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

assert.equal(vercel.crons, undefined);
assert.doesNotMatch(html, /<script\b|fetch\s*\(|XMLHttpRequest|EventSource|WebSocket|\/api\//i);
assert.doesNotMatch(sw, /addEventListener\(['"]fetch|fetch\s*\(/);
assert.match(sw, /registration\.unregister\(\)/);
assert.doesNotMatch(router, /\/server\/metrics|\/monitor\/summary|\/monitor\/self-test|attachProxyMetricsInterceptor/);
assert.equal(fs.existsSync(new URL('../lib/analysis/analysis-page-response.js', import.meta.url)), false);
for (const route of ['/server/metrics', '/monitor/summary', '/monitor/self-test', '/server/tests', '/analysis', '/asset/analysis']) {
  assert.equal(routeManifest().routes.includes(route), false, `rota operacional abandonada ainda publicada: ${route}`);
}

const savedApkOnly = process.env.VALORAE_APK_ONLY;
const savedRate = process.env.VALORAE_RATE_LIMIT_DISABLED;
try {
  process.env.VALORAE_APK_ONLY = '1';
  process.env.VALORAE_RATE_LIMIT_DISABLED = '1';
  const denied = await invoke();
  assert.equal(denied.statusCode, 403);
  assert.equal(JSON.parse(denied.body).code, 'VALORAE_APK_REQUEST_REQUIRED');

  const wrongApp = await invoke({
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': '2026.07.27.02',
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.example.other',
    'x-valorae-mobile-protocol': '2026.07.10.10',
  });
  assert.equal(wrongApp.statusCode, 403);

  const accepted = await invoke({
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': '2026.07.27.02',
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
  });
  assert.equal(accepted.statusCode, 200);
  assert.equal(JSON.parse(accepted.body).ok, true);
} finally {
  if (savedApkOnly === undefined) delete process.env.VALORAE_APK_ONLY; else process.env.VALORAE_APK_ONLY = savedApkOnly;
  if (savedRate === undefined) delete process.env.VALORAE_RATE_LIMIT_DISABLED; else process.env.VALORAE_RATE_LIMIT_DISABLED = savedRate;
}

const analysisEffects = readSiblingApkFile('app/src/main/java/com/example/ui/AnalysisEffects.kt');
const modalLoader = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalProgressiveLoader.kt');
const modalUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetDetailsModalUi.kt');
const logoUi = readSiblingApkFile('app/src/main/java/com/example/ui/PortfolioAssetsCardsUi.kt');
const discovery = readSiblingApkFile('app/src/main/java/com/example/ui/AnalysisDiscoveryCatalog.kt');
const diagnostics = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyDiagnosticsService.kt');
if (analysisEffects && modalLoader && modalUi && logoUi && discovery && diagnostics) {
  assert.match(analysisEffects, /proxyResults = emptyList\(\)/);
  assert.match(analysisEffects, /localSuggestions\.size >= AnalysisLocalSuggestionTarget/);
  assert.match(analysisEffects, /delay\(if \(normalizedQuery\.looksLikeTicker\(\)\)/);
  assert.match(modalLoader, /internal suspend fun loadSingleAssetModalOnDemand/);
  assert.equal((modalLoader.match(/loadSingleAssetModalContract\(/g) || []).length, 1);
  assert.doesNotMatch(modalLoader, /async\s*\(|select<Pair<|longArrayOf\(|delay\(/);
  assert.match(modalUi, /recovery = retryNonce > 0/);
  assert.match(logoUi, /ValoraeMobileProtocol\.HeaderMobileProtocol/);
  assert.doesNotMatch(logoUi, /"2026\.07\.10\.10"/);
  assert.match(discovery, /missing\.chunked\(80\)/);
  assert.doesNotMatch(discovery, /allowDeepRefresh|searchAssets\(ticker\)/);
  assert.equal((diagnostics.match(/executeJsonGet\("\/api\/v1\/ready"\)/g) || []).length, 1);
  assert.doesNotMatch(diagnostics, /checkEndpoints|expectedEndpoints/);
}

console.log('apk-only static monitor and analysis v399 OK');
