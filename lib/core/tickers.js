const UNIT_TICKERS = new Set(['TAEE11','SANB11','KLBN11','ALUP11','BPAC11','SAPR11','ENGI11','AESB11','CPLE11','EQTL11','VIVT11','BRBI11','IGTI11','RNEW11']);

// Tickers terminados em 11 não são sempre FIIs: ETFs brasileiros também usam 11.
// A página Análise depende dessa classificação para buscar o HTML correto nas fontes
// externas. Mantemos uma lista explícita e conservadora dos ETFs mais negociados/usuais
// e ainda tentamos caminhos alternativos no extrator para não inventar classe quando a
// fonte real estiver em outro caminho.
const ETF_TICKERS = new Set([
  'BOVA11','BOVV11','BOVB11','BOVS11','SMAL11','IVVB11','DIVO11','ECOO11','GOVE11','FIND11','MATB11','PIBB11','BRAX11',
  'HASH11','QBTC11','QETH11','ETHE11','BITH11','DEFI11','WEB311','META11','NASD11','TECK11','USTK11','SPXI11','EURP11','XINA11',
  'XFIX11','FIXA11','IMAB11','B5P211','IRFM11','IB5M11','IB5M11','LFTS11','NTNS11','B5MB11','USDB11','GOLD11','AGRI11'
]);

function looksLikeBdrTicker(ticker = '') {
  // BDRs da B3 normalmente aparecem como quatro letras + dois dígitos na faixa 31-39
  // (ex.: AAPL34, MSFT34). Ações locais comuns usam um dígito final, como PETR4.
  return /^[A-Z]{4}3[0-9]$/.test(ticker);
}

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
  if (ETF_TICKERS.has(ticker)) return 'ETF';
  if (looksLikeBdrTicker(ticker)) return 'BDR';
  if (UNIT_TICKERS.has(ticker)) return 'ACAO_UNIT';
  if (/^[A-Z]{4}11B?$/.test(ticker) || /^[A-Z]{4}12$/.test(ticker)) return 'FII';
  if (/^[A-Z]{4}[345678]$/.test(ticker)) return 'ACAO';
  if (/^[A-Z]{4}11$/.test(ticker)) return 'ACAO_UNIT';
  return 'ACAO';
}

export function statusInvestType(ticker) {
  // Mantido compatível com rotas antigas de proventos, que só alternam entre
  // /acao/companytickerprovents e /fii/companytickerprovents.
  return classifyTicker(ticker) === 'FII' ? 'fii' : 'acao';
}

export function investidor10PageTypes(ticker) {
  const kind = classifyTicker(ticker);
  if (kind === 'FII') return ['fiis', 'etfs', 'acoes', 'bdrs'];
  if (kind === 'ETF') return ['etfs', 'fiis', 'acoes'];
  if (kind === 'BDR') return ['bdrs', 'acoes'];
  return ['acoes', 'bdrs', 'etfs', 'fiis'];
}

export function statusInvestPageTypes(ticker) {
  const kind = classifyTicker(ticker);
  if (kind === 'FII') return ['fii', 'acao', 'etfs', 'bdrs'];
  if (kind === 'ETF') return ['etfs', 'fii', 'acao'];
  if (kind === 'BDR') return ['bdrs', 'acao'];
  return ['acao', 'bdrs', 'etfs', 'fii'];
}
