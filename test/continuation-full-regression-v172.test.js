import assert from 'node:assert/strict';
import newsHandler from '../routes/news.js';
import { yahooSymbol as yahooQuoteSymbol } from '../lib/sources/quotes.js';
import { yahooSymbol as yahooHistorySymbol } from '../lib/market/yahoo.js';

class MockRes {
  constructor() { this.headers = {}; this.statusCode = 200; this.body = undefined; }
  setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; return this; }
  getHeader(k) { return this.headers[String(k).toLowerCase()]; }
  status(code) { this.statusCode = code; return this; }
  json(value) { this.body = value; return this; }
  send(value) { this.body = value; return this; }
  end(value = '') { this.body = value; return this; }
}

function req(query = {}) {
  return {
    method: 'GET',
    query,
    body: undefined,
    headers: { host: 'valorae-proxy.vercel.app', 'x-forwarded-proto': 'https', 'x-forwarded-for': '127.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
    url: '/api/v1/news'
  };
}

function bodyOf(res) {
  if (typeof res.body === 'string') return JSON.parse(res.body || '{}');
  return res.body || {};
}

assert.equal(yahooQuoteSymbol('BVMF:KLBN4.SA'), 'KLBN4.SA', 'cotação Yahoo não pode preservar prefixo BVMF inválido');
assert.equal(yahooQuoteSymbol('B3:PETR4F.SA'), 'PETR4.SA', 'cotação Yahoo deve limpar prefixo/lote fracionário/sufixo');
assert.equal(yahooHistorySymbol('BVMF:KLBN4.SA'), 'KLBN4.SA', 'histórico Yahoo não pode preservar prefixo BVMF inválido');
assert.equal(yahooHistorySymbol('B3:PETR4F.SA'), 'PETR4.SA', 'histórico Yahoo deve limpar prefixo/lote fracionário/sufixo');

const originalFetch = globalThis.fetch;
let capturedUrl = '';
globalThis.fetch = async (url) => {
  capturedUrl = String(url);
  const pubDate = new Date().toUTCString();
  const xml = `<?xml version="1.0"?><rss><channel><item><title>KLBN4 aprova dividendos e resultado trimestral</title><link>https://example.com/klbn4-dividendos</link><pubDate>${pubDate}</pubDate><source>Fonte Teste</source><description>Notícia de KLBN4 sobre dividendos, proventos e balanço.</description></item></channel></rss>`;
  return { ok: true, status: 200, text: async () => xml };
};
try {
  const res = new MockRes();
  await newsHandler(req({ query: 'KLBN4 dividendos', symbols: 'BVMF:KLBN4.SA;B3:KLBN4F', limit: '5', refresh: 'true', timeoutMs: '1000' }), res);
  const body = bodyOf(res);
  assert.equal(res.statusCode, 200);
  assert.equal(body.searchQuery, 'KLBN4 dividendos', 'rota precisa ecoar a busca textual enviada pelo APK');
  assert.deepEqual(body.symbols, ['KLBN4'], 'rota de notícias deve deduplicar símbolos canônicos');
  assert.ok(decodeURIComponent(capturedUrl.replace(/\+/g, ' ')).includes('KLBN4 dividendos'), 'query textual precisa entrar no RSS do Google News');
  assert.ok(Array.isArray(body.news) && body.news.length >= 1, 'busca textual deve retornar itens quando a fonte responde');
  assert.equal(body.news[0].openInBrowser, true, 'contrato do APK precisa manter abertura no navegador');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Continuation full regression v172 test OK.');
