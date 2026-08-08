import assert from 'node:assert/strict';
import fs from 'node:fs';
import { routeManifest, _test as routerTest } from '../routes/_router.js';
import { _test as modalRuntimeTest } from '../lib/analysis/asset-modal-runtime.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';



const routes = new Set(routeManifest().routes);
const requiredRoutes = new Map([
  ['/ready', 'GET'],
  ['/sync', 'POST'],
  ['/mobile/alerts', 'POST'],
  ['/mobile/daily-close', 'POST'],
  ['/dividends/batch', 'POST'],
  ['/assets', 'GET'],
  ['/asset/quote', 'GET'],
  ['/quotes', 'GET'],
  ['/asset/history', 'GET'],
  ['/asset/modal', 'GET'],
  ['/asset/logo', 'GET'],
  ['/market/indices', 'GET'],
  ['/market/rankings', 'GET'],
  ['/analysis/rankings', 'GET'],
  ['/news', 'GET'],
  ['/news/article', 'POST'],
  ['/portfolio/history', 'POST'],
  ['/portfolio/equilibrium', 'POST'],
  ['/portfolio/returns', 'POST']
]);
assert.deepEqual(
  [...routerTest.PRODUCTION_ROUTE_ALLOWLIST].sort(),
  [...requiredRoutes.keys()].sort(),
  'allowlist de produção deve corresponder exatamente às rotas consumidas pelo APK'
);

for (const [route, method] of requiredRoutes) {
  assert.ok(routes.has(route), `rota obrigatória ausente: ${route}`);
  assert.equal(routerTest.routeMethod(route), method, `método divergente em ${route}`);
}

function stableButIncompleteStock() {
  return {
    ok: true,
    status: 'OK',
    stage: 'full',
    mode: 'full',
    fullOnly: true,
    ticker: 'HARM3',
    quoteSummary: { price: 12.3, priceDisplay: 'R$ 12,30' },
    chart: { points: [{ close: 12.1 }, { close: 12.3 }] },
    metrics: [{ id: 'price', value: 'R$ 12,30' }],
    fundamentalIndicators: { items: [{ id: 'pl', value: '8,2' }] },
    historicalIndicators: { rows: [{ label: 'P/L' }], tablesByPeriod: {} },
    checklist: { items: [{ id: 'dy', passed: true, status: 'PASSED' }] },
    dividendHistory: { events: [{ date: '2026-06-01', value: 0.5 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
    companyProfile: { facts: [{ id: 'segment', value: 'Serviços' }], sections: [] },
    returns: { rows: [{ label: '12M', value: '7%' }] },
    announcements: { items: [{ title: 'Comunicado', url: 'https://example.test' }] }
  };
}

const incompleteStock = stableButIncompleteStock();
const incompleteProfile = modalRuntimeTest.modalPayloadQualityProfile(incompleteStock, 'stock');
assert.equal(incompleteProfile.stableForCache, false, 'contrato sem gráficos críticos não pode aquecer o cache full');
assert.equal(incompleteProfile.completeForDelivery, false, 'cache estável não pode ser confundido com entrega final');
assert.equal(incompleteProfile.recoveryTargetPercent, 82);
const incompleteDelivery = modalRuntimeTest.buildModalDelivery(incompleteStock, {
  family: 'stock',
  requestedMode: 'full',
  mode: 'full',
  requestId: 'harmony-stock-incomplete'
});
assert.equal(incompleteDelivery.stableForCache, false);
assert.equal(incompleteDelivery.completeForDelivery, false);
assert.equal(incompleteDelivery.isFinal, false);
assert.equal(incompleteDelivery.retryable, true);
assert.equal(incompleteDelivery.qualityTier, 'basic');
assert.equal(incompleteDelivery.minimumDeepSections, 7);
assert.equal(incompleteDelivery.recoveryTargetPercent, 82);

const completeStock = {
  ...incompleteStock,
  historicalIndicators: { rows: [{ label: 'P/L', values: { Atual: '8,2', 2025: '9,1' } }], tablesByPeriod: {} },
  dividendRadar: { status: 'OK', months: [{ activeDateCom: true, dateComCount: 1 }] },
  payoutChart: { points: [{ period: '2025' }] },
  peerComparison: { rows: [{ ticker: 'TEST3' }] },
  indexComparison: { items: [{ code: 'IBOV' }], series: [{ code: 'HARM3', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 1 }] }, { code: 'IBOV', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 2 }] }], seriesByPeriod: {} },
  companyData: { facts: [{ id: 'sector', value: 'Serviços' }], companyPapers: [], fractionalPapers: [], sections: [] },
  companyInformation: { facts: [{ id: 'activity', value: 'Operação' }], groups: [] },
  revenueByRegion: { items: [{ label: 'Brasil', value: 100 }] },
  revenueByBusiness: { items: [{ label: 'Serviços', value: 100 }] },
  shareholdingPosition: { rows: [{ shareholder: 'Mercado' }] },
  revenueProfitChart: { points: [{ period: '2025' }] },
  profitQuoteChart: { points: [{ period: '2025' }] },
  equityEvolutionChart: { points: [{ period: '2025' }] },
  resultsStatement: { rows: [{ label: 'Receita', value: '100' }], tablesByPeriod: {} },
  balanceSheetStatement: { rows: [{ label: 'Patrimônio', value: '100' }], tablesByPeriod: {} }
};
const completeStockProfile = modalRuntimeTest.modalPayloadQualityProfile(completeStock, 'stock');
assert.equal(completeStockProfile.completeForDelivery, true);
const completeStockDelivery = modalRuntimeTest.buildModalDelivery(completeStock, {
  family: 'stock', requestedMode: 'full', mode: 'full', requestId: 'harmony-stock-complete'
});
assert.equal(completeStockDelivery.isFinal, true);
assert.equal(completeStockDelivery.retryable, false);
assert.equal(completeStockDelivery.qualityTier, 'complete');

