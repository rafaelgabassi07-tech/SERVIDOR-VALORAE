import { createHash } from 'node:crypto';
import { classifyTicker, investidor10PageTypes, normalizeTicker } from '../core/tickers.js';
import { fetchText } from '../sources/fetch.js';
import { fetchYahooLogo } from './yahoo.js';

export const OFFICIAL_ASSET_LOGO_VERSION = 'official-asset-logo-v4';

const LOGO_CACHE_TTL_MS = Number(process.env.VALORAE_ASSET_LOGO_TTL_MS || 24 * 60 * 60 * 1000);
const LOGO_CACHE_STALE_MS = Number(process.env.VALORAE_ASSET_LOGO_STALE_MS || 7 * 24 * 60 * 60 * 1000);
const LOGO_MISS_TTL_MS = Number(process.env.VALORAE_ASSET_LOGO_MISS_TTL_MS || 5 * 60 * 1000);
const LOGO_CACHE_MAX = 600;
const MIN_IMAGE_BYTES = 256;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const logoImageCache = globalThis.__VALORAE_OFFICIAL_LOGO_IMAGE_CACHE_V4__ || new Map();
globalThis.__VALORAE_OFFICIAL_LOGO_IMAGE_CACHE_V4__ = logoImageCache;

function cacheGet(key, { allowStale = false } = {}) {
  const row = logoImageCache.get(key);
  if (!row) return null;
  const now = Date.now();
  if (now > row.staleUntil) {
    logoImageCache.delete(key);
    return null;
  }
  if (!allowStale && now > row.expiresAt) return null;
  logoImageCache.delete(key);
  logoImageCache.set(key, row);
  return { ...row.value, cache: now <= row.expiresAt ? 'HIT' : 'STALE' };
}

function cachePut(key, value, { ttlMs = LOGO_CACHE_TTL_MS, staleMs = LOGO_CACHE_STALE_MS } = {}) {
  const now = Date.now();
  logoImageCache.delete(key);
  logoImageCache.set(key, {
    value,
    expiresAt: now + Math.max(1, ttlMs),
    staleUntil: now + Math.max(ttlMs, staleMs)
  });
  while (logoImageCache.size > LOGO_CACHE_MAX) {
    const oldest = logoImageCache.keys().next().value;
    logoImageCache.delete(oldest);
  }
}

function assetLogoCacheKey(ticker) {
  return `${OFFICIAL_ASSET_LOGO_VERSION}:${normalizeTicker(ticker)}`;
}

function logoTokenMismatch(haystack = '', ticker = '') {
  const text = String(haystack || '').toUpperCase();
  const currentBase = normalizeTicker(ticker).replace(/\d+$/, '');
  const knownBases = ['PETR', 'VALE', 'ITUB', 'BBDC', 'BBAS', 'ABEV', 'WEGE', 'PRIO', 'VBBR', 'UGPA', 'CSAN', 'BRAV', 'RECV', 'CMIN', 'GGBR', 'GOAU', 'USIM', 'CSNA', 'SUZB', 'KLBN'];
  return knownBases.some(base => base !== currentBase && new RegExp(`(?:^|[^A-Z])${base}\\d{0,2}(?:[^A-Z0-9]|$)`, 'i').test(text));
}

