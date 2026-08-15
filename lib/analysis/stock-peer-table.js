import { looksLikeB3Ticker, normalizeTicker } from '../core/tickers.js';

/**
 * Parser tolerante da tabela atual de pares do Investidor10.
 *
 * Layout público observado:
 * Ativos | Cotação (R$) | Variação 12m | DY | P/L | P/VP | ROE | Margem Líquida.
 *
 * O HTML do site muda de wrappers com frequência; por isso este parser trabalha sobre
 * texto normalizado, ancora no cabeçalho sem depender de classes CSS e aceita tickers
 * especiais da B3 (por exemplo QVQP3B, SPRT3B e G2DI33).
 */
const CURRENT_PEER_HEADER_RE = /Ativos\s+Cota(?:ç|c)[aã]o(?:\s*\(\s*R\$\s*\))?\s+Varia(?:ç|c)[aã]o\s+12m\s+DY\s+P\s*\/\s*L\s+P\s*\/\s*VP\s+ROE\s+Margem\s+L[íi]quida/i;

const PEER_TICKER_TOKEN_RE = /\b([A-Z0-9]{4,8})\b/g;

function isPeerTickerToken(value = '') {
  const ticker = normalizeTicker(value);
  return Boolean(ticker && /[A-Z]/.test(ticker) && /\d/.test(ticker) && looksLikeB3Ticker(ticker));
}

export function isCurrentInvestidor10PeerTable(section = '') {
  return CURRENT_PEER_HEADER_RE.test(String(section || '').replace(/\s+/g, ' ').trim());
}

export function parseCurrentInvestidor10PeerTable(section = '') {
  const text = String(section || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const headerMatch = text.match(CURRENT_PEER_HEADER_RE);
  if (!headerMatch || headerMatch.index === undefined) return [];

  const source = text.slice(headerMatch.index + headerMatch[0].length);
  const tickerMatches = [...source.matchAll(PEER_TICKER_TOKEN_RE)]
    .filter(match => match.index !== undefined && isPeerTickerToken(match[1]));
  if (!tickerMatches.length) return [];

  const brNumPattern = String.raw`[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?`;
  const missingPattern = String.raw`(?:-|—|–)`;
  const brPercentPattern = String.raw`${brNumPattern}\s*%`;
  const moneyPattern = String.raw`R\$\s*${brNumPattern}`;
  const moneyOrMissing = String.raw`(?:R\$\s*(?:${brNumPattern}|${missingPattern})|${missingPattern})`;
  const percentOrMissing = String.raw`(?:${brPercentPattern}|${missingPattern})`;
  const numberOrMissing = String.raw`(?:${brNumPattern}|${missingPattern})`;
  const valuesPattern = new RegExp(
    String.raw`(${moneyOrMissing})\s+(${percentOrMissing})\s+(${percentOrMissing})\s+(${numberOrMissing})\s+(${numberOrMissing})\s+(${percentOrMissing})\s+(${percentOrMissing})`,
    'i'
  );

  const rows = [];
  for (let index = 0; index < tickerMatches.length; index += 1) {
    const tickerMatch = tickerMatches[index];
    const ticker = normalizeTicker(tickerMatch[1]);
    const from = (tickerMatch.index || 0) + tickerMatch[0].length;
    const to = tickerMatches[index + 1]?.index ?? Math.min(source.length, from + 520);
    const chunk = source.slice(from, to);
    const match = chunk.match(valuesPattern);
    if (!match) continue;
    rows.push({
      ticker,
      quoteDisplay: match[1],
      variation12mDisplay: match[2],
      dividendYieldDisplay: match[3],
      plDisplay: match[4],
      pvpDisplay: match[5],
      roeDisplay: match[6],
      marginLiquidDisplay: match[7]
    });
  }
  return rows;
}
