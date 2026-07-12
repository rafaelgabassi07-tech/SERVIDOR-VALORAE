import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION,
  VALORAE_MOBILE_CACHE_POLICY_SECONDS,
  VALORAE_MOBILE_PROTOCOL_VERSION,
  VALORAE_REQUEST_HEADERS,
  VALORAE_EXPOSE_HEADERS,
} from '../lib/core/mobile-protocol.js';
import { dispatchRoute, _test as routerTest } from '../routes/_router.js';
import { _test as modalRuntimeTest } from '../lib/analysis/asset-modal-runtime.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
assert.equal(packageJson.valorae.publicVersion, '21.12.354');
assert.equal(packageJson.valorae.releasePatch, '21.12.354-asset-modal-late-arrival-settlement-v322');
assert.equal(metadata.apkVersion, '2026.07.12.03');
assert.ok(metadata.contractVersion.includes('APK v501 / Proxy 21.12.354'));

assert.equal(VALORAE_MOBILE_PROTOCOL_VERSION, '2026.07.10.10');
assert.equal(VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION, '3');
assert.deepEqual(routerTest.routeMethods('/sync'), ['GET', 'POST', 'DELETE']);
assert.equal(routerTest.routeMethod('/sync'), 'POST', 'POST permanece método primário para writes');
assert.equal(routerTest.safeRequestId(' req\nunsafe / id '), 'req-unsafe-id');
const syncOpenApi = routerTest.openApiOperationForRoute('/sync');
assert.ok(syncOpenApi.get && syncOpenApi.post && syncOpenApi.delete, 'OpenAPI deve anunciar todos os métodos reais do sync');

for (const header of [
  'X-Request-Id', 'X-Valorae-Mobile-Protocol', 'X-Valorae-App', 'X-Valorae-Channel', 'X-Valorae-App-Version',
  'X-Valorae-Build', 'X-Valorae-App-Id', 'X-Valorae-Client-Id',
  'X-Valorae-Client-Version', 'X-Valorae-Environment'
]) {
  assert.ok(VALORAE_REQUEST_HEADERS.includes(header), `header de request ausente no protocolo: ${header}`);
}
for (const header of ['X-Valorae-Mobile-Protocol', 'X-Valorae-Contract-Version', 'X-Valorae-Delivery-Schema', 'Retry-After']) {
  assert.ok(VALORAE_EXPOSE_HEADERS.includes(header), `header de resposta não exposto: ${header}`);
}

assert.deepEqual(VALORAE_MOBILE_CACHE_POLICY_SECONDS, {
  ready: 10,
  quote: 30,
  quotes: 30,
  assetHistory: 60,
  marketIndices: 30,
  marketRankings: 60,
  news: 30,
  analysis: 60,
  portfolioHistory: 30,
  portfolioEquilibrium: 20,
  portfolioReturns: 60,
  portfolioDividends: 60,
  assetModalFast: 35,
  assetModalFull: 180,
  assetModalFastStaleGrace: 120,
  assetModalFullStaleGrace: 900,
});

// Regressão: a seção infoSections do FII é publicada como "information" no delivery.
const fiiWithInformation = {
  ok: true,
  status: 'OK',
  stage: 'full',
  mode: 'full',
  assetType: 'FII',
  ticker: 'INFO11',
  quoteSummary: { price: 100, priceDisplay: 'R$ 100,00' },
  chart: { points: [{ close: 99 }, { close: 100 }] },
  metrics: [{ id: 'dy', value: '10%' }],
  comparison: { items: [{ label: 'IFIX', value: '5%' }], series: [], seriesByPeriod: {} },
  peerComparison: { rows: [{ ticker: 'PEER11' }] },
  checklist: { items: [{ id: 'quality', passed: true, status: 'PASSED' }] },
  distributions12m: { items: [{ month: '2026-06', value: 1 }], months: [] },
  dividendCharts: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
  aboutFund: { summary: 'Fundo de teste', sections: [], highlights: [] },
  patrimonialInfo: { metrics: [{ label: 'P/VP', value: '0,98' }], bars: [] },
  historicalIndicators: { rows: [{ label: 'P/VP' }], tablesByPeriod: {} },
  infoSections: [{ id: 'manager', items: [{ label: 'Gestor', value: 'Teste' }] }],
  announcements: { items: [{ id: 'notice', title: 'Comunicado do fundo' }] },
};
const fiiProfile = modalRuntimeTest.modalPayloadQualityProfile(fiiWithInformation, 'fii');
assert.equal(fiiProfile.deepSectionCount, 9, 'information e as duas seções críticas devem contar no perfil profundo do FII');
assert.equal(fiiProfile.completeForDelivery, true, 'FII com seis+ seções profundas deve poder concluir');
const fiiDelivery = modalRuntimeTest.buildModalDelivery(fiiWithInformation, { family: 'fii', requestedMode: 'full', mode: 'full' });
assert.ok(fiiDelivery.availableSections.includes('information'));
assert.equal(fiiDelivery.isFinal, true, 'seções críticas presentes permitem finalizar; opcionais ficam indisponíveis sem loop infinito');
assert.ok(fiiDelivery.unavailableSections.includes('propertyPortfolio'), 'seção opcional ausente deve ser declarada como indisponível após finalização');
assert.equal(fiiDelivery.completeForDelivery, true);

