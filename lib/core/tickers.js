const UNIT_TICKERS = new Set(['TAEE11','SANB11','KLBN11','ALUP11','BPAC11','SAPR11','ENGI11','AESB11','CPLE11','EQTL11','VIVT11','BRBI11','IGTI11','RNEW11']);

export function normalizeTicker(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function uniqueTickers(values) {
  const rawValues = Array.isArray(values)
    ? values
    : String(values || '').split(/[,;\s]+/).filter(Boolean);
  const out = [];
  for (const value of rawValues || []) {
    const candidates = typeof value === 'string'
      ? value.split(/[,;\s]+/).filter(Boolean)
      : [value?.ticker || value?.symbol || value?.codigo || value];
    for (const candidate of candidates) {
      const ticker = normalizeTicker(candidate);
      if (/^[A-Z]{4}\d{1,2}B?$/.test(ticker) && !out.includes(ticker)) out.push(ticker);
    }
  }
  return out;
}

export function classifyTicker(value) {
  const ticker = normalizeTicker(value);
  if (!ticker) return 'UNKNOWN';
  if (UNIT_TICKERS.has(ticker)) return 'ACAO_UNIT';
  if (/^[A-Z]{4}11B?$/.test(ticker) || /^[A-Z]{4}12$/.test(ticker)) return 'FII';
  if (/^[A-Z]{4}[345678]$/.test(ticker)) return 'ACAO';
  if (/^[A-Z]{4}11$/.test(ticker)) return 'ACAO_UNIT';
  return 'ACAO';
}

export function statusInvestType(ticker) {
  return classifyTicker(ticker) === 'FII' ? 'fii' : 'acao';
}
