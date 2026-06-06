import assert from 'node:assert/strict';
import { fetchInvestidor10Rankings, parseInvestidor10RankingsHtml, INVESTIDOR10_RANKINGS_VERSION } from '../lib/market/rankings-i10.js';
import rankingsHandler from '../routes/market/rankings.js';

const homeHtml = `
<html><body>
<section id="ibov"><h3>169.019,12 pontos</h3><p>-0,77%</p><p>Atualizado em 05/06/2026 às 17:17h.</p></section>
<section class="market-movers"><h2>Maiores Altas</h2>
<a href="/acoes/ceab3/"><img alt="CEAB3"> CEAB3 <span>+3,93%</span><span>R$ 11,38</span></a>
<a href="/acoes/embj3/">EMBJ3 <span>+3,85%</span><span>R$ 72,35</span></a>
<a href="/acoes/beef3/">BEEF3 <span>+3,07%</span><span>R$ 3,69</span></a>
<a href="/acoes/klbn11/">KLBN11 <span>+1,97%</span><span>R$ 17,09</span></a>
<a href="/acoes/mglu3/">MGLU3 <span>+1,87%</span><span>R$ 5,44</span></a>
<a href="/acoes/brav3/">BRAV3 <span>+1,69%</span><span>R$ 21,10</span></a>
<h2>Maiores Baixas</h2>
<a href="/acoes/brkm5/">BRKM5 <span>-8,06%</span><span>R$ 8,67</span></a>
<a href="/acoes/cyre3/">CYRE3 <span>-4,84%</span><span>R$ 19,85</span></a>
<a href="/acoes/prio3/">PRIO3 <span>-3,28%</span><span>R$ 60,54</span></a>
<a href="/acoes/cury3/">CURY3 <span>-2,85%</span><span>R$ 28,61</span></a>
<a href="/acoes/vivt3/">VIVT3 <span>-2,81%</span><span>R$ 32,80</span></a>
<a href="/acoes/mrve3/">MRVE3 <span>-2,62%</span><span>R$ 5,57</span></a>
</section>
<section><h2>Moedas</h2></section>
</body></html>`;

const unrelatedEarlyHtml = `<section><h2>Rankings de ETFs</h2><a href="/etfs/bova11/">Maiores Altas - 30 dias BOVA11 R$ 167,28 25,67%</a></section>${homeHtml}`;

const dedicatedAltasHtml = `<html><body><table><tbody>
<tr><td>#1</td><td><a href="/acoes/pati3/">PATI3</a></td><td>R$ 31,80</td><td>+52,11%</td></tr>
<tr><td>#2</td><td><a href="/acoes/pcar3/">PCAR3</a></td><td>R$ 1,60</td><td>+96,10%</td></tr>
<tr><td>#3</td><td><a href="/acoes/embj3/">EMBJ3</a></td><td>R$ 73,29</td><td>+13,07%</td></tr>
</tbody></table></body></html>`;

const dedicatedBaixasHtml = `<html><body><table><tbody>
<tr><td>#1</td><td><a href="/acoes/csna3/">CSNA3</a></td><td>R$ 6,09</td><td>-8,53%</td></tr>
<tr><td>#2</td><td><a href="/acoes/brkm5/">BRKM5</a></td><td>R$ 9,22</td><td>-6,24%</td></tr>
<tr><td>#3</td><td><a href="/acoes/csmg3/">CSMG3</a></td><td>R$ 56,97</td><td>-5,08%</td></tr>
</tbody></table></body></html>`;

{
  const parsed = parseInvestidor10RankingsHtml(unrelatedEarlyHtml, { limit: 6 });
  assert.equal(parsed.altas.length, 6);
  assert.equal(parsed.baixas.length, 6);
  assert.equal(parsed.altas[0].ticker, 'CEAB3');
  assert.equal(parsed.altas[0].changeDisplay, '+3,93%');
  assert.equal(parsed.altas[0].priceDisplay, 'R$ 11,38');
  assert.equal(parsed.baixas[0].ticker, 'BRKM5');
  assert.equal(parsed.baixas[0].changeDisplay, '-8,06%');
  assert.equal(parsed.baixas[0].priceDisplay, 'R$ 8,67');
  assert.equal(parsed.maioresAltas.length, parsed.altas.length);
  assert.equal(parsed.topLosers.length, parsed.baixas.length);
}

