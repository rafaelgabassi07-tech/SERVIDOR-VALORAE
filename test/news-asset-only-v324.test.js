import assert from 'node:assert/strict';
import { dispatchRoute } from '../routes/_router.js';
import { getNews } from '../lib/sources/news.js';
import { clearValoraeCaches } from '../lib/Valorae-engine.js';

async function callJson(url) {
  let payload = '';
  const headers = {};
  const req = { method: 'GET', url, headers: {} };
  const res = {
    statusCode: 200,
    headers,
    setHeader(key, value) { headers[String(key).toLowerCase()] = value; },
    removeHeader(key) { delete headers[String(key).toLowerCase()]; },
    status(code) { this.statusCode = code; return this; },
    send(body) { payload = String(body ?? ''); return this; },
    end(body = '') { payload = String(body ?? ''); return this; },
  };
  await dispatchRoute(req, res);
  return { statusCode: res.statusCode, body: JSON.parse(payload || '{}'), headers };
}

const originalFetch = globalThis.fetch;
const now = new Date().toUTCString();
const rss = items => `<?xml version="1.0"?><rss><channel>${items.map(item => `
  <item>
    <title>${item.title}</title>
    <link>${item.link}</link>
    <pubDate>${now}</pubDate>
    <description>${item.description}</description>
    <source url="https://example.com">Fonte Teste</source>
  </item>`).join('')}</channel></rss>`;

try {
  // A rota pública deve filtrar uma matéria financeira sem vínculo com o ativo
  // quando assetOnly está ativo, mesmo que o RSS específico devolva ambos os itens.
  clearValoraeCaches('news');
  let routeRequests = 0;
  globalThis.fetch = async () => {
    routeRequests += 1;
    return new Response(rss([
      {
        title: 'Petrobras aprova dividendos extraordinários',
        link: 'https://example.com/petrobras-dividendos',
        description: 'A Petrobras (PETR4) aprovou novos proventos aos acionistas.'
      },
      {
        title: 'Vale divulga balanço trimestral',
        link: 'https://example.com/vale-balanco',
        description: 'A mineradora apresentou resultados e lucro no trimestre.'
      }
    ]), { status: 200, headers: { 'content-type': 'application/rss+xml' } });
  };

  const strict = await callJson('/api/v1/news?symbol=PETR4&query=Petrobras&assetOnly=true&refresh=true&limit=8&timeoutMs=1000');
  assert.equal(strict.statusCode, 200);
  assert.equal(strict.body.assetOnly, true);
  assert.equal(strict.body.items.length, 1, 'modo estrito deve manter somente notícia ligada ao ativo');
  assert.match(strict.body.items[0].title, /Petrobras/i);
  assert.equal(routeRequests, 1);

  clearValoraeCaches('news');
  const general = await callJson('/api/v1/news?symbol=PETR4&query=Petrobras&assetOnly=false&refresh=true&limit=8&timeoutMs=1000');
  assert.equal(general.statusCode, 200);
  assert.equal(general.body.assetOnly, false);
  assert.equal(general.body.items.length, 2, 'modo legado deve preservar o comportamento amplo anterior');

  // O produtor de feed usado por rotas legadas não deve executar fallback amplo
  // quando a solicitação específica do modal não encontra nenhum item.
  let sourceRequests = [];
  globalThis.fetch = async url => {
    const target = String(url);
    sourceRequests.push(target);
    const broad = decodeURIComponent(target).includes('mercado financeiro OR B3');
    const xml = broad
      ? rss([{
          title: 'Mercado brasileiro fecha em alta',
          link: 'https://example.com/mercado-alta',
          description: 'Ibovespa avançou com bancos e varejo.'
        }])
      : rss([]);
    return new Response(xml, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
  };

  const strictSource = await getNews({ symbols: ['SNAG11'], query: 'Suno Agro', assetOnly: true, refresh: true, timeoutMs: 1000 });
  assert.equal(strictSource.status, 'EMPTY');
  assert.equal(strictSource.assetOnly, true);
  assert.equal(sourceRequests.length, 2, 'assetOnly deve tentar somente as duas janelas específicas, sem consultar feed amplo');
  assert.ok(sourceRequests.every(url => !decodeURIComponent(url).includes('mercado financeiro OR B3')), 'retry estrito não pode virar busca geral');

  sourceRequests = [];
  const legacySource = await getNews({ symbols: ['SNAG11'], query: 'Suno Agro', assetOnly: false, refresh: true, timeoutMs: 1000 });
  assert.equal(legacySource.status, 'OK');
  assert.equal(legacySource.items.length, 1);
  assert.ok(sourceRequests.length >= 1, 'modo legado deve consultar a fonte específica e manter o fallback amplo, inclusive quando ele já estiver em cache compartilhado');
} finally {
  globalThis.fetch = originalFetch;
  clearValoraeCaches('news');
}

console.log('news-asset-only-v324 ok');
