import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clearCache } from '../lib/core/cache.js';
import { inspectRealHistoryIntegrity } from '../lib/sources/history-integrity.js';

assert.equal(inspectRealHistoryIntegrity({ source: 'Yahoo Finance', points: [{ date: '2025-01-01', close: 100 }, { date: '2025-02-01', close: 101 }] }).trusted, true);
for (const payload of [
  { simulated: true, points: [] },
  { synthetic: true, points: [] },
  { proxyTickerUsed: true, points: [] },
  { source: 'Yahoo Finance - último snapshot conhecido', points: [] },
  { points: [{ date: '2025-01-01', close: 100, reconstructedFromYahooSnapshot: true }] }
]) {
  assert.equal(inspectRealHistoryIntegrity(payload).trusted, false, 'gate deve rejeitar série não histórica ou substituída');
}

const quotesSource = fs.readFileSync(new URL('../lib/sources/quotes.js', import.meta.url), 'utf8');
assert.equal(quotesSource.includes('LAST_KNOWN_DIRECT_INDEX_QUOTES'), false, 'cotação de índice não pode usar tabela estática');
assert.equal(quotesSource.includes('directIndexFallbackQuote'), false, 'fallback estático deve estar removido');
const historySource = fs.readFileSync(new URL('../lib/sources/asset-details.js', import.meta.url), 'utf8');
assert.equal(historySource.includes('yahooSnapshotComparisonPoints'), false, 'snapshot não pode ser convertido em curva histórica');
assert.equal(historySource.includes('reconstructedFromYahooSnapshot'), false, 'marcador de curva artificial deve desaparecer do produtor');

clearCache();
const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;
global.fetch = async url => {
  const textUrl = String(url);
  if (!textUrl.includes('finance.yahoo.com')) return new Response('', { status: 404 });
  const symbol = decodeURIComponent(textUrl.match(/chart\/([^?]+)/)?.[1] || 'IFIX.SA');
  return new Response(JSON.stringify({
    chart: { result: [{ meta: { symbol, regularMarketPrice: 3800, previousClose: 3790, chartPreviousClose: 3790, regularMarketTime: 1781280000 }, timestamp: [], indicators: { quote: [{ close: [] }] } }], error: null }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
try {
  const { getAssetHistory } = await import('../lib/sources/asset-details.js');
  const result = await getAssetHistory({ ticker: 'IFIX', range: '1Y', timeoutMs: 800 });
  assert.equal(result.status, 'SNAPSHOT_ONLY');
  assert.equal((result.points || []).length, 1, 'apenas o snapshot real pode ser preservado');
  assert.equal(result.points?.some(point => point.reconstructedFromYahooSnapshot), false);
} finally {
  global.fetch = originalFetch;
  clearCache();
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
console.log('real-index-integrity-v325 ok');
