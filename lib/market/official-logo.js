import { classifyTicker, normalizeTicker } from '../core/tickers.js';

const LOGO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LOGO_CACHE_MAX = 192;
const logoImageCache = globalThis.__VALORAE_OFFICIAL_LOGO_IMAGE_CACHE__ || new Map();
globalThis.__VALORAE_OFFICIAL_LOGO_IMAGE_CACHE__ = logoImageCache;

function cacheGet(key) {
  const row = logoImageCache.get(key);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    logoImageCache.delete(key);
    return null;
  }
  logoImageCache.delete(key);
  logoImageCache.set(key, row);
  return row;
}

function cachePut(key, value) {
  logoImageCache.delete(key);
  logoImageCache.set(key, { ...value, expiresAt: Date.now() + LOGO_CACHE_TTL_MS });
  while (logoImageCache.size > LOGO_CACHE_MAX) {
    const oldest = logoImageCache.keys().next().value;
    logoImageCache.delete(oldest);
  }
}

export function officialStatusInvestLogoCandidates(value = '') {
  const ticker = normalizeTicker(value);
  if (!ticker) return [];
  const kind = classifyTicker(ticker);
  const paths = kind === 'FII'
    ? ['fundos-imobiliarios', 'acao']
    : ['acao', 'fundos-imobiliarios'];
  return paths.map(path => `https://statusinvest.com.br/${path}/companytickerimage?ticker=${encodeURIComponent(ticker)}`);
}

async function fetchCandidate(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',
        Referer: 'https://statusinvest.com.br/'
      }
    });
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok || !contentType.startsWith('image/')) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 256 || bytes.length > 2 * 1024 * 1024) return null;
    return { bytes, contentType: contentType.split(';')[0], sourceUrl: url, source: 'Status Invest company ticker image' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOfficialStatusInvestLogo(value = '', { timeoutMs = 2400, cache = true } = {}) {
  const ticker = normalizeTicker(value);
  if (!ticker) return null;
  const key = ticker.toUpperCase();
  if (cache) {
    const cached = cacheGet(key);
    if (cached) return { ...cached, cache: 'HIT' };
  }
  const candidates = officialStatusInvestLogoCandidates(ticker);
  for (const url of candidates) {
    const result = await fetchCandidate(url, timeoutMs);
    if (!result) continue;
    if (cache) cachePut(key, result);
    return { ...result, cache: 'MISS' };
  }
  return null;
}
