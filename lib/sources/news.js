import { fetchText } from './fetch.js';
import { normalizeTicker } from '../core/tickers.js';

function decodeXml(value = '') {
  return decodeEntities(String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
    .trim();
}

function decodeEntities(value = '') {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—');
}

function stripTags(value = '') {
  return decodeEntities(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return decodeXml(m?.[1] || '');
}

function tagAttr(block, name, attr = 'url') {
  const m = block.match(new RegExp(`<${name}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, 'i'));
  return decodeXml(m?.[1] || '');
}

function cleanLine(value = '') {
  return stripTags(value).replace(/\s+/g, ' ').trim();
}

function parseSymbols(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',');
  return [];
}

function parseItems(xml = '', limit = 20) {
  const blocks = [...String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m => m[0]);
  return blocks.map((block, index) => {
    const title = tag(block, 'title').replace(/\s+-\s+[^-]+$/, '').trim();
    const link = tag(block, 'link') || tagAttr(block, 'media:content') || tagAttr(block, 'enclosure');
    const pubDate = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated');
    const source = tag(block, 'source') || 'VALORAE Notícias';
    const description = tag(block, 'description') || tag(block, 'content:encoded') || tag(block, 'summary');
    const ts = Date.parse(pubDate) || (Date.now() - index * 60_000);
    const summary = cleanLine(description);
    return {
      title,
      link,
      url: link,
      pubDate,
      publishedAt: pubDate,
      timestamp: Math.floor(ts / 1000),
      source,
      provider: source,
      category: 'Mercado',
      summary,
      description: summary,
      openInBrowser: true,
      inAppReader: false
    };
  }).filter(item => item.title && item.link).sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

function metaContent(html = '', property = '') {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i');
  return decodeEntities((html.match(re)?.[1] || html.match(alt)?.[1] || '')).trim();
}

function titleFromHtml(html = '') {
  return cleanLine(metaContent(html, 'og:title') || metaContent(html, 'twitter:title') || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''));
}

function scoreCandidate(html = '') {
  const text = stripTags(html);
  const links = [...String(html).matchAll(/<a\b[\s\S]*?<\/a>/gi)].map(m => stripTags(m[0]).length).reduce((a, b) => a + b, 0);
  const pCount = (String(html).match(/<p\b/gi) || []).length;
  const linkDensity = links / Math.max(1, text.length);
  return text.length + pCount * 90 + (text.match(/[.,;]/g) || []).length * 2 - linkDensity * text.length * 1.4;
}

function candidateBlocks(html = '') {
  const blocks = [];
  const patterns = [
    /<article\b[\s\S]*?<\/article>/gi,
    /<main\b[\s\S]*?<\/main>/gi,
    /<div[^>]+(?:class|id)=["'][^"']*(?:article|materia|mat[eé]ria|post-content|entry-content|article-body|story|texto|content__article)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi
  ];
  patterns.forEach(re => [...String(html).matchAll(re)].forEach(m => blocks.push(m[0])));
  if (!blocks.length) blocks.push(html);
  return blocks;
}

function paragraphsFromBlock(block = '') {
  const parts = [...String(block).matchAll(/<(p|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(m => cleanLine(m[2]))
    .filter(line => line.length >= 45 && !looksBoilerplate(line));
  const deduped = [];
  const seen = new Set();
  for (const part of parts) {
    const key = part.toLowerCase().slice(0, 160);
    if (!seen.has(key)) { seen.add(key); deduped.push(part); }
  }
  return deduped.join('\n\n').trim();
}

function looksBoilerplate(value = '') {
  const text = value.toLowerCase();
  return text.includes('aceitar cookies') || text.includes('publicidade') || text.includes('newsletter') || text.includes('compartilhe') || text.includes('receba notícias') || text === 'leia também';
}

function extractArticleText(html = '') {
  const jsonLdBody = String(html).match(/"articleBody"\s*:\s*"((?:\\"|[^"])*)"/i)?.[1];
  if (jsonLdBody) {
    try {
      const parsed = JSON.parse(`"${jsonLdBody}"`);
      const clean = cleanLine(parsed);
      if (clean.length > 400) return clean;
    } catch {}
  }
  const cleanedHtml = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(nav|footer|header|aside|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+(?:cookie|newsletter|share|related|publicidade|advert)[^>]+>[\s\S]*?<\/[^>]+>/gi, ' ');
  const best = candidateBlocks(cleanedHtml).sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0] || cleanedHtml;
  const paragraphs = paragraphsFromBlock(best);
  if (paragraphs.length > 260) return paragraphs.slice(0, 12_000).trim();
  const plain = stripTags(best);
  return plain.length > 260 ? plain.slice(0, 12_000).trim() : '';
}

async function enrichArticle(item, { timeoutMs = 3200, ttlMs = 30 * 60_000 } = {}) {
  if (!item?.url || !/^https?:\/\//i.test(item.url)) return item;
  try {
    const fetched = await fetchText(item.url, {
      timeoutMs,
      ttlMs,
      staleMs: 24 * 60 * 60_000,
      headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
      retries: 0
    });
    const body = extractArticleText(fetched.text);
    const extractedTitle = titleFromHtml(fetched.text);
    if (!body || body.length <= (item.summary || '').length) {
      return { ...item, articleStatus: 'summary-only', articleMessage: 'A fonte expôs apenas resumo.' };
    }
    return {
      ...item,
      title: item.title || extractedTitle,
      articleTitle: extractedTitle || item.title,
      body,
      articleBody: body,
      contentText: body,
      fullText: body,
      articleStatus: body.length > 520 ? 'full' : 'partial',
      articleMessage: body.length > 520 ? 'Matéria completa extraída pelo serviço de dados.' : 'Trecho principal extraído pelo serviço de dados.'
    };
  } catch (error) {
    return { ...item, articleStatus: 'unavailable', articleMessage: error?.message || 'Falha ao extrair matéria.' };
  }
}

export async function getNews(payload = {}) {
  const symbols = parseSymbols(payload.symbols || payload.tickers || payload.assets).map(normalizeTicker).filter(Boolean).slice(0, 8);
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q || symbols[0] || '');
  const limit = Math.max(1, Math.min(40, Number(payload.limit || payload.newsLimit || 20)));
  const timeoutMs = Number(payload.timeoutMs || payload.newsTimeoutMs || 3500);
  const articleTimeoutMs = Math.max(1000, Math.min(6000, Number(payload.articleTimeoutMs || 3200)));
  const includeArticleBody = String(payload.includeArticleBody ?? payload.full ?? 'false') === 'true';
  const querySymbols = [ticker, ...symbols.filter(symbol => symbol !== ticker)].filter(Boolean).slice(0, 8);
  const query = querySymbols.length
    ? `(${querySymbols.join(' OR ')}) ações OR dividendos OR B3`
    : 'mercado financeiro B3 ações dividendos Brasil';
  const freshSuffix = (String(payload.refresh || payload.nocache || payload.bypassCache || 'false') === 'true') ? `&_fresh=${Date.now()}` : '';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419${freshSuffix}`;
  const fetched = await fetchText(url, { timeoutMs, ttlMs: freshSuffix ? 0 : 5 * 60_000, staleMs: freshSuffix ? 0 : 24 * 60 * 60 * 1000, headers: { Accept: 'application/rss+xml,text/xml,*/*' } });
  const items = parseItems(fetched.text, limit);
  const fallbackUrl = `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  const fallback = [{
    title: 'VALORAE Notícias — abrir busca de notícias do mercado',
    link: fallbackUrl,
    url: fallbackUrl,
    originalUrl: fallbackUrl,
    pubDate: new Date().toUTCString(),
    publishedAt: new Date().toUTCString(),
    timestamp: Math.floor(Date.now() / 1000),
    source: 'VALORAE Notícias',
    provider: 'VALORAE Notícias',
    category: 'Sistema',
    summary: 'O feed público não respondeu dentro do prazo. Este card abre uma busca atualizada no Google Notícias enquanto o app preserva o cache local.',
    body: 'O feed público de notícias não respondeu dentro do prazo. Toque para abrir uma busca atualizada no Google Notícias pelo navegador; o Valorae tentará atualizar novamente quando a conexão estiver disponível.',
    articleStatus: 'fallback-search',
    openInBrowser: true,
    inAppReader: false
  }];
  const baseItems = items.length ? items : fallback;
  const enriched = includeArticleBody && items.length
    ? await Promise.all(baseItems.map(item => enrichArticle(item, { timeoutMs: articleTimeoutMs })))
    : baseItems;
  return {
    status: items.length ? 'OK' : 'FALLBACK',
    endpoint: 'news',
    source: 'VALORAE Notícias',
    ticker,
    symbols,
    items: enriched.map(item => ({ ...item, url: item.url || item.link || '', originalUrl: item.originalUrl || item.url || item.link || '', openInBrowser: true, inAppReader: false })),
    news: enriched.map(item => ({ ...item, url: item.url || item.link || '', originalUrl: item.originalUrl || item.url || item.link || '', openInBrowser: true, inAppReader: false })),
    articles: enriched.map(item => ({ ...item, url: item.url || item.link || '', originalUrl: item.originalUrl || item.url || item.link || '', openInBrowser: true, inAppReader: false })),
    articleExtraction: includeArticleBody ? 'enabled' : 'disabled',
    openPolicy: { preferredClientAction: 'OPEN_ORIGINAL_URL_IN_BROWSER', requiresInAppReader: false },
    cacheStatus: fetched.cacheStatus,
    statusCode: fetched.status,
    error: fetched.error,
    partial: !items.length || enriched.some(item => item.articleStatus && item.articleStatus !== 'full')
  };
}
