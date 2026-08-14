/**
 * Parses the current Investidor10 stock peer table from normalized plain text.
 *
 * The current public table is ordered as:
 * Ativos | Cotação | Variação 12m | DY | P/L | P/VP | ROE | Margem Líquida.
 *
 * This helper deliberately returns display strings only. Numeric interpretation stays
 * centralized in stock-modal-contract.js so the comparator does not grow a second
 * financial-number parser.
 */
export function parseCurrentInvestidor10PeerTable(section = '') {
  const text = String(section || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const header = /Ativos\s+Cot(?:a|ã|ação|ac)[çcãaõo]*\s+Varia[çc][ãa]o\s+12m\s+DY\s+P\s*\/\s*L\s+P\s*\/\s*VP\s+ROE\s+Margem\s+L[íi]quida/i;
  const headerMatch = text.match(header);
  if (!headerMatch || headerMatch.index === undefined) return [];

  const source = text.slice(headerMatch.index + headerMatch[0].length);
  const tickerPattern = /\b([A-Z]{4}\d{1,2})\b/g;
  const tickerMatches = [...source.matchAll(tickerPattern)].filter(match => match.index !== undefined);
  if (!tickerMatches.length) return [];

  const brNumPattern = String.raw`[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?`;
  const brPercentPattern = String.raw`${brNumPattern}\s*%`;
  const moneyPattern = String.raw`R\$\s*${brNumPattern}`;
  const valuesPattern = new RegExp(
    String.raw`(${moneyPattern})\s+(${brPercentPattern}|-)\s+(${brPercentPattern})\s+(${brNumPattern})\s+(${brNumPattern})\s+(${brPercentPattern})\s+(${brPercentPattern})`,
    'i'
  );

  const rows = [];
  for (let index = 0; index < tickerMatches.length; index += 1) {
    const tickerMatch = tickerMatches[index];
    const ticker = tickerMatch[1].toUpperCase();
    const from = (tickerMatch.index || 0) + tickerMatch[0].length;
    const to = tickerMatches[index + 1]?.index ?? Math.min(source.length, from + 360);
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