const stableButIncompleteFii = {
  ok: true,
  status: 'OK',
  stage: 'full',
  mode: 'full',
  ticker: 'HARM11',
  assetType: 'FII',
  quoteSummary: { price: 100, priceDisplay: 'R$ 100,00' },
  chart: { points: [{ close: 99 }, { close: 100 }] },
  metrics: [{ id: 'price', value: 'R$ 100,00' }],
  comparison: { items: [{ label: 'IFIX', value: '4%' }], series: [], seriesByPeriod: {} },
  peerComparison: { rows: [{ ticker: 'TEST11' }] },
  checklist: { items: [{ id: 'vacancy', passed: true, status: 'PASSED' }] },
  distributions12m: { items: [{ month: '2026-06', value: 1 }], months: [] },
  dividendCharts: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} },
  aboutFund: { summary: 'Fundo de teste', sections: [], highlights: [] },
  announcements: { items: [{ title: 'Relatório', url: 'https://example.test' }] }
};
const incompleteFiiProfile = modalRuntimeTest.modalPayloadQualityProfile(stableButIncompleteFii, 'fii');
assert.equal(incompleteFiiProfile.stableForCache, false, 'FII sem histórico/patrimônio não pode aquecer o cache full');
assert.equal(incompleteFiiProfile.completeForDelivery, false);
assert.equal(incompleteFiiProfile.recoveryTargetPercent, 76);
const incompleteFiiDelivery = modalRuntimeTest.buildModalDelivery(stableButIncompleteFii, {
  family: 'fii', requestedMode: 'full', mode: 'full', requestId: 'harmony-fii-incomplete'
});
assert.equal(incompleteFiiDelivery.isFinal, false);
assert.equal(incompleteFiiDelivery.retryable, true);
assert.equal(incompleteFiiDelivery.minimumDeepSections, 6);
assert.equal(incompleteFiiDelivery.recoveryTargetPercent, 76);

const protocolSource = fs.readFileSync(new URL('../lib/core/mobile-protocol.js', import.meta.url), 'utf8');
for (const header of ['X-Valorae-App', 'X-Valorae-Channel', 'X-Valorae-App-Version', 'X-Valorae-Build', 'X-Valorae-App-Id', 'X-Valorae-Client-Id', 'X-Valorae-Client-Version', 'X-Valorae-Environment']) {
  assert.ok(protocolSource.includes(header), `protocolo móvel deve reconhecer ${header}`);
}

