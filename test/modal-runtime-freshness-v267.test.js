import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { clearCache } from '../lib/core/cache.js';
import { ASSET_MODAL_RUNTIME_VERSION, withAssetModalRuntime, _test } from '../lib/analysis/asset-modal-runtime.js';

clearCache();
assert.equal(ASSET_MODAL_RUNTIME_VERSION, '27.asset-modal.runtime.v18-source-arrival-integrity');
assert.notEqual(
  _test.modalCacheKey({ family: 'stock', ticker: 'PETR4', payload: { surface: 'modal' } }),
  _test.modalCacheKey({ family: 'fii', ticker: 'PETR4', payload: { surface: 'modal' } }),
  'famílias de Ação/FII precisam ter cache separado'
);
assert.equal(_test.isModalPayloadCacheable({ ok: false, status: 'ERROR' }), false);
assert.equal(_test.isModalPayloadCacheable({ ok: true, status: 'EMPTY' }), false);
assert.equal(_test.isModalPayloadCacheable({ ok: true, status: 'NOT_STOCK' }), true);

let calls = 0;
const first = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'V267A',
  payload: { surface: 'runtime-test' },
  ttlMs: 1000,
  staleMs: 1000,
  producer: async () => ({ ok: true, status: 'OK', ticker: 'V267A', value: ++calls, updatedAt: '2026-07-06T00:00:00.000Z', quoteSummary: { price: 10.5, priceDisplay: 'R$ 10,50' }, chart: { points: [{ close: 10.1 }, { close: 10.5 }] }, metrics: [{ id: 'price', value: 'R$ 10,50' }], fundamentalIndicators: { items: [{ id: 'pl', value: '8,0' }] }, historicalIndicators: { rows: [{ label: 'P/L', values: { Atual: '8,0', 2025: '9,0' } }], tablesByPeriod: {} }, companyProfile: { facts: [{ id: 'segment', value: 'Teste' }], sections: [] }, checklist: { items: [{ id: 'dy', passed: true, status: 'PASSED' }] }, revenueByRegion: { items: [{ label: 'Brasil', value: 100 }] }, returns: { rows: [{ label: '12M', value: '9%' }] }, dividendHistory: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} }, revenueProfitChart: { points: [{ period: '2025', primaryValue: 100 }] }, profitQuoteChart: { points: [{ period: '2025', primaryValue: 100, secondaryValue: 10.5 }] }, equityEvolutionChart: { points: [{ period: '2025', primaryValue: 100 }] }, financialStatements: { rows: [] }, resultsStatement: { rows: [{ label: 'Receita', value: '100' }], tablesByPeriod: {} }, balanceSheetStatement: { rows: [], tablesByPeriod: {} }, indexComparison: { items: [{ code: 'IBOV', returnPercent: 2 }], series: [{ code: 'PETR4', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 1 }] }, { code: 'IBOV', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 2 }] }], seriesByPeriod: {} }, announcements: { items: [{ id: 'notice', title: 'Comunicado' }] } })
});
assert.equal(first.value, 1);
assert.equal(first.diagnostics.modalRuntime.cacheStatus, 'MISS');
assert.equal(first.diagnostics.modalRuntime.version, '27.asset-modal.runtime.v18-source-arrival-integrity');
assert.equal(first.diagnostics.modalRuntime.mode, 'full');
assert.equal('key' in first.diagnostics.modalRuntime, false, 'diagnóstico público não deve expor chave interna de cache');

const second = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'V267A',
  payload: { surface: 'runtime-test' },
  producer: async () => ({ ok: true, status: 'OK', ticker: 'V267A', value: ++calls, quoteSummary: { price: 10.5, priceDisplay: 'R$ 10,50' }, chart: { points: [{ close: 10.1 }, { close: 10.5 }] }, metrics: [{ id: 'price', value: 'R$ 10,50' }], fundamentalIndicators: { items: [{ id: 'pl', value: '8,0' }] }, historicalIndicators: { rows: [{ label: 'P/L', values: { Atual: '8,0', 2025: '9,0' } }], tablesByPeriod: {} }, companyProfile: { facts: [{ id: 'segment', value: 'Teste' }], sections: [] }, checklist: { items: [{ id: 'dy', passed: true, status: 'PASSED' }] }, revenueByRegion: { items: [{ label: 'Brasil', value: 100 }] }, returns: { rows: [{ label: '12M', value: '9%' }] }, dividendHistory: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} }, revenueProfitChart: { points: [{ period: '2025', primaryValue: 100 }] }, profitQuoteChart: { points: [{ period: '2025', primaryValue: 100, secondaryValue: 10.5 }] }, equityEvolutionChart: { points: [{ period: '2025', primaryValue: 100 }] }, financialStatements: { rows: [] }, resultsStatement: { rows: [{ label: 'Receita', value: '100' }], tablesByPeriod: {} }, balanceSheetStatement: { rows: [], tablesByPeriod: {} }, indexComparison: { items: [{ code: 'IBOV', returnPercent: 2 }], series: [{ code: 'PETR4', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 1 }] }, { code: 'IBOV', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 2 }] }], seriesByPeriod: {} }, announcements: { items: [{ id: 'notice', title: 'Comunicado' }] } })
});
assert.equal(second.value, 1);
assert.equal(second.diagnostics.modalRuntime.cacheStatus, 'HIT');
assert.equal(calls, 1, 'HIT fresco não deve recomputar produtor');

