import assert from 'node:assert/strict';
import { ValoraeEngine, clearValoraeCaches } from '../lib/Valorae-engine.js';
import { buildHtmlCacheFamilyKey, buildHtmlCacheKey } from '../lib/scrape/scrape-input.js';
import { buildChartReadinessReport } from '../lib/quality/chart-readiness.js';
import { recordProviderResult, getProviderHealthSnapshot, resetProviderHealth } from '../lib/resilience/circuit-breaker.js';

const originalFetch = globalThis.fetch;

try {
  clearValoraeCaches('all');
  let fetchCount = 0;
  const html = `<html><head><title>PETR4</title></head><body>${'<p>Dividend Yield 10,5% Cotação R$ 32,50</p>'.repeat(3000)}</body></html>`;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      status: 200,
      url: 'https://investidor10.com.br/acoes/petr4/',
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : '' },
      async text() { return html; },
      async json() { return {}; },
    };
  };

  const url = 'https://investidor10.com.br/acoes/petr4/#fragmento';
  const familyA = buildHtmlCacheFamilyKey(url, { provider: 'direct', maxChars: 60000, returnHtml: true });
  const familyB = buildHtmlCacheFamilyKey('https://investidor10.com.br/acoes/petr4/', { provider: 'direct', maxChars: 10000, returnHtml: true });
  const keyA = buildHtmlCacheKey(url, { provider: 'direct', maxChars: 60000, returnHtml: true });
  const keyB = buildHtmlCacheKey(url, { provider: 'direct', maxChars: 10000, returnHtml: true });
  assert.equal(familyA, familyB, 'family key deve ignorar fragmento e maxChars');
  assert.notEqual(keyA, keyB, 'cache key exata deve diferenciar maxChars');

  const first = await ValoraeEngine.scrapeUrl(url, { provider: 'direct', maxChars: 60000, cache: true, returnHtml: true });
  assert.equal(first.ok, true);
  assert.equal(fetchCount, 1);
  const second = await ValoraeEngine.scrapeUrl(url, { provider: 'direct', maxChars: 10000, cache: true, returnHtml: true });
  assert.equal(second.ok, true);
  assert.equal(fetchCount, 1, 'pedido menor deve reaproveitar HTML maior via família de cache');
  assert.equal(second.htmlCacheFamilyHit, true);
  assert.equal(second.html.length, 10000);

  const chart = buildChartReadinessReport({ historicoDividendos: [{ dataCom: '01/01/2024', valor: '0,50' }, { dataCom: '01/02/2024', valor: '0,55' }, { dataCom: '01/03/2024', valor: '0,60' }] });
  assert.equal(chart.ready, true);
  assert.ok(chart.score >= 50);
  assert.ok(chart.topSeries[0].points >= 3);

  resetProviderHealth('Investidor10');
  for (let i = 0; i < 4; i += 1) recordProviderResult('Investidor10', false, { status: 429, errorType: 'HTTP_429', retryable: true, latencyMs: 1200 });
  const health = getProviderHealthSnapshot().Investidor10;
  assert.equal(health.status, 'degraded');
  assert.ok(health.score < 80);
  assert.ok(health.retryAfterMs >= 0);

  console.log('engine-core-modules-v21-11-1 OK');
} finally {
  globalThis.fetch = originalFetch;
  clearValoraeCaches('all');
  resetProviderHealth();
}
