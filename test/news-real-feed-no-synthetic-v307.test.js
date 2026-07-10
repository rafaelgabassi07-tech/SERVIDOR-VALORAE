import assert from 'node:assert/strict';
import { getNews } from '../lib/sources/news.js';

const originalFetch = globalThis.fetch;
const now = new Date().toUTCString();
let requests = [];
globalThis.fetch = async url => {
  const target = String(url);
  requests.push(target);
  const broad = decodeURIComponent(target).includes('mercado financeiro OR B3');
  const xml = broad
    ? `<?xml version="1.0"?><rss><channel><item><title>Mercado brasileiro fecha em alta</title><link>https://example.com/mercado-alta</link><pubDate>${now}</pubDate><description>Ibovespa avançou com ações e bancos.</description><source>Fonte Mercado</source></item></channel></rss>`
    : '<?xml version="1.0"?><rss><channel></channel></rss>';
  return new Response(xml, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
};

try {
  const result = await getNews({ symbols: ['PETR4'], limit: 4, timeoutMs: 1000, refresh: true });
  assert.equal(result.status, 'OK');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, 'Mercado brasileiro fecha em alta');
  assert.ok(!result.items.some(item => /abrir busca de notícias/i.test(item.title || '')), 'link de busca não pode virar notícia sintética');
  assert.ok(requests.length >= 2, 'consulta ampla deve ser tentada quando a busca específica vier vazia');
  assert.match(result.searchUrl, /^https:\/\/news\.google\.com\/search/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('news-real-feed-no-synthetic-v307 ok');
