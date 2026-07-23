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


function normalizedHttpUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withProtocol);
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function newsHostname(value = '') {
  const safeUrl = normalizedHttpUrl(value);
  if (!safeUrl) return '';
  try {
    return new URL(safeUrl).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function sourceLogoUrlFromDomain(domain = '') {
  const clean = String(domain || '').trim().replace(/^www\./i, '').toLowerCase();
  if (!clean) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=64`;
}

function withSourceBranding(item = {}) {
  const sourceUrl = normalizedHttpUrl(item.sourceUrl || item.source_url || item.publisherUrl || item.publisher_url || '');
  const sourceDomain = String(item.sourceDomain || item.source_domain || '').trim().replace(/^www\./i, '').toLowerCase()
    || newsHostname(sourceUrl)
    || (newsHostname(item.url || item.link || '').includes('news.google.') ? '' : newsHostname(item.url || item.link || ''));
  const sourceLogoUrl = String(item.sourceLogoUrl || item.source_logo_url || item.logoUrl || item.logo_url || item.faviconUrl || item.favicon_url || '').trim()
    || sourceLogoUrlFromDomain(sourceDomain);
  return {
    ...item,
    sourceUrl,
    source_url: sourceUrl,
    publisherUrl: sourceUrl,
    publisher_url: sourceUrl,
    sourceDomain,
    source_domain: sourceDomain,
    publisherDomain: sourceDomain,
    publisher_domain: sourceDomain,
    sourceLogoUrl,
    source_logo_url: sourceLogoUrl,
    faviconUrl: sourceLogoUrl,
    favicon_url: sourceLogoUrl
  };
}

function parseSymbols(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(/[,;\s]+/);
  return [];
}

function newsDateMs(item = {}) {
  const candidates = [
    item.publishedAt, item.published_at, item.pubDate, item.date, item.time,
    item.timestamp, item.createdAt, item.updatedAt
  ];
  for (const value of candidates) {
    if (value === undefined || value === null || value === '') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric > 9_999_999_999 ? numeric : numeric * 1000;
    const parsed = Date.parse(String(value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function sortNewsNewestFirst(items = []) {
  return [...items].sort((a, b) => {
    const byDate = newsDateMs(b) - newsDateMs(a);
    if (byDate) return byDate;
    return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
  });
}

function parseItems(xml = '', limit = 20) {
  const blocks = [...String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(m => m[0]);
  return blocks.map((block, index) => {
    const title = tag(block, 'title').replace(/\s+-\s+[^-]+$/, '').trim();
    const link = tag(block, 'link') || tagAttr(block, 'media:content') || tagAttr(block, 'enclosure');
    const pubDate = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated');
    const source = tag(block, 'source') || 'VALORAE Notícias';
    const sourceUrl = tagAttr(block, 'source', 'url');
    const description = tag(block, 'description') || tag(block, 'content:encoded') || tag(block, 'summary');
    const ts = Date.parse(pubDate) || (Date.now() - index * 60_000);
    const summary = cleanLine(description);
    return withSourceBranding({
      title,
      link,
      url: link,
      pubDate,
      publishedAt: pubDate,
      timestamp: Math.floor(ts / 1000),
      source,
      provider: source,
      sourceUrl,
      category: 'Mercado',
      summary,
      description: summary,
      openInBrowser: true,
      inAppReader: false
    });
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
    const brandedItem = withSourceBranding({ ...item, sourceUrl: item.sourceUrl || item.source_url || fetched.finalUrl || item.url });
    if (!body || body.length <= (item.summary || '').length) {
      return { ...brandedItem, articleStatus: 'summary-only', articleMessage: 'A fonte expôs apenas resumo.' };
    }
    return {
      ...brandedItem,
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

function normalizeNewsSearchText(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[<>"'`{}\[\]\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 96);
}

function looksLikeSingleTickerQuery(value = '') {
  return /^(?:[A-Z]{4}[0-9]{1,2}[A-Z]?|[A-Z0-9]{3,6}[0-9]{1,2})$/.test(String(value || '').trim().toUpperCase());
}

function inferCategoryForNewsItem(item = {}, { querySymbols = [], freeTextQuery = '' } = {}) {
  const text = `${item.category || ''} ${item.title || ''} ${item.summary || ''} ${item.description || ''} ${item.body || ''} ${freeTextQuery || ''}`.toLowerCase();
  if (querySymbols.length) return 'Carteira';
  if (/\bfii\b|\bfiis\b|fundo imobili|fiagro|fundo de papel|fundo de tijolo/.test(text)) return 'FIIs';
  if (/educa|guia|aprenda|como\s+|entenda|iniciante|passo a passo|conceito/.test(text)) return 'Educação';
  return 'Mercado';
}

function attachNewsMetadata(item = {}, context = {}) {
  const querySymbols = Array.isArray(context.querySymbols) ? context.querySymbols : [];
  const upperText = `${item.title || ''} ${item.summary || ''} ${item.description || ''} ${item.body || ''}`.toUpperCase();
  const mentionedSymbols = querySymbols.filter(symbol => upperText.includes(symbol) || upperText.includes(String(symbol).replace(/11$/, '')));
  const symbols = [...new Set([...(Array.isArray(item.symbols) ? item.symbols : []), ...mentionedSymbols])].filter(Boolean);
  const lowerText = upperText.toLowerCase();
  const relevanceSignals = [
    ['fato relevante', 5], ['comunicado ao mercado', 5], ['cvm', 4], ['resultado', 3], ['balanço', 3],
    ['dividendo', 3], ['jcp', 3], ['provento', 3], ['rating', 3], ['recompra', 3],
    ['subscrição', 3], ['emissão', 2], ['follow-on', 2], ['assembleia', 2], ['vacância', 2]
  ];
  const relevanceScore = relevanceSignals.reduce((score, [term, weight]) => score + (lowerText.includes(term) ? weight : 0), symbols.length ? 2 : 0);
  const topic = lowerText.includes('fato relevante') || lowerText.includes('comunicado ao mercado') || lowerText.includes('cvm')
    ? 'oficial'
    : lowerText.includes('dividendo') || lowerText.includes('jcp') || lowerText.includes('provento')
      ? 'proventos'
      : lowerText.includes('resultado') || lowerText.includes('balanço') || lowerText.includes('lucro líquido') || lowerText.includes('prejuízo')
        ? 'resultados'
        : lowerText.includes('rating') || lowerText.includes('rebaixamento') || lowerText.includes('elevação')
          ? 'rating'
          : lowerText.includes('recompra')
            ? 'recompra'
            : lowerText.includes('subscrição') || lowerText.includes('emissão') || lowerText.includes('follow-on')
              ? 'subscrição'
              : 'carteira';
  const cleanTitleHint = String(item.title || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\b[a-z0-9.-]+\.com(?:\.br)?\b/gi, ' ')
    .replace(/\s+-\s+[^-]{2,42}$/g, '')
    .replace(/\s+\|\s+[^|]{2,42}$/g, '')
    .replace(/^(provento|proventos|dividendos|resultado|resultados|mercado|not[ií]cias?|carteira)\s*[•:–—-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return withSourceBranding({
    ...item,
    category: inferCategoryForNewsItem(item, context),
    tag: inferCategoryForNewsItem(item, context),
    symbols,
    tickers: symbols,
    notificationCandidate: Boolean(symbols.length && relevanceScore >= 3),
    notificationTopic: topic,
    notificationTitleHint: cleanTitleHint,
    notificationOpenUrl: item.url || item.link || item.originalUrl || '',
    notificationReason: symbols.length ? `Matéria relevante para ${symbols.slice(0, 3).join(', ')}` : 'Matéria relevante para a carteira',
    relevanceScore,
    relevanceSignals: relevanceSignals.filter(([term]) => lowerText.includes(term)).map(([term]) => term)
  });
}

const NEWS_STRICT_ASSET_STOPWORDS = new Set([
  'acao', 'acoes', 'brasil', 'brasileira', 'companhia', 'empresa', 'fundo', 'fundos',
  'imobiliario', 'investimento', 'investimentos', 'participacoes', 'holding', 'ordinaria',
  'preferencial', 'unit', 'ltda'
]);

function normalizeStrictAssetText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function strictAssetTokens({ querySymbols = [], freeTextQuery = '' } = {}) {
  const values = [...querySymbols, freeTextQuery].filter(Boolean);
  const tokens = [];
  for (const value of values) {
    const normalized = normalizeStrictAssetText(value);
    if (normalized.length >= 5) tokens.push(normalized);
    for (const token of normalized.split(' ')) {
      if (token.length >= 5 && !NEWS_STRICT_ASSET_STOPWORDS.has(token)) tokens.push(token);
    }
  }
  return [...new Set(tokens)].slice(0, 16);
}

function matchesStrictAssetItem(item = {}, context = {}) {
  const hay = normalizeStrictAssetText(`${item.title || ''} ${item.summary || ''} ${item.description || ''} ${item.body || ''} ${item.source || ''}`);
  const compactHay = hay.replace(/\s+/g, '');
  return strictAssetTokens(context).some(token => {
    const compactToken = token.replace(/\s+/g, '');
    return hay.includes(token) || (compactToken.length >= 4 && compactHay.includes(compactToken));
  });
}

function quotedNewsTerm(value = '') {
  const clean = normalizeNewsSearchText(value);
  return clean ? `"${clean.replace(/"/g, ' ')}"` : '';
}

function googleNewsRssUrl(query = '', freshSuffix = '') {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419${freshSuffix}`;
}

function uniqueNewsItems(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const key = String(item?.url || item?.link || item?.title || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getNews(payload = {}) {
  const symbols = [...new Set(parseSymbols(payload.symbols || payload.tickers || payload.assets).map(normalizeTicker).filter(Boolean))].slice(0, 96);
  const rawSearch = normalizeNewsSearchText(payload.query || payload.search || payload.term || payload.keyword || '');
  const qValue = normalizeNewsSearchText(payload.q || '');
  const qAsTicker = looksLikeSingleTickerQuery(qValue) ? normalizeTicker(qValue) : '';
  const freeTextQuery = rawSearch || (qValue && !qAsTicker ? qValue : '');
  const ticker = normalizeTicker(payload.ticker || payload.symbol || qAsTicker || symbols[0] || '');
  const limit = Math.max(1, Math.min(80, Number(payload.limit || payload.newsLimit || 32)));
  const timeoutMs = Number(payload.timeoutMs || payload.newsTimeoutMs || 3500);
  const articleTimeoutMs = Math.max(1000, Math.min(6000, Number(payload.articleTimeoutMs || 3200)));
  const includeArticleBody = String(payload.includeArticleBody ?? payload.full ?? 'false') === 'true';
  const assetOnly = ['true', '1', 'yes', 'on'].includes(String(payload.assetOnly ?? payload.strictAsset ?? payload.assetNewsOnly ?? 'false').trim().toLowerCase());
  const querySymbols = [ticker, ...symbols.filter(symbol => symbol !== ticker)].filter(Boolean).slice(0, 96);
  const eventTerms = '(fato relevante OR comunicado ao mercado OR CVM OR B3 OR dividendos OR JCP OR proventos OR resultado OR balanço OR rating OR recompra OR subscrição)';
  const strictTerms = [...querySymbols, freeTextQuery].map(quotedNewsTerm).filter(Boolean).slice(0, 16);
  const query = assetOnly && strictTerms.length
    ? `(${strictTerms.join(' OR ')}) (ação OR ações OR FII OR dividendos OR resultado OR comunicado OR mercado) when:7d`
    : freeTextQuery
    ? `(${freeTextQuery}) (ações OR dividendos OR B3 OR mercado financeiro Brasil) when:1d`
    : querySymbols.length
      ? `(${querySymbols.join(' OR ')}) ${eventTerms} when:2d`
      : '(mercado financeiro OR B3 OR ações OR dividendos OR Ibovespa) Brasil when:1d';
  const freshSuffix = (String(payload.refresh || payload.nocache || payload.bypassCache || 'false') === 'true') ? `&_fresh=${Date.now()}` : '';
  const url = googleNewsRssUrl(query, freshSuffix);
  let fetched = await fetchText(url, { timeoutMs, ttlMs: freshSuffix ? 0 : 2 * 60_000, staleMs: freshSuffix ? 0 : 45 * 60_000, headers: { Accept: 'application/rss+xml,text/xml,*/*' } });
  const recentWindowMs = (assetOnly ? 31 * 24 : 36) * 60 * 60 * 1000;
  const nowMs = Date.now();
  const recentItems = text => parseItems(text, Math.max(limit * 3, limit))
    .filter(item => {
      const ts = newsDateMs(item);
      return ts > 0 && ts <= nowMs + 10 * 60_000 && (nowMs - ts) <= recentWindowMs;
    });
  let items = recentItems(fetched.text);
  if (assetOnly) {
    items = items.filter(item => matchesStrictAssetItem(item, { querySymbols, freeTextQuery }));
  }
  let targetedRetry = false;

  // Notícias de um ativo não devem desaparecer só porque não houve publicação nas
  // últimas 36 horas. Quando a busca estrita fica vazia, repetimos apenas para o
  // mesmo ticker/nome em uma janela maior; nunca substituímos por notícias gerais.
  if (!items.length && assetOnly && strictTerms.length) {
    targetedRetry = true;
    const retryQuery = `(${strictTerms.join(' OR ')}) when:30d`;
    const retryFetched = await fetchText(googleNewsRssUrl(retryQuery, freshSuffix), {
      timeoutMs: Math.max(timeoutMs, 4200),
      ttlMs: freshSuffix ? 0 : 2 * 60_000,
      staleMs: freshSuffix ? 0 : 45 * 60_000,
      headers: { Accept: 'application/rss+xml,text/xml,*/*' }
    });
    const retryItems = recentItems(retryFetched.text)
      .filter(item => matchesStrictAssetItem(item, { querySymbols, freeTextQuery }));
    items = uniqueNewsItems([...items, ...retryItems]);
    if (retryItems.length || !fetched.text) fetched = retryFetched;
  }

  // Uma consulta muito específica da carteira pode não retornar itens mesmo com o RSS ativo.
  // Tente uma fonte mais ampla antes de declarar o feed vazio; nunca transforme um link de
  // busca em notícia sintética, pois isso polui a Home e as notificações.
  if (!items.length && (querySymbols.length || freeTextQuery) && !assetOnly) {
    const broadQuery = '(mercado financeiro OR B3 OR ações OR dividendos OR Ibovespa) Brasil when:1d';
    const broadUrl = googleNewsRssUrl(broadQuery, freshSuffix);
    const broadFetched = await fetchText(broadUrl, { timeoutMs: Math.max(timeoutMs, 4200), ttlMs: freshSuffix ? 0 : 2 * 60_000, staleMs: freshSuffix ? 0 : 45 * 60_000, headers: { Accept: 'application/rss+xml,text/xml,*/*' } });
    const broadItems = recentItems(broadFetched.text);
    if (broadItems.length) {
      items = broadItems;
      fetched = broadFetched;
    }
  }

  const fallbackUrl = `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  const enriched = includeArticleBody && items.length
    ? await Promise.all(items.map(item => enrichArticle(item, { timeoutMs: articleTimeoutMs })))
    : items;
  items = assetOnly
    ? enriched.filter(item => matchesStrictAssetItem(item, { querySymbols, freeTextQuery }))
    : enriched;
  const normalizedItems = sortNewsNewestFirst(
    items.map(item => attachNewsMetadata(item, { querySymbols, freeTextQuery }))
  ).slice(0, limit).map(item => withSourceBranding({
    ...item,
    url: item.url || item.link || '',
    originalUrl: item.originalUrl || item.url || item.link || '',
    openInBrowser: true,
    inAppReader: false
  }));
  return {
    status: items.length ? 'OK' : 'EMPTY',
    endpoint: 'news',
    source: 'VALORAE Notícias',
    ticker,
    symbols,
    query: freeTextQuery || query,
    search: freeTextQuery || undefined,
    searchQuery: freeTextQuery || undefined,
    searchUrl: fallbackUrl,
    sortedBy: 'publishedAt_desc',
    asOf: new Date().toISOString(),
    freshnessPolicy: {
      source: 'Google News RSS',
      cacheTtlSeconds: freshSuffix ? 0 : 120,
      staleSeconds: freshSuffix ? 0 : 2700,
      newestFirst: true,
      queryWindow: assetOnly ? (targetedRetry ? 'when:30d' : 'when:7d') : 'when:1d',
      maxAgeHours: assetOnly ? 31 * 24 : 36
    },
    items: normalizedItems,
    news: normalizedItems,
    articles: normalizedItems,
    articleExtraction: includeArticleBody ? 'enabled' : 'disabled',
    assetOnly,
    diagnostics: {
      requestedSymbols: querySymbols,
      requestedName: freeTextQuery || '',
      strictTerms: strictTerms.map(term => term.replace(/^"|"$/g, '')),
      targetedRetry,
      broadFallbackUsed: !assetOnly && fetched?.url !== url
    },
    openPolicy: { preferredClientAction: 'OPEN_ORIGINAL_URL_IN_BROWSER', requiresInAppReader: false },
    cacheStatus: fetched.cacheStatus,
    statusCode: fetched.status,
    error: fetched.error,
    partial: !items.length || items.some(item => item.articleStatus && item.articleStatus !== 'full')
  };
}
