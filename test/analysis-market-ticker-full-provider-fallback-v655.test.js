import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';

clearCache();
const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;

const requests = [];
const b3Values = { IFIX: [3890, 3901.2], IDIV: [12950, 13005.5], SMLL: [2460, 2472.3], IBOV: [182000, 183250] };
function br(value) { return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function b3IndexHtml(code) {
  const [previous, current] = b3Values[code];
  const year = new Date().getUTCFullYear();
  return `<html><body><h1>${code} - ${year}</h1><table>
    <tr><th>Dia</th><th>Jun</th><th>Jul</th><th>Ago</th></tr>
    <tr><td>10</td><td></td><td>${br(previous)}</td><td></td></tr>
    <tr><td>11</td><td></td><td></td><td>${br(current)}</td></tr>
  </table></body></html>`;
}

const monthDates = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 8 + i, 1));
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
});

global.fetch = async (url) => {
  const u = String(url);
  requests.push(u);
  if (u.includes('query1.finance.yahoo.com') || u.includes('query2.finance.yahoo.com')) {
    return new Response(JSON.stringify({ chart: { result: null, error: { description: 'forced-yahoo-outage' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const b3Index = u.match(/daily-evolution\/(IBOV|IFIX|IDIV|SMLL)/);
  if (b3Index) return new Response(b3IndexHtml(b3Index[1]), { status: 200, headers: { 'Content-Type': 'text/html' } });
  if (u.includes('borainvestir.b3.com.br/cotacoes/etfs/IVVB11')) {
    return new Response(`<html><body><h1>IVVB11 ISHARES S&P 500</h1><section>Cotações <strong>426,09</strong> Valor atual (R$) <span>0,24%</span> Renta. dia</section></body></html>`, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
  if (u.includes('bcdata.sgs.1/dados/ultimos/3')) {
    return new Response(JSON.stringify([{ data: '10/08/2026', valor: '5,42' }, { data: '11/08/2026', valor: '5,44' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (u.includes('bcdata.sgs.12/dados')) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (u.includes('bcdata.sgs.4391/dados')) {
    return new Response(JSON.stringify(monthDates.map((data, i) => ({ data, valor: i === 11 ? '1,10' : '1,00' }))), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (u.includes('bcdata.sgs.433/dados')) {
    return new Response(JSON.stringify(monthDates.map((data, i) => ({ data, valor: i === 11 ? '0,35' : '0,30' }))), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (u.includes('investidor10.com.br')) throw new Error('terceira contingência não deve ser necessária neste cenário');
  return new Response('', { status: 404 });
};

try {
  const { fetchAnalysisTickerSnapshot } = await import('../lib/market/indices.js');
  const result = await fetchAnalysisTickerSnapshot({ bypassCache: true, cache: false });
  assert.equal(result.status, 'OK');
  assert.equal(result.partial, false);
  assert.deepEqual(result.tickerItems.map(row => row.code), ['USD','IFIX','IDIV','SMLL','CDI','IPCA','IBOV','IVVB11']);
  for (const row of result.tickerItems) {
    assert.equal(row.ok, true, `${row.code} deve permanecer operacional sem Yahoo`);
    assert.ok(Number(row.value ?? row.price) > 0, `${row.code} precisa ter valor real positivo`);
  }
  for (const code of ['USD','IFIX','IDIV','SMLL','IBOV','IVVB11']) {
    const row = result.tickerItems.find(item => item.code === code);
    assert.ok(Number.isFinite(Number(row?.variationPct)), `${code} precisa expor variação diária real quando a fonte de contingência possui fechamento anterior`);
  }
  assert.match(result.tickerItems.find(row => row.code === 'USD').source, /Banco Central.*SGS 1/i);
  assert.match(result.tickerItems.find(row => row.code === 'IVVB11').source, /B3 Oficial.*IVVB11/i);
  for (const code of ['IFIX','IDIV','SMLL','IBOV']) assert.match(result.tickerItems.find(row => row.code === code).source, /B3 Oficial/);
  assert.match(result.tickerItems.find(row => row.code === 'CDI').source, /BancoCentralSGS|Banco Central/i);
  assert.match(result.tickerItems.find(row => row.code === 'IPCA').source, /BCB SGS 433|Banco Central/i);
  assert.equal(requests.some(u => u.includes('investidor10.com.br')), true, 'contingência direta é consultada em paralelo para reduzir latência de falha');
  console.log('analysis-market-ticker-full-provider-fallback-v655: ok');
} finally {
  clearCache();
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
