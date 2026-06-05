import assert from 'node:assert/strict';
import { fetchInvestidor10Rankings, parseInvestidor10RankingsHtml, INVESTIDOR10_RANKINGS_VERSION } from '../lib/market/rankings-i10.js';
import rankingsHandler from '../routes/market/rankings.js';

const altasHtml = `
<html><body><table><tbody>
<tr><td>#1</td><td><a href="https://investidor10.com.br/acoes/abcd3/">ABCD3 Empresa Alfa</a></td><td>R$ 10,25</td><td>+7,50%</td></tr>
<tr><td>#2</td><td><a href="/acoes/efgh4/">EFGH4 Empresa Beta</a></td><td>R$ 22,10</td><td>+3,40%</td></tr>
<tr><td>#3</td><td><a href="/acoes/ijkl11/">IJKL11 Empresa Unit</a></td><td>R$ 31,00</td><td>+1,20%</td></tr>
</tbody></table></body></html>`;

const baixasHtml = `
<html><body><table><tbody>
<tr><td>#1</td><td><a href="https://investidor10.com.br/acoes/wxyz3/">WXYZ3 Empresa Delta</a></td><td>R$ 9,90</td><td>-6,80%</td></tr>
<tr><td>#2</td><td><a href="/acoes/mnop4/">MNOP4 Empresa Gama</a></td><td>R$ 18,70</td><td>-2,30%</td></tr>
<tr><td>#3</td><td><a href="/acoes/qrst11/">QRST11 Empresa Fii Unit</a></td><td>R$ 101,45</td><td>-0,90%</td></tr>
</tbody></table></body></html>`;

{
  const home = `<section><h2>Maiores Altas</h2>${altasHtml}</section><section><h2>Maiores Baixas</h2>${baixasHtml}</section>`;
  const parsed = parseInvestidor10RankingsHtml(home, { limit: 5 });
  assert.equal(parsed.altas[0].ticker, 'ABCD3');
  assert.equal(parsed.altas[0].changeDisplay, '+7,50%');
  assert.equal(parsed.altas[0].priceDisplay, 'R$ 10,25');
  assert.equal(parsed.maioresAltas.length, parsed.altas.length);
  assert.equal(parsed.topLosers.length, parsed.baixas.length);
}

{
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const html = String(url).includes('maiores-baixas') ? baixasHtml : altasHtml;
    return { ok: true, status: 200, url: String(url), async text() { return html; } };
  };
  try {
    const live = await fetchInvestidor10Rankings({ bypassCache: true, mode: 'complete', requireComplete: true, limit: 3, minRows: 3, timeoutMs: 1000 });
    assert.equal(live.version, INVESTIDOR10_RANKINGS_VERSION);
    assert.equal(live.ok, true);
    assert.equal(live.status, 'OK');
    assert.equal(live.partial, false);
    assert.equal(live.rankings.altas.length, 3);
    assert.equal(live.rankings.baixas.length, 3);
    assert.equal(live.rankings.highs[1].ticker, 'EFGH4');
    assert.equal(live.rankings.lows[0].changePercent, -6.8);
    assert.ok(calls.some(url => url.includes('/acoes/rankings/maiores-altas/')));
    assert.ok(calls.some(url => url.includes('/acoes/rankings/maiores-baixas/')));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('rankings-i10 v21.12.59 tests OK.');


{
  function mockReq(url) {
    const parsed = new URL(url, 'https://example.vercel.app');
    const query = Object.fromEntries(parsed.searchParams.entries());
    return { method: 'GET', url: parsed.pathname + parsed.search, query, headers: { host: 'example.vercel.app', 'x-forwarded-proto': 'https', 'x-forwarded-for': '127.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } };
  }
  function mockRes() {
    return { statusCode: 200, body: '', headers: {}, setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; }, getHeader(k) { return this.headers[String(k).toLowerCase()]; }, status(c) { this.statusCode = c; return this; }, send(b) { this.body = b; return this; }, end(b = '') { this.body = b; return this; } };
  }
  const res = mockRes();
  await rankingsHandler(mockReq('/api/v1/market/rankings?source=live&mode=complete&limit=3&minRows=3&strict=1&timeoutMs=1000'), res);
  const json = JSON.parse(res.body || '{}');
  assert.equal(res.statusCode, 200);
  assert.equal(json.endpoint, 'market-rankings');
  assert.equal(json.rankingSource, 'investidor10-live-complete');
  assert.equal(json.rankings.altas[0].ticker, 'ABCD3');
  assert.equal(json.rankings.topLosers[0].ticker, 'WXYZ3');
  assert.equal(json.completeness.complete, true);
}

console.log('rankings route contract v21.12.59 OK.');
