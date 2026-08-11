import { fetchText } from '../sources/fetch.js';

export const VALORAE_B3_ETF_QUOTE_VERSION = '21.12.405-b3-bora-investir-etf-v1';
const TTL_MS = Number(process.env.VALORAE_B3_ETF_QUOTE_TTL_MS || 5 * 60 * 1000);
const STALE_MS = Number(process.env.VALORAE_B3_ETF_QUOTE_STALE_MS || 24 * 60 * 60 * 1000);

function decodeHtml(value = '') {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

function visibleText(html = '') {
  return decodeHtml(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function numberBR(value = '') {
  const raw = String(value || '').replace(/[^0-9,.-]/g, '');
  if (!raw) return Number.NaN;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const normalized = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  return Number(normalized);
}

function firstFiniteMatch(text, patterns = []) {
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (!match) continue;
    const value = numberBR(match[1]);
    if (Number.isFinite(value)) return value;
  }
  return Number.NaN;
}

export function parseB3EtfPublicQuote(html = '', ticker = 'IVVB11') {
  const code = String(ticker || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const text = visibleText(html);
  if (!code || !new RegExp(`\\b${code}\\b`, 'i').test(text)) {
    return { ok: false, ticker: code, error: 'Página B3 não confirma o ticker solicitado.' };
  }
  const price = firstFiniteMatch(text, [
    /Cota(?:ç|c)[oõ]es[\s\S]{0,160}?([0-9]{1,4}(?:\.[0-9]{3})*,[0-9]{2})[\s\S]{0,80}?Valor\s+atual/i,
    /Valor\s+atual(?:\s*\(R\$\))?[\s:–-]{0,20}([0-9]{1,4}(?:\.[0-9]{3})*,[0-9]{2})/i,
    /"(?:price|currentPrice|lastPrice)"\s*:\s*"?([0-9]+(?:[.,][0-9]+)?)/i
  ]);
  const variationPct = firstFiniteMatch(text, [
    /([+-]?[0-9]{1,3}(?:[.,][0-9]{1,2})?)%[\s\S]{0,45}?Renta\.\s*dia/i,
    /Renta\.\s*dia[\s:–-]{0,30}([+-]?[0-9]{1,3}(?:[.,][0-9]{1,2})?)%/i,
    /Rentabilidade\s+(?:do\s+)?dia[\s:–-]{0,30}([+-]?[0-9]{1,3}(?:[.,][0-9]{1,2})?)%/i
  ]);
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, ticker: code, error: 'Cotação B3 do ETF não encontrada no conteúdo público.' };
  }
  const previousClose = Number.isFinite(variationPct) && variationPct > -100
    ? Number((price / (1 + variationPct / 100)).toFixed(4))
    : undefined;
  return {
    ok: true,
    ticker: code,
    price,
    previousClose,
    variationPct: Number.isFinite(variationPct) ? Number(variationPct.toFixed(2)) : undefined,
    source: `B3 Oficial - Bora Investir ${code}`,
    official: true,
    simulated: false,
    proxyTickerUsed: false
  };
}

export async function fetchB3EtfPublicQuote(ticker = 'IVVB11', { timeoutMs = 4200 } = {}) {
  const code = String(ticker || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) return { ok: false, ticker: '', error: 'Ticker vazio.' };
  const url = `https://borainvestir.b3.com.br/cotacoes/etfs/${encodeURIComponent(code)}/`;
  const response = await fetchText(url, {
    timeoutMs,
    ttlMs: TTL_MS,
    staleMs: STALE_MS,
    retries: 1,
    headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', Referer: 'https://borainvestir.b3.com.br/' }
  });
  const parsed = parseB3EtfPublicQuote(response.text, code);
  return {
    ...parsed,
    sourceVersion: VALORAE_B3_ETF_QUOTE_VERSION,
    time: parsed.ok ? new Date().toISOString() : undefined,
    cache: response.cacheStatus,
    statusCode: response.status,
    error: parsed.ok ? undefined : (parsed.error || response.error || `B3 ETF HTTP ${response.status || 0}`)
  };
}