const bypass = await withAssetModalRuntime({
  family: 'stock',
  ticker: 'V267A',
  payload: { surface: 'runtime-test', refresh: 'true' },
  producer: async () => ({ ok: true, status: 'OK', ticker: 'V267A', value: ++calls, quoteSummary: { price: 10.5, priceDisplay: 'R$ 10,50' }, chart: { points: [{ close: 10.1 }, { close: 10.5 }] }, metrics: [{ id: 'price', value: 'R$ 10,50' }], fundamentalIndicators: { items: [{ id: 'pl', value: '8,0' }] }, historicalIndicators: { rows: [{ label: 'P/L', values: { Atual: '8,0', 2025: '9,0' } }], tablesByPeriod: {} }, companyProfile: { facts: [{ id: 'segment', value: 'Teste' }], sections: [] }, checklist: { items: [{ id: 'dy', passed: true, status: 'PASSED' }] }, revenueByRegion: { items: [{ label: 'Brasil', value: 100 }] }, returns: { rows: [{ label: '12M', value: '9%' }] }, dividendHistory: { events: [{ date: '2026-06-01', value: 1 }], yieldSeriesByFrequency: {}, dividendSeriesByFrequency: {} }, revenueProfitChart: { points: [{ period: '2025', primaryValue: 100 }] }, profitQuoteChart: { points: [{ period: '2025', primaryValue: 100, secondaryValue: 10.5 }] }, equityEvolutionChart: { points: [{ period: '2025', primaryValue: 100 }] }, financialStatements: { rows: [] }, resultsStatement: { rows: [{ label: 'Receita', value: '100' }], tablesByPeriod: {} }, balanceSheetStatement: { rows: [], tablesByPeriod: {} }, indexComparison: { items: [{ code: 'IBOV', returnPercent: 2 }], series: [{ code: 'PETR4', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 1 }] }, { code: 'IBOV', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 2 }] }], seriesByPeriod: {} }, announcements: { items: [{ id: 'notice', title: 'Comunicado' }] } })
});
assert.equal(bypass.value, 2);
assert.equal(bypass.diagnostics.modalRuntime.cacheStatus, 'BYPASS');

clearCache();
let staleCalls = 0;
await withAssetModalRuntime({
  family: 'fii',
  ticker: 'V267B',
  payload: { surface: 'runtime-stale-test' },
  ttlMs: 1,
  staleMs: 1000,
  producer: async () => ({ ok: true, status: 'OK', ticker: 'V267B', value: ++staleCalls, updatedAt: '2026-07-06T00:00:01.000Z', quoteSummary: { price: 99.9, priceDisplay: 'R$ 99,90' }, chart: { points: [{ close: 99.1 }, { close: 99.9 }] }, metrics: [{ id: 'price', value: 'R$ 99,90' }], aboutFund: { summary: 'Fundo teste', sections: [{ title: 'Sobre', paragraphs: ['Teste'] }], highlights: [] }, distributions12m: { items: [{ month: '2026-06', value: 1 }], months: [] }, patrimonialInfo: { metrics: [{ id: 'vp', value: 'R$ 100,00' }], bars: [] }, returns: { rows: [{ label: '12M', value: '8%' }] }, comparison: { items: [{ id: 'ifix', value: '7%' }], series: [{ code: 'V267B', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 1 }] }, { code: 'IFIX', points: [{ timestamp: 1, value: 0 }, { timestamp: 2, value: 0.7 }] }], seriesByPeriod: {} }, peerComparison: { rows: [{ ticker: 'HGLG11', value: '8%' }] }, historicalIndicators: { rows: [{ label: 'P/VP', values: { Atual: '0,95', 2025: '0,92' } }], tablesByPeriod: {} }, infoSections: [{ id: 'gestao', items: [{ label: 'Gestão', value: 'Ativa' }] }], announcements: { items: [{ id: 'notice', title: 'Comunicado do fundo' }] } })
});
await sleep(5);
const staleFallback = await withAssetModalRuntime({
  family: 'fii',
  ticker: 'V267B',
  payload: { surface: 'runtime-stale-test' },
  ttlMs: 1,
  staleMs: 1000,
  producer: async () => {
    staleCalls += 1;
    throw new Error('fonte indisponível no teste');
  }
});
assert.equal(staleFallback.value, 1);
assert.equal(staleFallback.diagnostics.modalRuntime.cacheStatus, 'STALE_FALLBACK');
assert.match(staleFallback.diagnostics.modalRuntime.fallbackReason, /fonte indisponível/);
assert.equal(staleCalls, 2, 'runtime deve tentar renovar antes de usar stale como fallback');

console.log('modal-runtime-freshness-v267 ok');
