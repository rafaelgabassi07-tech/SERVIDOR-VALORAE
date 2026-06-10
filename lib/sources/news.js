import { fetchText } from './fetch.js';
import { normalizeTicker } from '../core/tickers.js';

function decodeXml(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return decodeXml(m?.[1] || '');
}

function parseItems(xml = '', limit = 20) {
  const blocks = [...String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m => m[0]);
  return blocks.map((block, index) => {
    const title = tag(block, 'title').replace(/\s+-\s+[^-]+$/, '').trim();
    const link = tag(block, 'link');
    const pubDate = tag(block, 'pubDate');
    const source = tag(block, 'source') || 'VALORAE Notícias';
    const ts = Date.parse(pubDate) || (Date.now() - index * 60_000);
    return { title, link, url: link, pubDate, timestamp: Math.floor(ts / 1000), source, category: 'Mercado', summary: tag(block, 'description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
  }).filter(item => item.title && item.link).sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export async function getNews(payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q || '');
  const limit = Math.max(1, Math.min(40, Number(payload.limit || payload.newsLimit || 20)));
  const timeoutMs = Number(payload.timeoutMs || payload.newsTimeoutMs || 3500);
  const query = ticker ? `${ticker} ações OR dividendos OR B3` : 'mercado financeiro B3 ações dividendos Brasil';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  const fetched = await fetchText(url, { timeoutMs, ttlMs: 5 * 60_000, staleMs: 24 * 60 * 60 * 1000, headers: { Accept: 'application/rss+xml,text/xml,*/*' } });
  const items = parseItems(fetched.text, limit);
  const safeItems = items.length ? items : [{
    title: 'VALORAE Notícias — fonte temporariamente indisponível',
    link: '/server.html',
    url: '/server.html',
    pubDate: new Date().toUTCString(),
    timestamp: Math.floor(Date.now() / 1000),
    source: 'VALORAE Notícias',
    category: 'Sistema',
    summary: 'O feed público de notícias não respondeu dentro do prazo. O app preserva cache local e tentará atualizar novamente.'
  }];
  return { status: items.length ? 'OK' : 'FALLBACK', endpoint: 'news', source: 'VALORAE Notícias', ticker, items: safeItems, news: safeItems, articles: safeItems, cacheStatus: fetched.cacheStatus, statusCode: fetched.status, error: fetched.error, partial: !items.length };
}
