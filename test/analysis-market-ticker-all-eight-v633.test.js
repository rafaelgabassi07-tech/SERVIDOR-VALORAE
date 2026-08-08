import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';

clearCache();
const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;

const yahooPrice = { 'BRL=X': 5.13, 'IVVB11.SA': 426.50 };
const indexById = { '1': ['IBOV', 173500], '22': ['IFIX', 3805], '8': ['IDIV', 12679], '6': ['SMLL', 2132] };
const monthDates = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 7 + i, 1));
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
});

global.fetch = async (url) => {
  const textUrl = String(url);
  if (textUrl.includes('query1.finance.yahoo.com') || textUrl.includes('query2.finance.yahoo.com')) {
    const symbol = decodeURIComponent(textUrl.match(/chart\/([^?]+)/)?.[1] || '');
    const price = yahooPrice[symbol];
    if (!price) {
      return new Response(JSON.stringify({ chart: { result: null, error: { description: 'forced quote miss' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const ts = [1786060800, 1786147200];
    const closes = [price * 0.995, price];
    return new Response(JSON.stringify({ chart: { result: [{ meta: { symbol, regularMarketPrice: price, chartPreviousClose: closes[0], previousClose: closes[0], currency: 'BRL' }, timestamp: ts, indicators: { quote: [{ close: closes, open: closes, high: closes, low: closes, volume: [1,1] }] } }], error: null } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const direct = textUrl.match(/investidor10\.com\.br\/api\/indices\/cotacoes\/(\d+)\/3650/);
  if (direct && indexById[direct[1]]) {
    const [, base] = indexById[direct[1]];
    return new Response(JSON.stringify([
      { last_update: '01/07/2026', points: base * 0.99 },
      { last_update: '01/08/2026', points: base }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('bcdata.sgs.12/dados')) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('bcdata.sgs.4391/dados')) {
    return new Response(JSON.stringify(monthDates.map((data, i) => ({ data, valor: i === 11 ? '1,05' : '1,00' }))), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('bcdata.sgs.433/dados')) {
    return new Response(JSON.stringify(monthDates.map((data, i) => ({ data, valor: i === 11 ? '0,16' : '0,35' }))), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('investidor10.com.br/indices/ipca/')) {
    return new Response('', { status: 404 });
  }
  if (textUrl.includes('sistemaswebb3-listados.b3.com.br')) {
    return new Response('', { status: 404 });
  }
  return new Response('', { status: 404 });
};

try {
  const { fetchIndicesSnapshot } = await import('../lib/market/indices.js');
  const result = await fetchIndicesSnapshot({ bypassCache: true, cache: false });
  const expected = ['USD','IFIX','IDIV','SMLL','CDI','IPCA','IBOV','IVVB11'];
  assert.deepEqual(result.tickerItems.map(item => item.code), expected);
  assert.equal(result.tickerItems.length, 8);
  for (const code of expected) {
    const item = result.tickerItems.find(row => row.code === code);
    assert.equal(item?.ok, true, `${code} deve ficar OK com sua cadeia real/contingência`);
    assert.ok(Number.isFinite(Number(item?.value)) && Number(item.value) > 0, `${code} deve ter valor numérico válido`);
  }
  assert.equal(result.status, 'OK');
  assert.equal(result.partial, false);
  console.log('Analysis market ticker all eight v633 test OK.');
} finally {
  clearCache();
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
