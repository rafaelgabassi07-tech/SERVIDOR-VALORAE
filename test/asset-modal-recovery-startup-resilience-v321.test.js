import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test as runtime } from '../lib/analysis/asset-modal-runtime.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const stockCritical = [
  'historicalIndicators',
  'revenueProfitChart',
  'profitQuoteChart',
  'equityEvolutionChart',
  'indexComparison',
  'announcements'
];
const fiiCritical = ['historicalIndicators', 'patrimonialInfo', 'indexComparison', 'announcements'];

assert.deepEqual(
  runtime.requestedCriticalSections({
    requiredSections: 'profitQuoteChart',
    missingSections: 'peerComparison,company,financialStatements',
    deferredSections: 'returns'
  }, 'stock'),
  stockCritical,
  'a consulta não pode enfraquecer o contrato nem transformar seção opcional em obrigatória'
);
assert.deepEqual(
  runtime.requestedCriticalSections({
    requiredSections: 'indexComparison',
    missingSections: 'aboutFund,propertyPortfolio,returns'
  }, 'fii'),
  fiiCritical
);

const completeStock = {
  ok: true,
  status: 'OK',
  stage: 'full',
  mode: 'full',
  quoteSummary: { price: 25, priceDisplay: 'R$ 25,00' },
  chart: { points: [{ close: 24 }, { close: 25 }] },
  metrics: [{ value: 'R$ 25,00' }],
  fundamentalIndicators: { items: [{ value: '8,0' }] },
  historicalIndicators: { rows: [{ label: 'P/L' }] },
  revenueProfitChart: { points: [{ year: 2025, netIncome: 10 }] },
  profitQuoteChart: { points: [{ year: 2025, quote: 25, netIncome: 10 }] },
  equityEvolutionChart: { points: [{ year: 2025, netWorth: 100 }] },
  checklist: { items: [{ passed: true }] },
  returns: { rows: [{ label: '12M' }] },
  dividends: { events: [{ value: 1 }] },
  peerComparison: { rows: [{ ticker: 'PAIR3' }] },
  indexComparison: { items: [{ code: 'IBOV' }] },
  companyProfile: { facts: [{ value: 'Setor' }] },
  companyData: { facts: [{ value: 'Brasil' }] },
  companyInformation: { facts: [{ value: 'Listada' }] },
  revenueByRegion: { items: [{ label: 'Brasil', value: 100 }] },
  shareholdingPosition: { rows: [{ shareholder: 'Mercado' }] },
  resultsStatement: { rows: [{ label: 'Receita' }] },
  balanceSheetStatement: { rows: [{ label: 'Patrimônio' }] },
  announcements: { items: [{ title: 'Comunicado' }] }
};
const delivery = runtime.buildModalDelivery(completeStock, {
  family: 'stock',
  requestedMode: 'full',
  mode: 'full',
  requestPayload: {
    requiredSections: 'profitQuoteChart',
    missingSections: 'company,financialStatements',
    deferredSections: 'returns'
  },
  requestId: 'cp353-contract'
});
assert.deepEqual(delivery.requiredSections, stockCritical);
assert.deepEqual(delivery.missingRequiredSections, []);
assert.equal(delivery.completeForDelivery, true);
assert.equal(delivery.isFinal, true);
assert.equal(delivery.retryable, false);

const incomplete = structuredClone(completeStock);
incomplete.profitQuoteChart = { points: [] };
const incompleteDelivery = runtime.buildModalDelivery(incomplete, {
  family: 'stock', requestedMode: 'full', mode: 'full',
  requestPayload: { requiredSections: 'historicalIndicators' }
});
assert.deepEqual(incompleteDelivery.requiredSections, stockCritical);
assert.deepEqual(incompleteDelivery.missingRequiredSections, ['profitQuoteChart']);
assert.equal(incompleteDelivery.isFinal, false);

const runtimeSource = fs.readFileSync(new URL('../lib/analysis/asset-modal-runtime.js', import.meta.url), 'utf8');
assert.match(runtimeSource, /mandatory delivery contract is immutable per family/);
assert.doesNotMatch(runtimeSource, /\.\.\.parseSectionList\(payload\.missingSections\)/);

const classifier = readSiblingApkFile('app/src/main/java/com/example/domain/MarketAssetClassifier.kt');
const service = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeUniversalAssetModalService.kt');
const modalRuntime = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalRuntime.kt');
const returnsUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalAnnouncementsReturnsInfoUi.kt');
const settings = readSiblingApkFile('app/src/main/java/com/example/ui/state/AppSettings.kt');
const fallback = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalFallbackPolicy.kt');
if (classifier && service && modalRuntime && returnsUi && settings && fallback) {
  assert.match(classifier, /fun inferAssetModalFamily/);
  assert.match(classifier, /fun canonicalAssetModalType/);
  assert.match(service, /inferAssetModalFamily\(cleanSymbol, assetType\)/);
  assert.match(service, /canonicalAssetModalType\(cleanSymbol, assetType\)/);
  assert.match(modalRuntime, /when \(inferAssetModalFamily\(normalizedTicker, assetType\)\)/);
  assert.match(returnsUi, /Rentabilidade da ação ainda não está disponível para esta empresa/);
  assert.match(returnsUi, /Rentabilidade do FII ainda não está disponível para este fundo/);
  assert.doesNotMatch(settings, /runBlocking/);
  assert.match(settings, /resolved\.state\.collectLatest/);
  assert.match(fallback, /"indexComparison" to "comparação com índices"/);
  assert.match(fallback, /"announcements" to "comunicados oficiais"/);
}

console.log('asset-modal-recovery-startup-resilience-v321 ok');