const apkCache = readSiblingApkFile('app/src/main/java/com/example/data/cache/ValoraeCachePolicy.kt');
const apkProtocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const apkHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const apkSync = readSiblingApkFile('app/src/main/java/com/example/data/sync/ValoraeSyncClient.kt');
const apkCatalog = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeProxyEndpointCatalog.kt');
const apkParser = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalParsers.kt');
if (apkCache && apkProtocol && apkHttp && apkSync && apkCatalog && apkParser) {
  assert.ok(apkProtocol.includes(`const val Version = "${VALORAE_MOBILE_PROTOCOL_VERSION}"`));
  assert.ok(apkProtocol.includes(`const val AssetModalDeliverySchemaVersion = "${VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION}"`));
  const ttlMarkers = {
    QuoteTtlMs: VALORAE_MOBILE_CACHE_POLICY_SECONDS.quote * 1000,
    QuoteIntradayHistoryTtlMs: VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetHistory * 1000,
    RankingTtlMs: VALORAE_MOBILE_CACHE_POLICY_SECONDS.marketRankings * 1000,
    NewsTtlMs: VALORAE_MOBILE_CACHE_POLICY_SECONDS.news * 1000,
    AnalysisTtlMs: VALORAE_MOBILE_CACHE_POLICY_SECONDS.analysis * 1000,
    PortfolioHistoryTtlMs: VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioHistory * 1000,
    PortfolioEquilibriumTtlMs: VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioEquilibrium * 1000,
    PortfolioReturnsTtlMs: VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioReturns * 1000,
    DividendAgendaTtlMs: VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioDividends * 1000,
  };
  for (const [name, value] of Object.entries(ttlMarkers)) {
    assert.ok(apkCache.includes(`const val ${name} = ${value}`) || apkCache.includes(`const val ${name} = ${value.toLocaleString('en-US').replaceAll(',', '_')}`), `TTL APK divergente: ${name}`);
  }
  assert.ok(apkCache.includes('effectiveHttpMaxAgeSeconds'));
  assert.ok(apkCache.includes('min(localMaxAge'));
  assert.ok(apkCache.includes('?: 0'), 'APK não deve inventar cache HTTP sem max-age do Proxy');
  assert.ok(apkCache.includes('directives.contains("no-store")'));
  assert.ok(apkHttp.includes('serverCacheControl = response.header("Cache-Control")'));
  assert.ok(apkHttp.includes('ValoraeMobileProtocol.HeaderRequestId'));
  assert.ok(apkHttp.includes('query["requestId"]'));
  const apkRuntime = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyRuntime.kt');
  const apkPublicFeed = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyPublicFeedService.kt');
  assert.ok(apkRuntime?.includes('MarketRankingCacheTtlMs = ValoraeCachePolicy.RankingTtlMs'));
  assert.ok((apkPublicFeed?.match(/MarketRankingCacheTtlMs/g) || []).length >= 2);
  assert.ok(apkSync.includes('ValoraeMobileProtocol.HeaderRequestId'));
  assert.ok(apkSync.includes('ValoraeMobileProtocol.HeaderAppVersion'));
  const syncGetMarkers = apkCatalog.match(/ProxyEndpointStatus\("\/api\/sync"[^\n]+method = "GET"\)/g) || [];
  assert.equal(syncGetMarkers.length, 2, 'health e diagnostics do sync devem refletir o GET real usado pelo APK');
  assert.ok(apkParser.includes('schemaVersion = optStringOrNull("schemaVersion")'));
  assert.ok(apkParser.includes('else inferredFinal'));
  assert.ok(apkParser.includes('"1-compat"'));
}


function mockResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    writableEnded: false,
    body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    end(value = '') { this.body = String(value); this.writableEnded = true; return this; },
    headers,
  };
}

const correlatedReq = {
  method: 'GET',
  url: '/api/v1/ready?requestId=query-request-id',
  headers: { 'x-request-id': 'header-request-id', origin: 'https://app.valorae.test' },
};
const correlatedRes = mockResponse();
await dispatchRoute(correlatedReq, correlatedRes);
const correlatedPayload = JSON.parse(correlatedRes.body);
assert.equal(correlatedRes.getHeader('X-Request-Id'), 'header-request-id');
assert.equal(correlatedPayload.requestId, 'header-request-id', 'body e header devem usar o mesmo requestId');
assert.equal(correlatedRes.getHeader('Access-Control-Allow-Origin'), 'https://app.valorae.test');

const coreHttp = fs.readFileSync(new URL('../lib/core/http.js', import.meta.url), 'utf8');
const perfHttp = fs.readFileSync(new URL('../lib/performance/http.js', import.meta.url), 'utf8');
const router = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
assert.ok(coreHttp.includes("X-Valorae-Contract-Version"));
assert.ok(coreHttp.includes("X-Valorae-Delivery-Schema"));
assert.ok(coreHttp.includes('responseRequestId'));
assert.ok(perfHttp.includes('responseRequestId'));
assert.ok(perfHttp.includes("X-Valorae-Contract-Version"));
assert.ok(perfHttp.includes("X-Valorae-Delivery-Schema"));
assert.ok(router.includes('mobileCachePolicySeconds: VALORAE_MOBILE_CACHE_POLICY_SECONDS'));
assert.ok(router.includes('methods: routeMethods(path)'));

console.log('apk-proxy-protocol-cache-harmony-v311 ok');
