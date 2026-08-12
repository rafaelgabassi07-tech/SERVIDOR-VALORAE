import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';

function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function brDate(iso) {
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

clearCache();
const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;

const today = isoDay(0);
const yesterday = isoDay(-1);
const twoDaysAgo = isoDay(-2);
const staleA = isoDay(-35);
const staleB = isoDay(-34);
const requests = [];

const i10ById = {
  '22': [
    { last_update: brDate(twoDaysAgo), points: '3.512,40' },
    { last_update: brDate(today), points: '3.527,85' },
  ],
  '8': [
    { last_update: brDate(twoDaysAgo), points: '10.944,20' },
    { last_update: brDate(today), points: '11.018,60' },
  ],
  '1': [
    { last_update: brDate(twoDaysAgo), points: '136.000,00' },
    { last_update: brDate(today), points: '137.000,00' },
  ],
  '6': [
    { last_update: brDate(twoDaysAgo), points: '2.100,00' },
    { last_update: brDate(today), points: '2.120,00' },
  ],
};

function staleB3Payload(code) {
  const base = code === 'IFIX' ? 3400 : code === 'IDIV' ? 10500 : code === 'IBOV' ? 132000 : 2000;
  return JSON.stringify([
    { date: staleA, value: base },
    { date: staleB, value: base + 10 },
  ]);
}

global.fetch = async (url) => {
  const u = String(url);
  requests.push(u);
  if (u.includes('query1.finance.yahoo.com') || u.includes('query2.finance.yahoo.com')) {
    return new Response(JSON.stringify({ chart: { result: null, error: { description: 'forced-yahoo-miss' } } }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
  const b3 = u.match(/daily-evolution\/(IBOV|IFIX|IDIV|SMLL)/);
  if (b3) return new Response(staleB3Payload(b3[1]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const i10 = u.match(/api\/indices\/cotacoes\/(1|6|8|22)\/3650/);
  if (i10) return new Response(JSON.stringify(i10ById[i10[1]]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('bcdata.sgs.')) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  return new Response('', { status: 404 });
};

try {
  const { fetchIndicesSnapshot } = await import('../lib/market/indices.js');
  const result = await fetchIndicesSnapshot({
    symbols: { IFIX: 'IFIX.SA', IDIV: 'IDIV.SA' },
    bypassCache: true,
    cache: false,
  });
  for (const code of ['IFIX', 'IDIV']) {
    const row = result.indices.find(item => item.code === code);
    assert.equal(row?.ok, true, `${code} precisa ficar operacional mesmo com Yahoo fora e B3 stale`);
    assert.match(row?.source || '', /Investidor10 API de cotações do índice/);
    assert.equal(String(row?.time).slice(0,10), today, `${code} deve escolher o pregão mais recente`);
    assert.ok(Number(row?.price) > 0);
  }
  assert.ok(requests.some(u => u.includes('/cotacoes/22/3650')), 'IFIX deve consultar fallback direto independente');
  assert.ok(requests.some(u => u.includes('/cotacoes/8/3650')), 'IDIV deve consultar fallback direto independente');
  console.log('analysis-market-ticker-ifix-idiv-v656: ok');
} finally {
  clearCache();
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
