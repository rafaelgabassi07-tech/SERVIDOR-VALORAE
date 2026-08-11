import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';
import { APK_COMPATIBILITY, evaluateApkCompatibility } from '../lib/core/apk-compatibility.js';

clearCache();
assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.11.01');
assert.equal(APK_COMPATIBILITY.maxTestedVersion, '2026.08.11.01');
assert.equal(evaluateApkCompatibility('2026.08.11.01').status, 'PAIRED');
assert.equal(evaluateApkCompatibility('2026.08.11.02', { allowFuture: false }).reject, true);
const requests = [];
const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;

const indexById = {
  '1': ['IBOV', 174120],
  '22': ['IFIX', 3812],
  '8': ['IDIV', 12682],
  '6': ['SMLL', 2141],
};
const yahooPrice = { 'BRL=X': 5.14, 'IVVB11.SA': 427.8 };
const monthDates = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 8 + i, 1));
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
});

global.fetch = async (url) => {
  const textUrl = String(url);
  requests.push(textUrl);
  if (textUrl.includes('query1.finance.yahoo.com') || textUrl.includes('query2.finance.yahoo.com')) {
    const symbol = decodeURIComponent(textUrl.match(/chart\/([^?]+)/)?.[1] || '');
    const price = yahooPrice[symbol];
    if (!price) {
      return new Response(JSON.stringify({ chart: { result: null, error: { description: 'comparison source should recover index' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const previous = price * 0.997;
    return new Response(JSON.stringify({ chart: { result: [{ meta: { symbol, regularMarketPrice: price, chartPreviousClose: previous, previousClose: previous, currency: 'BRL' }, timestamp: [1786060800, 1786147200], indicators: { quote: [{ close: [previous, price], open: [previous, price], high: [previous, price], low: [previous, price], volume: [1,1] }] } }], error: null } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const direct = textUrl.match(/investidor10\.com\.br\/api\/indices\/cotacoes\/(\d+)\/3650/);
  if (direct && indexById[direct[1]]) {
    const [, value] = indexById[direct[1]];
    return new Response(JSON.stringify([
      { last_update: '01/07/2026', points: value * 0.995 },
      { last_update: '01/08/2026', points: value },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('bcdata.sgs.4391/dados')) {
    return new Response(JSON.stringify(monthDates.map((data, i) => ({ data, valor: i === 11 ? '1,05' : '1,00' }))), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('bcdata.sgs.433/dados')) {
    return new Response(JSON.stringify(monthDates.map((data, i) => ({ data, valor: i === 11 ? '0,20' : '0,35' }))), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('bcdata.sgs.12/dados')) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  return new Response('', { status: 404 });
};

try {
  const { fetchAnalysisTickerSnapshot, VALORAE_ANALYSIS_TICKER_SYMBOLS } = await import('../lib/market/indices.js');
  assert.deepEqual(Object.keys(VALORAE_ANALYSIS_TICKER_SYMBOLS), ['USD','IFIX','IDIV','SMLL','IBOV','IVVB11']);
  const result = await fetchAnalysisTickerSnapshot({ bypassCache: true, cache: false });
  const expected = ['USD','IFIX','IDIV','SMLL','CDI','IPCA','IBOV','IVVB11'];
  assert.deepEqual(result.tickerItems.map(item => item.code), expected);
  assert.equal(result.tickerItems.length, 8);
  for (const code of expected) {
    const item = result.tickerItems.find(row => row.code === code);
    assert.equal(item?.ok, true, `${code} deve estar utilizável`);
    assert.ok(Number.isFinite(Number(item?.value)), `${code} deve ter valor numérico`);
  }
  assert.equal(result.partial, false);
  assert.equal(requests.some(url => /BOVA11|SMAL11|DIVO11/.test(url)), false, 'ticker da Análise não deve aguardar ETFs que não são exibidos');
  for (const id of ['1','22','8','6']) {
    assert.equal(requests.some(url => url.includes(`/api/indices/cotacoes/${id}/3650`)), true, `fonte direta do comparador ${id} deve ser consultada`);
  }
  console.log('analysis-market-ticker-v646: ok');
} finally {
  clearCache();
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