function isGenericLogoDescriptor(value = '') {
  return /(?:avatar|user|banner|placeholder|sprite|favicon|apple-touch|qrcode|qr-code|patrimonio-campeao|minha-carteira|logo(?:[_-]?default)?\.(?:png|webp|jpe?g|gif|svg)(?:$|[?#]))/i.test(String(value || ''));
}

function trustedLogoHost(hostname = '', pageHost = '') {
  const host = String(hostname || '').toLowerCase();
  const page = String(pageHost || '').toLowerCase();
  if (!host) return false;
  if (page && (host === page || host.endsWith(`.${page}`))) return true;
  return [
    'investidor10.com.br',
    'statusinvest.com.br',
    'brapi.dev',
    'yimg.com',
    'cloudfront.net',
    'amazonaws.com',
    'googleusercontent.com',
    'gstatic.com',
    'tradingview.com'
  ].some(suffix => host === suffix || host.endsWith(`.${suffix}`));
}

function normalizeLogoUrl(raw = '', pageUrl = '') {
  const value = String(raw || '').trim().replace(/&amp;/g, '&');
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) return '';
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value, pageUrl || 'https://investidor10.com.br/');
    if (url.protocol !== 'https:') return '';
    const pageHost = pageUrl ? new URL(pageUrl).hostname : '';
    if (!trustedLogoHost(url.hostname, pageHost)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function decodeHtml(value = '') {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function tagAttribute(tag = '', name = '') {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  if (quoted) return decodeHtml(quoted[2]);
  const bare = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*([^\\s>]+)`, 'i'));
  return decodeHtml(bare?.[1] || '');
}

function firstSrcSetUrl(value = '') {
  return String(value || '').split(',')[0]?.trim().split(/\s+/)[0] || '';
}

export function extractInvestidor10LogoCandidates(html = '', pageUrl = '', ticker = '') {
  const symbol = normalizeTicker(ticker);
  if (!symbol) return [];
  const base = symbol.replace(/\d+$/, '');
  const candidates = new Map();
  const add = (raw, descriptor = '', baseScore = 0) => {
    const url = normalizeLogoUrl(raw, pageUrl);
    if (!url) return;
    const identity = `${descriptor} ${url}`;
    if (logoTokenMismatch(identity, symbol)) return;
    let score = baseScore;
    if (new RegExp(symbol, 'i').test(identity)) score += 120;
    if (base && new RegExp(base, 'i').test(identity)) score += 70;
    if (/logo|company|empresa|fundo|ticker/i.test(identity)) score += 36;
    if (/header|profile|brand/i.test(identity)) score += 12;
    if (isGenericLogoDescriptor(identity) && !new RegExp(`${symbol}|${base}`, 'i').test(identity)) score -= 180;
    if (score <= 0) return;
    const previous = candidates.get(url);
    if (!previous || score > previous.score) candidates.set(url, { url, score });
  };

  for (const match of String(html || '').matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const descriptor = [
      tagAttribute(tag, 'alt'), tagAttribute(tag, 'title'), tagAttribute(tag, 'class'),
      tagAttribute(tag, 'id'), tagAttribute(tag, 'data-ticker')
    ].filter(Boolean).join(' ');
    const sources = [
      tagAttribute(tag, 'data-src'), tagAttribute(tag, 'data-lazy-src'),
      tagAttribute(tag, 'data-original'), tagAttribute(tag, 'src'),
      firstSrcSetUrl(tagAttribute(tag, 'srcset'))
    ];
    for (const source of sources) add(source, descriptor, 18);
  }

  for (const match of String(html || '').matchAll(/<(?:meta|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const descriptor = `${tagAttribute(tag, 'property')} ${tagAttribute(tag, 'name')} ${tagAttribute(tag, 'rel')}`;
    if (!/image|logo/i.test(descriptor)) continue;
    add(tagAttribute(tag, 'content') || tagAttribute(tag, 'href'), descriptor, /logo/i.test(descriptor) ? 42 : 6);
  }

  for (const match of String(html || '').matchAll(/["'](?:logoUrl|logo_url|companyLogoUrl|company_logo_url|logo)["']\s*:\s*["']([^"']+)["']/gi)) {
    add(match[1], 'structured logo company ticker', 52);
  }

  return [...candidates.values()]
    .sort((a, b) => b.score - a.score)
    .map(item => item.url)
    .slice(0, 8);
}

function sniffImage(bytes, contentType = '') {
  if (!Buffer.isBuffer(bytes) || bytes.length < MIN_IMAGE_BYTES || bytes.length > MAX_IMAGE_BYTES) return null;
  let detected = '';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) detected = 'image/png';
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) detected = 'image/jpeg';
  else if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') detected = 'image/webp';
  else if (bytes.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/)) detected = 'image/gif';
  const normalizedHeader = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (!detected && ['image/png','image/jpeg','image/jpg','image/webp','image/gif'].includes(normalizedHeader)) detected = normalizedHeader === 'image/jpg' ? 'image/jpeg' : normalizedHeader;
  if (!detected || detected === 'image/svg+xml') return null;

  let width = 0;
  let height = 0;
  if (detected === 'image/png' && bytes.length >= 24) {
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
  } else if (detected === 'image/gif' && bytes.length >= 10) {
    width = bytes.readUInt16LE(6);
    height = bytes.readUInt16LE(8);
  }
  if ((width && width < 12) || (height && height < 12)) return null;
  return { contentType: detected, width, height };
}

async function fetchImageCandidate(url, { timeoutMs = 2400, source = '', ticker = '' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(700, Math.min(Number(timeoutMs) || 2400, 7000)));
  try {
    const headers = {
      Accept: 'image/avif,image/webp,image/apng,image/png,image/jpeg,image/gif,image/*,*/*;q=0.7',
      'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'
    };
    if (url.includes('investidor10.com.br')) headers.Referer = 'https://investidor10.com.br/';
    else if (url.includes('statusinvest.com.br')) headers.Referer = 'https://statusinvest.com.br/';
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers
    });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    const image = sniffImage(bytes, response.headers.get('content-type') || '');
    if (!image) return null;
    return {
      ok: true,
      ticker: normalizeTicker(ticker),
      bytes,
      contentType: image.contentType,
      width: image.width || undefined,
      height: image.height || undefined,
      sourceUrl: response.url || url,
      source,
      fingerprint: createHash('sha256').update(bytes).digest('hex').slice(0, 20)
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function officialStatusInvestLogoCandidates(value = '') {
  const ticker = normalizeTicker(value);
  if (!ticker) return [];
  const kind = classifyTicker(ticker);
  const paths = kind === 'FII'
    ? ['fundos-imobiliarios', 'fii', 'acao', 'acoes']
    : kind === 'ETF'
      ? ['etfs', 'acao', 'acoes', 'fundos-imobiliarios']
      : kind === 'BDR'
        ? ['bdrs', 'acao', 'acoes']
        : ['acao', 'acoes', 'bdrs', 'fundos-imobiliarios'];
  return paths.map(path => `https://statusinvest.com.br/${path}/companytickerimage?ticker=${encodeURIComponent(ticker)}`);
}

export async function fetchOfficialStatusInvestLogo(value = '', { timeoutMs = 2400, cache = true } = {}) {
  const ticker = normalizeTicker(value);
  if (!ticker) return null;
  const candidates = officialStatusInvestLogoCandidates(ticker);
  const perCandidate = Math.max(700, Math.floor((Number(timeoutMs) || 2400) / Math.min(2, candidates.length || 1)));
  for (const url of candidates) {
    const result = await fetchImageCandidate(url, { timeoutMs: perCandidate, source: 'Status Invest company ticker image', ticker });
    if (result) return { ...result, cache: cache ? 'MISS' : 'BYPASS' };
  }
  return null;
}

async function fetchBrapiLogo(value = '', { timeoutMs = 2600 } = {}) {
  const ticker = normalizeTicker(value);
  if (!ticker) return null;
  const token = String(process.env.VALORAE_BRAPI_TOKEN || process.env.BRAPI_TOKEN || '').trim();
  const url = new URL(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`);
  url.searchParams.set('fundamental', 'false');
  url.searchParams.set('dividends', 'false');
  if (token) url.searchParams.set('token', token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(900, Math.min(Number(timeoutMs) || 2600, 7000)));
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': process.env.VALORAE_USER_AGENT || 'VALORAE Proxy' }
    });
    if (!response.ok) return null;
    const json = await response.json();
    const row = Array.isArray(json?.results) ? json.results.find(item => normalizeTicker(item?.symbol) === ticker) || json.results[0] : null;
    const logoUrl = normalizeLogoUrl(row?.logourl || row?.logoUrl || row?.logo_url || row?.companyLogoUrl || '', url.toString());
    if (!logoUrl) return null;
    return fetchImageCandidate(logoUrl, { timeoutMs: Math.max(900, Math.floor((Number(timeoutMs) || 2600) * 0.7)), source: 'brapi.dev official asset logo', ticker });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchInvestidor10Logo(value = '', { timeoutMs = 3600 } = {}) {
  const ticker = normalizeTicker(value);
  if (!ticker) return null;
  const pageTypes = investidor10PageTypes(ticker);
  const pageBudget = Math.max(1000, Math.floor((Number(timeoutMs) || 3600) * 0.58));
  for (const type of pageTypes.slice(0, 3)) {
    const pageUrl = `https://investidor10.com.br/${type}/${ticker.toLowerCase()}/`;
    const page = await fetchText(pageUrl, {
      timeoutMs: pageBudget,
      ttlMs: 12 * 60 * 60 * 1000,
      staleMs: 48 * 60 * 60 * 1000,
      retries: 0,
      headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }
    });
    if (!page?.text || Number(page.status || 0) >= 400) continue;
    const candidates = extractInvestidor10LogoCandidates(page.text, page.finalUrl || pageUrl, ticker);
    for (const candidate of candidates.slice(0, 3)) {
      const result = await fetchImageCandidate(candidate, {
        timeoutMs: Math.max(900, Math.floor((Number(timeoutMs) || 3600) * 0.42)),
        source: `Investidor10 ${type} official logo`,
        ticker
      });
      if (result) return result;
    }
  }
  return null;
}

async function fetchYahooLogoImage(value = '', { timeoutMs = 2600 } = {}) {
  const ticker = normalizeTicker(value);
  const metadata = await fetchYahooLogo(ticker, { timeoutMs, cache: true }).catch(() => null);
  if (!metadata?.logoUrl) return null;
  return fetchImageCandidate(metadata.logoUrl, { timeoutMs: Math.max(900, Math.floor((Number(timeoutMs) || 2600) * 0.7)), source: metadata.source || 'Yahoo Finance Quote API', ticker });
}


function settleWithin(promise, timeoutMs) {
  return Promise.race([
    Promise.resolve(promise).catch(() => null),
    new Promise(resolve => setTimeout(() => resolve(null), Math.max(500, Number(timeoutMs) || 500)))
  ]);
}

export async function fetchOfficialAssetLogo(value = '', { timeoutMs = 6500, cache = true } = {}) {
  const ticker = normalizeTicker(value);
  if (!ticker) return null;
  const key = assetLogoCacheKey(ticker);
  if (cache) {
    const hit = cacheGet(key);
    if (hit) return hit.ok === false ? null : hit;
  }
  if (process.env.VALORAE_DISABLE_EXTERNAL === '1') {
    const stale = cache ? cacheGet(key, { allowStale: true }) : null;
    return stale?.ok === false ? null : stale;
  }

  const total = Math.max(2400, Math.min(Number(timeoutMs) || 6500, 9000));
  const providerBudget = Math.max(1600, Math.floor(total * 0.72));
  const tasks = [
    fetchInvestidor10Logo(ticker, { timeoutMs: providerBudget }),
    fetchBrapiLogo(ticker, { timeoutMs: providerBudget }),
    fetchYahooLogoImage(ticker, { timeoutMs: providerBudget }),
    fetchOfficialStatusInvestLogo(ticker, { timeoutMs: providerBudget, cache: false })
  ];
  const results = await Promise.all(tasks.map(task => settleWithin(task, total - 120)));
  // Preferimos a imagem extraída da página oficial do ativo, depois o agregador B3,
  // Yahoo e, por último, o endpoint legado do Status Invest.
  const resolved = results.find(Boolean) || null;
  if (resolved?.bytes?.length) {
    const valueToCache = { ...resolved, ok: true, ticker, contractVersion: OFFICIAL_ASSET_LOGO_VERSION, cache: 'MISS' };
    if (cache) cachePut(key, valueToCache);
    return valueToCache;
  }

  const stale = cache ? cacheGet(key, { allowStale: true }) : null;
  if (stale?.bytes?.length) return { ...stale, cache: 'STALE_IF_ERROR' };
  if (cache) cachePut(key, { ok: false, ticker, contractVersion: OFFICIAL_ASSET_LOGO_VERSION }, { ttlMs: LOGO_MISS_TTL_MS, staleMs: LOGO_MISS_TTL_MS });
  return null;
}

export function clearOfficialAssetLogoCache() {
  logoImageCache.clear();
}
