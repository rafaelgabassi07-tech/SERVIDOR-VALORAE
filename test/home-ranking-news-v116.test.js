import assert from 'node:assert/strict';
import { dispatchRoute } from '../routes/_router.js';

async function callJson(url) {
  let payload = '';
  const headers = {};
  const req = { method: 'GET', url, headers: {} };
  const res = {
    statusCode: 200,
    headers,
    setHeader(key, value) { headers[key.toLowerCase()] = value; },
    removeHeader(key) { delete headers[key.toLowerCase()]; },
    status(code) { this.statusCode = code; return this; },
    send(body) { payload = String(body ?? ''); return this; },
    end(body = '') { payload = String(body ?? ''); return this; },
  };
  await dispatchRoute(req, res);
  return { statusCode: res.statusCode, body: JSON.parse(payload || '{}'), headers };
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('network disabled for v116 fallback contract test'); };
try {
  const ranking = await callJson('/api/v1/market/rankings?type=ACAO&source=home&limit=6&minRows=6&timeoutMs=1000&fallbackTimeoutMs=700');
  assert.equal(ranking.statusCode, 200, 'ranking deve responder HTTP 200 mesmo quando a fonte ao vivo falhar');
  assert.notEqual(ranking.body.status, 'ERROR', 'ranking da Home não deve virar erro fatal para o APK quando há fallback operacional');
  assert.equal(ranking.body.fallbackUsed, true, 'ranking deve declarar fallback operacional');
  assert.ok(Array.isArray(ranking.body.rankings?.altas), 'rankings.altas deve existir');
  assert.ok(Array.isArray(ranking.body.rankings?.baixas), 'rankings.baixas deve existir');
  assert.ok(ranking.body.rankings.altas.length > 0, 'fallback deve entregar linhas para Maiores Altas');
  assert.ok(ranking.body.rankings.baixas.length > 0, 'fallback deve entregar linhas para Maiores Baixas');

  const news = await callJson('/api/v1/news?limit=4&timeoutMs=700');
  assert.equal(news.statusCode, 200, 'notícias devem responder HTTP 200 com fallback');
  assert.ok(Array.isArray(news.body.news), 'news deve ser array');
  assert.equal(news.body.status, 'EMPTY', 'falha do RSS deve produzir estado vazio, não artigo sintético');
  assert.equal(news.body.news.length, 0, 'link de busca não pode ser inserido como notícia');
  assert.match(news.body.searchUrl, /^https:\/\//, 'a busca manual permanece disponível como metadado separado');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Home ranking/news v116 fallback contract test OK.');