{
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const html = String(url).includes('maiores-baixas') ? dedicatedBaixasHtml : String(url).includes('maiores-altas') ? dedicatedAltasHtml : homeHtml;
    return { ok: true, status: 200, url: String(url), async text() { return html; } };
  };
  try {
    const live = await fetchInvestidor10Rankings({ bypassCache: true, mode: 'complete', requireComplete: true, limit: 6, minRows: 6, timeoutMs: 1000, preferredSource: 'home' });
    assert.equal(live.version, INVESTIDOR10_RANKINGS_VERSION);
    assert.equal(live.ok, true);
    assert.equal(live.status, 'OK');
    assert.equal(live.partial, false);
    assert.equal(live.rankings.altas[0].ticker, 'CEAB3');
    assert.equal(live.rankings.baixas[0].ticker, 'BRKM5');
    assert.equal(live.rankings.highs[1].ticker, 'EMBJ3');
    assert.equal(live.rankings.lows[0].changePercent, -8.06);
    assert.ok(calls.some(url => url === 'https://investidor10.com.br/' || url.includes('investidor10.com.br/')));
    assert.equal(calls.some(url => url.includes('/acoes/rankings/maiores-altas/')), false, 'Home do APK não deve usar página dedicada por padrão');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const html = String(url).includes('maiores-baixas') ? dedicatedBaixasHtml : String(url).includes('maiores-altas') ? dedicatedAltasHtml : homeHtml;
    return { ok: true, status: 200, url: String(url), async text() { return html; } };
  };
  try {
    const dedicated = await fetchInvestidor10Rankings({ bypassCache: true, mode: 'complete', requireComplete: false, limit: 3, minRows: 3, timeoutMs: 1000, preferredSource: 'dedicated' });
    assert.equal(dedicated.rankings.altas[0].ticker, 'PATI3');
    assert.equal(dedicated.rankings.baixas[0].ticker, 'CSNA3');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('rankings-i10 v21.12.60 tests OK.');


{
  function mockReq(url) {
    const parsed = new URL(url, 'https://example.vercel.app');
    const query = Object.fromEntries(parsed.searchParams.entries());
    return { method: 'GET', url: parsed.pathname + parsed.search, query, headers: { host: 'example.vercel.app', 'x-forwarded-proto': 'https', 'x-forwarded-for': '127.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } };
  }
  function mockRes() {
    return { statusCode: 200, body: '', headers: {}, setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; }, getHeader(k) { return this.headers[String(k).toLowerCase()]; }, status(c) { this.statusCode = c; return this; }, send(b) { this.body = b; return this; }, end(b = '') { this.body = b; return this; } };
  }
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const html = String(url).includes('maiores-baixas') ? dedicatedBaixasHtml : String(url).includes('maiores-altas') ? dedicatedAltasHtml : homeHtml;
    return { ok: true, status: 200, url: String(url), async text() { return html; } };
  };
  try {
    const res = mockRes();
    await rankingsHandler(mockReq('/api/v1/market/rankings?source=home&mode=complete&limit=6&minRows=6&strict=1&timeoutMs=1000&nocache=1'), res);
    const json = JSON.parse(res.body || '{}');
    assert.equal(res.statusCode, 200);
    assert.equal(json.endpoint, 'market-rankings');
    assert.equal(json.rankingSource, 'investidor10-home-live-complete');
    assert.equal(json.rankings.altas[0].ticker, 'CEAB3');
    assert.equal(json.rankings.topLosers[0].ticker, 'BRKM5');
    assert.equal(json.completeness.complete, true);
    assert.equal(json.fallbackUsed, false);
    assert.equal(calls.some(url => url.includes('/acoes/rankings/maiores-altas/')), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('rankings route contract v21.12.60 OK.');