const diagnosticsKt = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyDiagnosticsService.kt');
const httpKt = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
const deliveryKt = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeAssetModalDelivery.kt');
const parserKt = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetModalParsers.kt');
const qualityKt = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeAssetModalQuality.kt');
const loaderKt = readSiblingApkFile('app/src/main/java/com/example/ui/shared/asset/AssetModalProgressiveLoader.kt');
const runtimeKt = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyRuntime.kt');
const mobileProtocolKt = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const alertsServiceKt = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyBackgroundAlertsService.kt');
const notificationUiKt = readSiblingApkFile('app/src/main/java/com/example/feature/alerts/PortfolioNotificationCenterScreenUi.kt');
const notificationViewModelKt = readSiblingApkFile('app/src/main/java/com/example/feature/alerts/PortfolioNotificationCenterViewModel.kt');
const notificationWorkerKt = [
  readSiblingApkFile('app/src/main/java/com/example/data/notifications/ValoraeNotificationWorker.kt'),
  readSiblingApkFile('app/src/main/java/com/example/data/notifications/ValoraeNotificationRefreshService.kt'),
].filter(Boolean).join('\n');
const dailyCloseWorkerKt = readSiblingApkFile('app/src/main/java/com/example/data/notifications/ValoraeDailyCloseWorker.kt');
if (diagnosticsKt && httpKt && deliveryKt && parserKt && qualityKt && loaderKt && runtimeKt && mobileProtocolKt) {
  assert.equal((diagnosticsKt.match(/executeJsonGet\("\/api\/v1\/ready"\)/g) || []).length, 1, 'diagnóstico deve executar uma única chamada leve de readiness');
  for (const header of ['X-Valorae-App', 'X-Valorae-Channel', 'X-Valorae-App-Version', 'X-Valorae-Build', 'X-Valorae-App-Id']) {
    assert.ok(mobileProtocolKt.includes(`"${header}"`), `APK deve declarar ${header}`);
  }
  assert.ok(httpKt.includes('ValoraeMobileProtocol.HeaderApp'), 'cliente HTTP deve usar os cabeçalhos canônicos compartilhados');
  for (const field of ['qualityTier', 'stableForCache', 'completeForDelivery', 'deepSectionCount', 'minimumDeepSections', 'recoveryTargetPercent']) {
    assert.ok(deliveryKt.includes(`val ${field}`), `APK deve modelar delivery.${field}`);
    assert.ok(parserKt.includes(`"${field}"`), `APK deve ler delivery.${field}`);
  }
  assert.ok(qualityKt.includes('delivery.completeForDelivery == false'));
  assert.ok(qualityKt.includes('delivery.stableForCache'));
  assert.ok(loaderKt.includes('internal suspend fun loadSingleAssetModalOnDemand'));
  assert.ok(loaderKt.includes('stage = SingleAssetModalLoadStage.Full'));
  assert.ok(!loaderKt.includes('async(') && !loaderKt.includes('delay(') && !loaderKt.includes('select<Pair<'), 'modal do APK não deve abrir fan-out ou retry temporizado');
  assert.ok(runtimeKt.includes('SingleAssetModalFastCacheTtlMs = ValoraeCachePolicy.AssetModalFastTtlMs'));
  assert.ok(runtimeKt.includes('SingleAssetModalFullCacheTtlMs = ValoraeCachePolicy.AssetModalFullTtlMs'));
}

if (alertsServiceKt && notificationUiKt && notificationViewModelKt && notificationWorkerKt && dailyCloseWorkerKt) {
  assert.ok(alertsServiceKt.includes('executeJsonPostCancellable("/api/v1/mobile/alerts", body)'), 'APK deve usar o bundle de alertas sob demanda');
  assert.equal((notificationUiKt.match(/ValoraeProxyClient\.getBackgroundAlerts\(/g) || []).length, 0, 'UI da Central não deve executar transporte diretamente');
  assert.equal((notificationViewModelKt.match(/ValoraeProxyClient\.getBackgroundAlerts\(/g) || []).length, 1, 'ViewModel da Central deve usar uma invocação consolidada');
  assert.ok(!notificationUiKt.includes('remoteRepository.getDividendAgenda(') && !notificationViewModelKt.includes('remoteRepository.getDividendAgenda('), 'Central de Notificações não deve duplicar chamada de dividendos');
  assert.ok(!notificationUiKt.includes('remoteRepository.getNews(') && !notificationViewModelKt.includes('remoteRepository.getNews('), 'Central de Notificações não deve duplicar chamada de notícias');
  assert.equal((notificationWorkerKt.match(/ValoraeProxyClient\.getBackgroundAlerts\(/g) || []).length, 1, 'worker periódico deve usar uma invocação consolidada');
  assert.equal((dailyCloseWorkerKt.match(/ValoraeProxyClient\.getDailyClose\(/g) || []).length, 1, 'fechamento diário deve usar uma invocação consolidada');
  assert.equal((dailyCloseWorkerKt.match(/ValoraeProxyClient\.getBackgroundAlerts\(/g) || []).length, 0, 'fechamento diário não deve manter a chamada antiga de alertas');
}

console.log('apk-proxy-contract-harmony-v310 ok');
