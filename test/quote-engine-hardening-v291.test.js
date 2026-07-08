import assert from 'node:assert/strict';
import fs from 'node:fs';

const quotes = fs.readFileSync(new URL('../lib/sources/quotes.js', import.meta.url), 'utf8');
const history = fs.readFileSync(new URL('../lib/portfolio/history.js', import.meta.url), 'utf8');
const router = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');

assert.match(quotes, /dayChangePercent: round\(changePercent, 4\)/, 'getQuote precisa expor dayChangePercent para os cards da Carteira.');
assert.match(quotes, /variationPct: round\(changePercent, 4\)/, 'getQuote precisa expor variationPct como alias defensivo.');
assert.match(quotes, /quoteQuality:\s*(?:\{|price > 0 && previousClose > 0)/, 'getQuote precisa expor quoteQuality para distinguir cotação real de fallback.');
assert.match(quotes, /quoteCoverage: \{ requested: clean\.length, live: liveQuoteCount/, 'batch /quotes precisa expor cobertura para o APK decidir retries.');
assert.match(quotes, /quoteFailures: items\.filter/, 'batch /quotes precisa expor falhas por ticker.');
assert.match(history, /PORTFOLIO_HISTORY_ENGINE_HARDENING_V291/, 'portfolio history precisa identificar o motor fortalecido v291.');
assert.match(history, /enrichPositionsWithRemoteCurrentPrices/, 'histórico da carteira precisa enriquecer currentPrice com preço remoto.');
assert.match(history, /seedPortfolioHistorySeriesFromHistories/, 'histórico da carteira precisa criar seed series real antes de fallback sintético.');
assert.match(router, /VALORAE_REALTIME_PORTFOLIO_HISTORY_ENGINE_V291/, 'roteador precisa expor routeEngine v291.');

console.log('quote-engine-hardening-v291 ok');
