// Mecanismo próprio do VALORAE Proxy para rankings do Investidor10.
// Inspirado no comportamento do AeroScraper, mas sem depender do AeroScrape:
// 1) páginas dedicadas /acoes/rankings/maiores-altas e /maiores-baixas;
// 2) fallback para blocos da home Maiores Altas/Baixas;
// 3) contrato estável para o APK: rankings.altas/baixas + aliases.

export const INVESTIDOR10_RANKINGS_VERSION = '21.12.59-valorae-i10-rankings-complete';

const CACHE_TTL_MS = Number(process.env.VALORAE_I10_RANKINGS_CACHE_TTL_MS || 15 * 60 * 1000);
const CACHE_STALE_MS = Number(process.env.VALORAE_I10_RANKINGS_CACHE_STALE_MS || 60 * 60 * 1000);
const DEFAULT_LIMIT = Number(process.env.VALORAE_I10_RANKINGS_LIMIT || 15);
const DEFAULT_COMPLETE_MIN = Number(process.env.VALORAE_I10_RANKINGS_COMPLETE_MIN || 6);
const cache = new Map();
const inflight = new Map();

const PAGES = Object.freeze({
  altas: 'https://investidor10.com.br/acoes/rankings/maiores-altas/',
  baixas: 'https://investidor10.com.br/acoes/rankings/maiores-baixas/',
  home: 'https://investidor10.com.br/',
  acoes: 'https://investidor10.com.br/acoes/',
});

function stripTags(input = '') {
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<\/tr>/gi, ' || ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePercentDisplay(raw = '') {
  const s = String(raw || '').replace(/\s+/g, '').trim();
  if (!s) return '';
  return s.endsWith('%') ? s : `${s}%`;
}

function parsePercentDisplay(raw = '') {
  const text = stripTags(raw);
  const matches = [...text.matchAll(/[+-]?\d{1,4}(?:\.\d{3})*(?:,\d{1,3})?\s*%|[+-]?\d+(?:\.\d+)?\s*%/g)]
    .map(m => normalizePercentDisplay(m[0]));
  if (!matches.length) return '';
  const signed = matches.find(v => /^[+-]/.test(v));
  return signed || matches[matches.length - 1] || matches[0];
}

function parseMoneyDisplay(raw = '') {
  const text = stripTags(raw);
  const matches = [...text.matchAll(/R\$\s*[+-]?\d{1,3}(?:\.\d{3})*(?:,\d{1,4})?|[+-]?\d{1,3}(?:\.\d{3})*,\d{2}/g)]
    .map(m => String(m[0]).replace(/\s+/g, ' ').trim());
  if (!matches.length) return '';
  const money = matches.find(v => /^R\$/i.test(v)) || matches[0];
  return /^R\$/i.test(money) ? money : `R$ ${money}`;
}

