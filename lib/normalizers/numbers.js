// Normalização numérica central do VALORAE.
// Objetivo: uma única leitura confiável para dinheiro, percentuais e séries de gráficos.
// Sem dependências externas, compatível com Vercel Free.

export const VALORAE_NUMBERS_VERSION = '21.11.8-financial-number-normalizer';

const EMPTY = new Set(['', '-', '—', '–', 'n/a', 'na', 'null', 'undefined']);

function compact(value = '') {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value = '') {
  return compact(String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function multiplierFromText(raw = '') {
  const s = String(raw || '').toLowerCase();
  if (/\btri(?:lh(?:ões|ao|ão)?)?\b|trilh(?:ões|ao|ão)/i.test(s)) return 1e12;
  if (/\bbi(?:lh(?:ões|ao|ão)?)?\b|bilh(?:ões|ao|ão)|\bb\b/i.test(s)) return 1e9;
  if (/\bmi(?:lh(?:ões|ao|ão)?)?\b|milh(?:ões|ao|ão)|\bm\b/i.test(s)) return 1e6;
  if (/\bmil\b|\bk\b/i.test(s)) return 1e3;
  return 1;
}

function selectNumericToken(raw = '') {
  const s = compact(raw);
  // Pega o token numérico mais plausível e mantém sufixos próximos usados em finanças.
  const matches = [...s.matchAll(/[+-]?(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?\s*(?:%|trilh(?:ões|ao|ão)|bilh(?:ões|ao|ão)|milh(?:ões|ao|ão)|mil|tri|bi|mi|[kmb])?/gi)];
  if (!matches.length) return '';
  // Prioriza tokens com moeda/percentual/sufixo; senão o primeiro token.
  const ranked = matches.map(m => {
    const token = m[0];
    const tail = s.slice(Math.max(0, m.index - 8), Math.min(s.length, m.index + token.length + 12));
    let score = 1;
    if (/%/.test(token)) score += 3;
    if (/R\$|US\$|BRL|USD/i.test(tail)) score += 3;
    if (/trilh|bilh|milh|\bmil\b|[kmb]\b/i.test(token)) score += 2;
    if (/\d/.test(token)) score += 1;
    return { token, score, index: m.index };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0].token;
}

function normalizeSeparators(token = '') {
  let s = String(token || '').replace(/[^0-9,.-]/g, '');
  if (!/[0-9]/.test(s)) return '';
  const comma = s.lastIndexOf(',');
  const dot = s.lastIndexOf('.');
  if (comma > dot) return s.replace(/\./g, '').replace(',', '.');
  if (dot > comma) return s.replace(/,/g, '');
  // Caso só exista um separador: decide por casas decimais mais comuns.
  if (comma >= 0 && dot < 0) {
    const decimals = s.length - comma - 1;
    return decimals === 3 && /^-?\d{1,3},\d{3}$/.test(s) ? s.replace(',', '') : s.replace(',', '.');
  }
  if (dot >= 0 && comma < 0) {
    const decimals = s.length - dot - 1;
    return decimals === 3 && /^-?\d{1,3}\.\d{3}$/.test(s) ? s.replace('.', '') : s;
  }
  return s;
}

export function parseFinancialNumber(value, options = {}) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const rawInput = stripHtml(value);
  if (EMPTY.has(rawInput.toLowerCase())) return null;
  const negativeByParens = /\([^)]*\d[^)]*\)/.test(rawInput);
  const token = selectNumericToken(rawInput);
  if (!token) return null;
  const multiplier = multiplierFromText(`${token} ${rawInput}`);
  const normalized = normalizeSeparators(token);
  if (!normalized) return null;
  let n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  if (negativeByParens && n > 0) n = -n;
  n *= multiplier;
  const maxAbs = Number(options.maxAbs || 1e15);
  if (Math.abs(n) > maxAbs) return null;
  return Math.round(n * 1e8) / 1e8;
}

export function parsePercentNumber(value) {
  const n = parseFinancialNumber(value, { maxAbs: 100000 });
  if (n === null) return null;
  return n;
}

export function formatPercentLike(value) {
  const n = parsePercentNumber(value);
  return n === null ? undefined : `${String(n).replace('.', ',')}%`;
}

export function isPlausibleFinancialNumber(value, { kind = 'generic' } = {}) {
  const n = parseFinancialNumber(value);
  if (n === null) return { ok: false, value: null, reason: 'not_numeric' };
  if (['price', 'money', 'asset_value'].includes(kind) && n < 0) return { ok: false, value: n, reason: 'negative_money' };
  if (['price', 'money'].includes(kind) && n === 0) return { ok: false, value: n, reason: 'zero_money' };
  if (['percent', 'ratio_percent'].includes(kind) && Math.abs(n) > 1000) return { ok: false, value: n, reason: 'extreme_percent' };
  if (['ratio'].includes(kind) && Math.abs(n) > 10000) return { ok: false, value: n, reason: 'extreme_ratio' };
  return { ok: true, value: n, reason: null };
}

export function numberNormalizerStats() {
  return { version: VALORAE_NUMBERS_VERSION, localePriority: ['pt-BR', 'en-US'], supports: ['currency', 'percent', 'K/M/B', 'mil/milhao/bilhao/trilhao', 'negative-parentheses'] };
}
