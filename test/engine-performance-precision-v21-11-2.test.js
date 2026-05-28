import assert from 'node:assert/strict';
import { parseFinancialNumber, isPlausibleFinancialNumber } from '../lib/normalizers/numbers.js';
import { buildEngineProviderPlan } from '../lib/resilience/engine-policy.js';
import { buildNormalizedChartSeries } from '../lib/quality/chart-series.js';
import { ValoraeEngine, clearValoraeCaches } from '../lib/Valorae-engine.js';

const originalFetch = globalThis.fetch;

try {
  assert.equal(parseFinancialNumber('R$ 1.234,56'), 1234.56);
  assert.equal(parseFinancialNumber('US$ 1,234.56'), 1234.56);
  assert.equal(parseFinancialNumber('2,5 milhões'), 2500000);
  assert.equal(parseFinancialNumber('(12,30%)'), -12.3);
  assert.equal(isPlausibleFinancialNumber('0', { kind: 'price' }).ok, false);

  const plan = buildEngineProviderPlan({ optionProvider: 'auto', scrapeFirst: true, sourceHealth: { available: false, status: 'degraded', score: 30 }, directRetries: 2 });
  assert.equal(plan.stalePreferred, true);
  assert.equal(plan.directRetryBudget, 0);
  assert.deepEqual(plan.providers, ['valorae-scrape', 'direct']);

  const series = buildNormalizedChartSeries({ dividendos: [{ data: 'jan/2024', valor: '0,50' }, { data: 'fev/2024', valor: '0,60' }, { data: 'mar/2024', valor: '0,55' }] });
  assert.equal(series.count, 1);
  assert.equal(series.series[0].pointCount, 3);
  assert.equal(series.series[0].summary.last, 0.55);

  clearValoraeCaches('all');
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return {
      ok: false,
      status: 503,
      url: 'https://investidor10.com.br/acoes/petr4/',
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : '' },
      async text() { return '<html><body>maintenance</body></html>'; },
      async json() { return {}; },
    };
  };
  const url = 'https://investidor10.com.br/acoes/petr4/';
  const first = await ValoraeEngine.scrapeUrl(url, { provider: 'direct', cache: true, returnHtml: true, maxChars: 50000 });
  assert.equal(first.ok, false);
  assert.ok(fetchCount >= 1);
  const beforeSecond = fetchCount;
  const second = await ValoraeEngine.scrapeUrl(url, { provider: 'direct', cache: true, returnHtml: true, maxChars: 50000 });
  assert.equal(second.ok, false);
  assert.equal(second.cache, 'NEGATIVE_HIT');
  assert.equal(fetchCount, beforeSecond, 'failure cache curto deve evitar novo fetch imediato');

  console.log('engine-performance-precision-v21-11-2 OK');
} finally {
  globalThis.fetch = originalFetch;
  clearValoraeCaches('all');
}
