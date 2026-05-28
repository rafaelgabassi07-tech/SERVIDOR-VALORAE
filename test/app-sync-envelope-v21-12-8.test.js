import assert from 'node:assert/strict';
import { buildAppSyncEnvelope } from '../lib/quality/app-sync-envelope.js';

const basePayload = {
  ticker: 'GARE11',
  type: 'FII',
  status: 'OK',
  partial: false,
  cacheStatus: 'LIVE_HTML',
  metrics: { generatedAt: '2026-05-28T12:00:00.000Z' },
  appPayload: {
    quote: { ticker: 'GARE11', price: 10.2, priceDisplay: 'R$ 10,20' },
    metrics: { canonical: { precoAtual: { value: 10.2, display: 'R$ 10,20' }, dividendYield: { value: 0.11, display: '11%' } } },
    charts: { series: [{ key: 'preco', pointCount: 3, points: [{ x: 1, y: 10 }, { x: 2, y: 11 }, { x: 3, y: 12 }] }] },
    dividends: { historyCount: 2, history: [{ data: '2026-01', valor: 0.1 }] },
    source: { primary: 'Investidor10', sourcesUsed: ['Investidor10', 'YahooChart'] },
  },
  appRenderContract: {
    renderState: 'ready',
    metricGroups: { quote: { count: 1 }, dividends: { count: 1 } },
  },
  appDataContract: {
    score: 88,
    renderSafe: true,
    canReplacePreviousSnapshot: true,
    freshness: { isStale: false, badge: 'live', cacheStatus: 'LIVE_HTML' },
    issues: [],
  },
};

const envelope = buildAppSyncEnvelope(basePayload);
assert.equal(envelope.version, '21.12.8-app-sync-envelope');
assert.equal(envelope.syncKey, 'GARE11:FII:asset');
assert.equal(envelope.decision.action, 'replace_snapshot');
assert.equal(envelope.decision.canReplacePreviousSnapshot, true);
assert.equal(envelope.firstPaint.ready, true);
assert.ok(envelope.firstPaint.paths.find(p => p.key === 'quote' && p.usedPath === 'appPayload.quote'));
assert.match(envelope.identity.payloadHash, /^[a-f0-9]{24}$/);

const sameWithDifferentTiming = buildAppSyncEnvelope({
  ...basePayload,
  metrics: { generatedAt: '2026-05-28T13:33:00.000Z', totalTimeMs: 999 },
});
assert.equal(sameWithDifferentTiming.identity.payloadHash, envelope.identity.payloadHash, 'hash não deve mudar só por generatedAt/timing');

const partial = buildAppSyncEnvelope({
  ticker: 'PETR4',
  type: 'ACAO',
  status: 'PARTIAL',
  partial: true,
  cacheStatus: 'STALE_CACHE',
  appPayload: { metrics: { canonical: {} }, charts: { series: [] } },
  appDataContract: { score: 42, renderSafe: false, canReplacePreviousSnapshot: false, freshness: { isStale: true } },
});
assert.equal(partial.decision.canReplacePreviousSnapshot, false);
assert.equal(partial.decision.shouldKeepPreviousSnapshot, true);
assert.ok(['keep_previous_show_stale_badge', 'keep_previous_show_empty_state', 'render_partial_keep_previous'].includes(partial.decision.action));
assert.equal(partial.firstPaint.ready, false);
assert.ok(partial.hydration.missingFirstPaintKeys.includes('quote'));

console.log('app-sync-envelope-v21-12-8 ok');
