import { canonicalTicker } from '../market/yahoo.js';

function escapeRegExp(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeIdentityEntities(value = '') {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code) || 32))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16) || 32));
}

export function sanitizeStockCompanyName(candidate = '', ticker = '') {
  const cleanTicker = canonicalTicker(ticker);
  let value = decodeIdentityEntities(candidate)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value) return '';
  value = value
    .replace(/\s+[|]\s+.*$/u, '')
    .replace(/\s+[-–—]\s+(?:cotação|indicadores|ações?|investidor10|status invest).*$/iu, '')
    .trim();
  if (cleanTicker) {
    value = value.replace(new RegExp(`^${escapeRegExp(cleanTicker)}(?:\\.SA)?\\s*[-–—|:]?\\s*`, 'i'), '').trim();
  }
  const normalized = canonicalTicker(value);
  const generic = /^(?:ação|acoes?|ativo|ticker|ação da bolsa brasileira|empresa da bolsa brasileira|bolsa brasileira|b3)$/iu;
  if (!value || generic.test(value) || normalized === cleanTicker || value.length < 2 || value.length > 120) return '';
  return value;
}

export function resolveStockCompanyName({ ticker = '', investidor10, yahooLogo, oneDayHistory } = {}) {
  const candidates = [
    investidor10?.name,
    investidor10?.companyProfile?.name,
    investidor10?.companyData?.companyName,
    investidor10?.companyData?.tradeName,
    yahooLogo?.name,
    oneDayHistory?.longName,
    oneDayHistory?.shortName,
    oneDayHistory?.displayName
  ];
  for (const candidate of candidates) {
    const resolved = sanitizeStockCompanyName(candidate, ticker);
    if (resolved) return resolved;
  }
  return canonicalTicker(ticker) || String(ticker || '').trim().toUpperCase();
}