function parsePtNumber(raw = '') {
  if (raw === undefined || raw === null || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  let s = String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/R\$|US\$|%/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!s || /^[-—–]+$/.test(s)) return 0;
  const negative = /^-/.test(s);
  s = s.replace(/^[+-]/, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? (negative ? -n : n) : 0;
}

function canonicalTicker(raw = '') {
  const m = String(raw || '').toUpperCase().match(/\b[A-Z]{4}\d{1,2}F?\b/);
  return m ? m[0] : '';
}

function isTicker(value = '') {
  return /^[A-Z]{4}\d{1,2}F?$/.test(String(value || '').toUpperCase());
}

function tickerFromHref(fragment = '') {
  const m = String(fragment || '').match(/\/(?:acoes|fiis|fiagros|etfs|bdrs)\/([a-z0-9]{5,7}f?)\/?/i);
  return canonicalTicker(m?.[1] || '');
}

function extractHref(fragment = '', ticker = '') {
  const lower = String(ticker || '').toLowerCase();
  const specific = lower
    ? new RegExp(`<a\\b[^>]*href=["']([^"']*\\/(?:acoes|fiis|fiagros|etfs|bdrs)\\/${lower}\\/?[^"']*)["']`, 'i').exec(fragment)
    : null;
  const generic = specific || /<a\b[^>]*href=["']([^"']*\/(?:acoes|fiis|fiagros|etfs|bdrs)\/[a-z0-9]{5,7}f?\/?[^"']*)["']/i.exec(fragment);
  if (!generic?.[1]) return '';
  const href = generic[1].trim();
  if (/^https?:\/\//i.test(href)) return href;
  return `https://investidor10.com.br${href.startsWith('/') ? href : `/${href}`}`;
}

function nameFromFragment(fragment = '', ticker = '') {
  const text = stripTags(fragment)
    .replace(/\|/g, ' ')
    .replace(/\|\|/g, ' ')
    .replace(new RegExp(`\\b${String(ticker || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ')
    .replace(/#?\d{1,3}/g, ' ')
    .replace(/R\$\s*[\d.,]+/gi, ' ')
    .replace(/[+-]?\d{1,4}(?:[.,]\d{1,3})?\s*%/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const candidate = text.split(' | ').map(s => s.trim()).filter(Boolean).find(s => !isTicker(s) && !/^(preço|cotação|variação|ticker|ativo)$/i.test(s));
  return candidate && candidate.length <= 90 ? candidate : '';
}

function makeRankingItem({ fragment = '', ticker = '', direction = '', rank = 0, sourceUrl = '' } = {}) {
  const safeTicker = canonicalTicker(ticker) || tickerFromHref(fragment) || canonicalTicker(stripTags(fragment));
  if (!safeTicker) return null;
  const variacao = parsePercentDisplay(fragment);
  const preco = parseMoneyDisplay(fragment);
  const changePercent = parsePtNumber(variacao);
  const price = parsePtNumber(preco);
  const url = extractHref(fragment, safeTicker) || sourceUrl || `https://investidor10.com.br/acoes/${safeTicker.toLowerCase()}/`;
  const nome = nameFromFragment(fragment, safeTicker);
  return {
    rank: Number(rank) > 0 ? Number(rank) : undefined,
    ticker: safeTicker,
    nome: nome || undefined,
    name: nome || undefined,
    variacao,
    changeDisplay: variacao,
    variationDisplay: variacao,
    changePercent,
    value: changePercent,
    displayValue: variacao,
    preco,
    priceDisplay: preco,
    price,
    direction,
    source: 'Investidor10',
    url,
  };
}

function uniqueRows(rows = [], limit = DEFAULT_LIMIT) {
  const seen = new Set();
  const out = [];
  for (const raw of rows || []) {
    if (!raw) continue;
    const ticker = canonicalTicker(raw.ticker);
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    const rank = raw.rank && Number(raw.rank) > 0 ? Number(raw.rank) : out.length + 1;
    out.push({ ...raw, ticker, rank });
    if (out.length >= limit) break;
  }
  return out;
}

function extractRows(html = '') {
  const rows = [];
  const source = String(html || '');
  const trRe = /<tr\b[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = trRe.exec(source))) rows.push(m[0]);
  return rows;
}

function extractCardsByLinks(html = '', type = 'acoes') {
  const source = String(html || '');
  const re = new RegExp(`<a\\b[^>]*href=["'][^"']*\\/${type}\\/[a-z0-9]{5,7}f?\\/?[^"']*["'][^>]*>[\\s\\S]*?<\\/a>`, 'gi');
  return source.match(re) || [];
}

function parseRankedPageHtml(html = '', direction = 'alta', limit = DEFAULT_LIMIT, sourceUrl = '') {
  const candidates = [];
  for (const row of extractRows(html)) {
    const ticker = tickerFromHref(row) || canonicalTicker(stripTags(row));
    if (!ticker) continue;
    const item = makeRankingItem({ fragment: row, ticker, direction, sourceUrl });
    if (item) candidates.push(item);
  }

  if (candidates.length < Math.min(3, limit)) {
    for (const card of extractCardsByLinks(html, 'acoes')) {
      const ticker = tickerFromHref(card) || canonicalTicker(stripTags(card));
      if (!ticker) continue;
      const item = makeRankingItem({ fragment: card, ticker, direction, sourceUrl });
      if (item) candidates.push(item);
    }
  }

  const sorted = uniqueRows(candidates, limit);
  return sorted.map((item, i) => ({ ...item, rank: i + 1 }));
}

function lowerNoAccent(value = '') {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findSectionByNeedles(html = '', startNeedles = [], endNeedles = [], maxChars = 24000) {
  const source = String(html || '');
  const lower = lowerNoAccent(source);
  let start = -1;
  for (const needle of startNeedles) {
    const idx = lower.indexOf(lowerNoAccent(needle));
    if (idx >= 0 && (start < 0 || idx < start)) start = idx;
  }
  if (start < 0) return '';
  let end = -1;
  for (const needle of endNeedles) {
    const idx = lower.indexOf(lowerNoAccent(needle), start + 10);
    if (idx > start && (end < 0 || idx < end)) end = idx;
  }
  if (end < 0 || end - start > maxChars) end = Math.min(source.length, start + maxChars);
  return source.slice(start, end);
}

function parseHomeSectionsHtml(html = '', limit = DEFAULT_LIMIT) {
  const altasSection = findSectionByNeedles(html, ['maioresAltas', 'Maiores Altas', 'maiores altas'], ['maioresBaixas', 'Maiores Baixas', 'maiores baixas', '<footer']);
  const baixasSection = findSectionByNeedles(html, ['maioresBaixas', 'Maiores Baixas', 'maiores baixas'], ['mais negociadas', 'maiores altas do dia', '<footer']);
  let altas = parseRankedPageHtml(altasSection || html, 'alta', limit, PAGES.home);
  let baixas = parseRankedPageHtml(baixasSection || html, 'baixa', limit, PAGES.home);

  // Fallback final: quando a home mudou e só há links + percentuais soltos,
  // separa por sinal de variação sem inventar valores.
  if (!altas.length || !baixas.length) {
    const all = parseRankedPageHtml(html, 'unknown', limit * 3, PAGES.home)
      .filter(r => r.variacao || r.preco);
    if (!altas.length) altas = uniqueRows(all.filter(r => Number(r.changePercent) >= 0).sort((a, b) => Number(b.changePercent) - Number(a.changePercent)).map(r => ({ ...r, direction: 'alta' })), limit);
    if (!baixas.length) baixas = uniqueRows(all.filter(r => Number(r.changePercent) < 0).sort((a, b) => Number(a.changePercent) - Number(b.changePercent)).map(r => ({ ...r, direction: 'baixa' })), limit);
  }

  return {
    altas: altas.map((item, i) => ({ ...item, rank: i + 1 })),
    baixas: baixas.map((item, i) => ({ ...item, rank: i + 1 })),
  };
}

function hasCompleteFields(item) {
  return Boolean(item?.ticker && item?.variacao && item?.preco);
}

function listCompleteness(items = [], expected = DEFAULT_COMPLETE_MIN) {
  const rows = Array.isArray(items) ? items : [];
  const completeRows = rows.filter(hasCompleteFields).length;
  return {
    expectedMin: expected,
    count: rows.length,
    completeRows,
    missingRows: Math.max(0, expected - completeRows),
    complete: completeRows >= expected,
    missingFields: rows
      .filter(item => !hasCompleteFields(item))
      .slice(0, 8)
      .map(item => ({ ticker: item?.ticker || '', missing: ['variacao','preco'].filter(k => !item?.[k]) })),
  };
}

function buildCompleteness(rankings, { minRows = DEFAULT_COMPLETE_MIN, strict = false, strategy = 'unknown' } = {}) {
  const altas = listCompleteness(rankings?.altas || [], minRows);
  const baixas = listCompleteness(rankings?.baixas || [], minRows);
  const complete = altas.complete && baixas.complete;
  return {
    version: INVESTIDOR10_RANKINGS_VERSION,
    strategy,
    strict,
    minRows,
    complete,
    partial: !complete,
    altas,
    baixas,
    rule: 'Completo exige ticker, variação e preço para pelo menos minRows em altas e baixas. Não inventa dados ausentes.',
  };
}

function withAliases(rankings = {}) {
  const altas = rankings.altas || [];
  const baixas = rankings.baixas || [];
  return {
    altas,
    baixas,
    maioresAltas: altas,
    maioresBaixas: baixas,
    highs: altas,
    lows: baixas,
    gainers: altas,
    losers: baixas,
    topGainers: altas,
    topLosers: baixas,
  };
}

async function fetchHtml(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
        'Cache-Control': 'no-cache',
        'Referer': 'https://investidor10.com.br/',
      },
    });
    const html = await res.text();
    return { ok: res.ok, status: res.status, url, finalUrl: res.url || url, html, length: html.length, elapsedMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAndParsePage(key, url, direction, { timeoutMs, limit }) {
  const fetched = await fetchHtml(url, timeoutMs);
  const attempt = { key, url, ok: fetched.ok, status: fetched.status, length: fetched.length, elapsedMs: fetched.elapsedMs };
  if (!fetched.ok) return { key, rows: [], attempt, error: `Investidor10 HTTP ${fetched.status}` };
  const rows = parseRankedPageHtml(fetched.html, direction, limit, url);
  return { key, rows, attempt: { ...attempt, parsedRows: rows.length }, html: fetched.html };
}

async function scrapeDedicatedRankingPages({ timeoutMs, limit }) {
  const [altasRes, baixasRes] = await Promise.all([
    fetchAndParsePage('altas-page', PAGES.altas, 'alta', { timeoutMs, limit }),
    fetchAndParsePage('baixas-page', PAGES.baixas, 'baixa', { timeoutMs, limit }),
  ]);
  return {
    rankings: { altas: altasRes.rows || [], baixas: baixasRes.rows || [] },
    attempts: [altasRes.attempt, baixasRes.attempt],
    errors: [altasRes.error, baixasRes.error].filter(Boolean),
  };
}

async function scrapeHomeRankingSections({ timeoutMs, limit }) {
  const attempts = [];
  const errors = [];
  for (const [key, url] of [['home', PAGES.home], ['acoes-home', PAGES.acoes]]) {
    try {
      const fetched = await fetchHtml(url, timeoutMs);
      const attempt = { key, url, ok: fetched.ok, status: fetched.status, length: fetched.length, elapsedMs: fetched.elapsedMs };
      if (!fetched.ok) {
        attempts.push(attempt);
        errors.push(`Investidor10 ${key} HTTP ${fetched.status}`);
        continue;
      }
      const rankings = parseHomeSectionsHtml(fetched.html, limit);
      attempts.push({ ...attempt, parsedAltas: rankings.altas.length, parsedBaixas: rankings.baixas.length });
      if (rankings.altas.length || rankings.baixas.length) return { rankings, attempts, errors };
      errors.push(`${key}: HTML recebido, mas rankings não encontrados.`);
    } catch (err) {
      attempts.push({ key, url, ok: false, error: err?.message || 'Erro desconhecido' });
      errors.push(err?.message || 'Erro desconhecido');
    }
  }
  return { rankings: { altas: [], baixas: [] }, attempts, errors };
}

function mergeRankingLists(primary = [], fallback = [], limit = DEFAULT_LIMIT) {
  return uniqueRows([...(primary || []), ...(fallback || [])], limit).map((item, i) => ({ ...item, rank: i + 1 }));
}

function createPayload({ ok, rankings, attempts, errors = [], cacheState = 'MISS', strategy = 'unknown', completeMode = false, minRows = DEFAULT_COMPLETE_MIN, warning = '', requestedLimit = DEFAULT_LIMIT } = {}) {
  const aliasedRankings = withAliases({
    altas: uniqueRows(rankings?.altas || [], requestedLimit),
    baixas: uniqueRows(rankings?.baixas || [], requestedLimit),
  });
  const completeness = buildCompleteness(aliasedRankings, { minRows, strict: completeMode, strategy });
  const partial = !completeness.complete;
  return {
    ok: Boolean(ok),
    status: ok ? (partial ? 'PARTIAL' : 'OK') : 'ERROR',
    partial,
    source: 'Investidor10RankingsHTML',
    version: INVESTIDOR10_RANKINGS_VERSION,
    generatedAt: new Date().toISOString(),
    strategy,
    completeMode: Boolean(completeMode),
    requestedLimit,
    rankings: aliasedRankings,
    completeness,
    attempts,
    errors: errors.filter(Boolean).slice(0, 12),
    warning: warning || (partial ? 'Rankings capturados parcialmente; campos ausentes não foram inventados.' : undefined),
    cache: cacheState,
  };
}

export function parseInvestidor10RankingsHtml(html = '', options = {}) {
  const limit = Number(options.limit || DEFAULT_LIMIT);
  const rankings = parseHomeSectionsHtml(html, limit);
  return withAliases(rankings);
}

export async function fetchInvestidor10Rankings({ timeoutMs = 9000, bypassCache = false, mode = 'auto', limit = DEFAULT_LIMIT, minRows = DEFAULT_COMPLETE_MIN, requireComplete = false } = {}) {
  const completeMode = requireComplete || ['complete','full','deep','precise','max'].includes(String(mode || '').toLowerCase());
  const safeLimit = Math.max(1, Math.min(Number(limit || DEFAULT_LIMIT), 30));
  const safeMinRows = Math.max(1, Math.min(Number(minRows || DEFAULT_COMPLETE_MIN), safeLimit));
  const effectiveTimeout = completeMode ? Math.max(Number(timeoutMs || 0), 14000) : Number(timeoutMs || 9000);
  const key = `i10-rankings-v3|${safeLimit}|${safeMinRows}|${completeMode ? 'complete' : 'auto'}`;
  const hit = cache.get(key);
  if (!bypassCache && hit && hit.expiresAt > Date.now()) return { ...hit.data, cache: 'HIT' };
  if (!bypassCache && inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    const attempts = [];
    const errors = [];
    let dedicated = { rankings: { altas: [], baixas: [] }, attempts: [], errors: [] };
    let fallback = { rankings: { altas: [], baixas: [] }, attempts: [], errors: [] };

    try {
      dedicated = await scrapeDedicatedRankingPages({ timeoutMs: effectiveTimeout, limit: safeLimit });
      attempts.push(...dedicated.attempts);
      errors.push(...dedicated.errors);
    } catch (err) {
      attempts.push({ key: 'dedicated-pages', ok: false, error: err?.message || 'Erro desconhecido' });
      errors.push(err?.message || 'Erro desconhecido');
    }

    const dedicatedCompleteness = buildCompleteness(dedicated.rankings, { minRows: safeMinRows, strict: completeMode, strategy: 'dedicated-pages' });
    const mustFallback = completeMode || !dedicated.rankings.altas.length || !dedicated.rankings.baixas.length || !dedicatedCompleteness.complete;
    if (mustFallback) {
      try {
        fallback = await scrapeHomeRankingSections({ timeoutMs: effectiveTimeout, limit: safeLimit });
        attempts.push(...fallback.attempts);
        errors.push(...fallback.errors);
      } catch (err) {
        attempts.push({ key: 'home-sections', ok: false, error: err?.message || 'Erro desconhecido' });
        errors.push(err?.message || 'Erro desconhecido');
      }
    }

    const rankings = {
      altas: mergeRankingLists(dedicated.rankings.altas, fallback.rankings.altas, safeLimit),
      baixas: mergeRankingLists(dedicated.rankings.baixas, fallback.rankings.baixas, safeLimit),
    };
    const completeness = buildCompleteness(rankings, { minRows: safeMinRows, strict: completeMode, strategy: mustFallback ? 'dedicated-pages+home-fallback' : 'dedicated-pages' });
    const hasAny = rankings.altas.length || rankings.baixas.length;
    const ok = hasAny && (!completeMode || completeness.complete || !requireComplete);
    const data = createPayload({
      ok: hasAny,
      rankings,
      attempts,
      errors,
      strategy: mustFallback ? 'dedicated-pages+home-fallback' : 'dedicated-pages',
      completeMode,
      minRows: safeMinRows,
      requestedLimit: safeLimit,
    });

    if (hasAny) {
      cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS, staleUntil: Date.now() + CACHE_TTL_MS + CACHE_STALE_MS });
      return { ...data, ok, cache: 'MISS' };
    }

    const stale = cache.get(key);
    if (!bypassCache && stale && stale.staleUntil > Date.now()) {
      return { ...stale.data, cache: 'STALE_IF_ERROR', warning: errors[0] || 'Rankings ao vivo indisponíveis; usando último snapshot real.', attempts };
    }

    return createPayload({
      ok: false,
      rankings: { altas: [], baixas: [] },
      attempts,
      errors,
      strategy: 'dedicated-pages+home-fallback',
      completeMode,
      minRows: safeMinRows,
      warning: errors[0] || 'Rankings indisponíveis no Investidor10.',
      requestedLimit: safeLimit,
    });
  })();

  inflight.set(key, promise);
  try { return await promise; } finally { inflight.delete(key); }
}
