import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';

clearCache();
const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;

const requests = [];
const monthDates = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 8 + i, 1));
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
});
const b3Values = { IFIX: [3890.00, 3901.20], IDIV: [12950.00, 13005.50], SMLL: [2460.00, 2472.30], IBOV: [182000.00, 183250.00] };

function b3Html(code) {
  const [previous, current] = b3Values[code];
  const monthLabels = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const now = new Date();
  const month = now.getUTCMonth();
  const currentDay = now.getUTCDate();
  const previousDay = currentDay > 1 ? currentDay - 1 : 1;
  const effectiveCurrentDay = currentDay > 1 ? currentDay : 2;
  const row = (day, value) => {
    const cells = monthLabels.map((_, index) => index === month ? String(value).replace('.', ',') : '');
    return `<tr><td>${day}</td>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
  };
  return `<table>
    <tr><th>Dia</th>${monthLabels.map(label => `<th>${label}</th>`).join('')}</tr>
    ${row(previousDay, previous)}
    ${row(effectiveCurrentDay, current)}
  </table>`;
}

global.fetch = async (url) => {
  const textUrl = String(url);
  requests.push(textUrl);
  if (textUrl.includes('query1.finance.yahoo.com') || textUrl.includes('query2.finance.yahoo.com')) {
    const symbol = decodeURIComponent(textUrl.match(/chart\/([^?]+)/)?.[1] || '');
    const prices = { 'BRL=X': 5.41, 'IVVB11.SA': 452.60 };
    const price = prices[symbol];
    if (!price) {
      return new Response(JSON.stringify({ chart: { result: null, error: { description: 'forced direct-index miss' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const previous = price * 0.998;
    return new Response(JSON.stringify({ chart: { result: [{ meta: { symbol, regularMarketPrice: price, chartPreviousClose: previous, previousClose: previous, currency: 'BRL' }, timestamp: [1786320000,1786406400], indicators: { quote: [{ close: [previous,price], open:[previous,price], high:[previous,price], low:[previous,price], volume:[1,1] }] } }], error: null } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const b3 = textUrl.match(/daily-evolution\/(IBOV|IFIX|IDIV|SMLL)/);
  if (b3) return new Response(b3Html(b3[1]), { status: 200, headers: { 'Content-Type': 'text/html' } });

  if (textUrl.includes('bcdata.sgs.12/dados')) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('bcdata.sgs.4391/dados')) {
    return new Response(JSON.stringify(monthDates.map((data, i) => ({ data, valor: i === 11 ? '1,10' : '1,00' }))), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('bcdata.sgs.433/dados')) {
    return new Response(JSON.stringify(monthDates.map((data, i) => ({ data, valor: i === 11 ? '0,35' : '0,30' }))), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('investidor10.com.br')) {
    throw new Error('Investidor10 não deve ser necessário quando B3 oficial responde');
  }
  return new Response('', { status: 404 });
};

try {
  const { fetchAnalysisTickerSnapshot } = await import('../lib/market/indices.js');
  const result = await fetchAnalysisTickerSnapshot({ bypassCache: true, cache: false });
  const expected = ['USD','IFIX','IDIV','SMLL','CDI','IPCA','IBOV','IVVB11'];
  assert.deepEqual(result.tickerItems.map(item => item.code), expected);
  assert.equal(result.partial, false);
  for (const code of ['IFIX','IDIV','SMLL','IBOV']) {
    const item = result.tickerItems.find(row => row.code === code);
    assert.equal(item?.ok, true, `${code} precisa ficar OK pela B3`);
    assert.match(item?.source || '', /B3 Oficial/);
    assert.equal(item?.official, true);
  }
  assert.equal(requests.some(url => url.includes('investidor10.com.br')), true, 'contingência direta é aquecida em paralelo; B3 continua preferida na mesma data');
  assert.equal(requests.filter(url => url.includes('sistemaswebb3-listados.b3.com.br')).length >= 4, true);
  console.log('analysis-market-ticker-official-b3-v655: ok');
} finally {
  clearCache();
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
