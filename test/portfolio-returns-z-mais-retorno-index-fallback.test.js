import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';

clearCache();

const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;
const requests = [];

const monthlyHtml = (code) => `<!doctype html><html><body>
  <h2>Rentabilidade histórica</h2>
  <p>${code} - índice</p>
  <table>
    <tr><th>ANO</th><th>Jan</th><th>Fev</th><th>Mar</th><th>Abr</th><th>Mai</th><th>Jun</th><th>Jul</th><th>Ago</th><th>Set</th><th>Out</th><th>Nov</th><th>Dez</th><th>No ano</th><th>Acumulado</th></tr>
    <tr><td>2026</td><td>${code} p.p. acima IBOV</td><td>1,00%</td><td>-</td><td>2,00%</td><td>-</td><td>-1,00%</td><td>-</td><td>0,50%</td><td>-</td><td>0,30%</td><td>-</td><td>0,20%</td><td>-</td><td>--</td><td>--</td><td>--</td><td>--</td><td>--</td><td>--</td><td>3,01%</td><td>-</td><td>150,00%</td><td>-</td></tr>
    <tr><td>2025</td><td>${code} p.p. acima IBOV</td><td>1,00%</td><td>-</td><td>1,00%</td><td>-</td><td>1,00%</td><td>-</td><td>1,00%</td><td>-</td><td>1,00%</td><td>-</td><td>1,00%</td><td>-</td><td>1,00%</td><td>-</td><td>1,00%</td><td>-</td><td>1,00%</td><td>-</td><td>1,00%</td><td>-</td><td>1,00%</td><td>-</td><td>1,00%</td><td>-</td><td>12,68%</td><td>-</td><td>140,00%</td><td>-</td></tr>
  </table>
</body></html>`;

global.fetch = async (url) => {
  const textUrl = String(url);
  requests.push(textUrl);
  if (textUrl.includes('finance.yahoo.com')) {
    return new Response(JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: 100, chartPreviousClose: 99 }, timestamp: [], indicators: { quote: [{ close: [] }] } }], error: null } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('sistemaswebb3-listados.b3.com.br')) return new Response('', { status: 200, headers: { 'Content-Type': 'text/html' } });
  if (textUrl.includes('maisretorno.com/indice/')) {
    const slug = textUrl.split('/').pop().toUpperCase();
    const code = slug === 'IFIX' ? 'IFIX' : slug === 'IDIV' ? 'IDIV' : 'SMLL';
    return new Response(monthlyHtml(code), { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
  if (textUrl.includes('investidor10.com.br')) return new Response('', { status: 200, headers: { 'Content-Type': 'text/html' } });
  return new Response('', { status: 404 });
};

try {
  const { buildPortfolioReturns } = await import('../lib/portfolio/analysis.js');
  const contract = await buildPortfolioReturns({
    range: '12M',
    historyMonths: 12,
    benchmarks: ['SMLL', 'IFIX', 'IDIV'],
    portfolioHistory: [
      { date: '2025-06-01', totalValue: 1000, investedValue: 1000, returnPercent: 0, source: 'broker-real-history' },
      { date: '2025-07-01', totalValue: 1010, investedValue: 1000, returnPercent: 1, source: 'broker-real-history' },
      { date: '2025-08-01', totalValue: 1020, investedValue: 1000, returnPercent: 2, source: 'broker-real-history' },
      { date: '2025-09-01', totalValue: 1030, investedValue: 1000, returnPercent: 3, source: 'broker-real-history' },
      { date: '2025-10-01', totalValue: 1040, investedValue: 1000, returnPercent: 4, source: 'broker-real-history' },
      { date: '2025-11-01', totalValue: 1050, investedValue: 1000, returnPercent: 5, source: 'broker-real-history' },
      { date: '2025-12-01', totalValue: 1060, investedValue: 1000, returnPercent: 6, source: 'broker-real-history' },
      { date: '2026-01-01', totalValue: 1070, investedValue: 1000, returnPercent: 7, source: 'broker-real-history' },
      { date: '2026-02-01', totalValue: 1080, investedValue: 1000, returnPercent: 8, source: 'broker-real-history' },
      { date: '2026-03-01', totalValue: 1090, investedValue: 1000, returnPercent: 9, source: 'broker-real-history' },
      { date: '2026-04-01', totalValue: 1100, investedValue: 1000, returnPercent: 10, source: 'broker-real-history' },
      { date: '2026-05-01', totalValue: 1110, investedValue: 1000, returnPercent: 11, source: 'broker-real-history' },
      { date: '2026-06-01', totalValue: 1120, investedValue: 1000, returnPercent: 12, source: 'broker-real-history' }
    ]
  });

  for (const ticker of ['SMLL', 'IFIX', 'IDIV']) {
    const benchmark = contract.benchmarks.find(item => item.ticker === ticker);
    assert.equal(benchmark?.status, 'OK', `${ticker} should recover through Mais Retorno real monthly returns`);
    assert.equal(benchmark?.simulated, false, `${ticker} must not be simulated`);
    assert.equal(benchmark?.proxyTickerUsed, false, `${ticker} must not use proxy ticker`);
    assert.ok(String(benchmark?.source || '').includes('Mais Retorno'), `${ticker} should show Mais Retorno source`);
    assert.ok((benchmark?.points || []).length >= 2, `${ticker} should have comparison points`);
    assert.ok(contract.series.some(point => point[`${ticker.toLowerCase()}ReturnPercent`] != null || (ticker === 'SMLL' && point.smal11ReturnPercent != null)), `${ticker} should be visible in chart series`);
  }
  assert.ok(requests.some(url => url.includes('maisretorno.com/indice/ifix')), 'IFIX must try Mais Retorno fallback');
  console.log('Portfolio returns Mais Retorno index fallback test OK.');
} finally {
  clearCache();
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
