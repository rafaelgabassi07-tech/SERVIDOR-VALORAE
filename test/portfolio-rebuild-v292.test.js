import assert from 'node:assert/strict';
import fs from 'node:fs';

const router = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
const history = fs.readFileSync(new URL('../lib/portfolio/history.js', import.meta.url), 'utf8');
const quotes = fs.readFileSync(new URL('../lib/sources/quotes.js', import.meta.url), 'utf8');

assert.match(router, /import \{[^}]*buildPortfolioHistory[^}]*\} from '\.\.\/lib\/portfolio\/history\.js';/,
  'roteador deve importar motor novo de histórico da carteira');
assert.match(router, /path === '\/portfolio\/history'[\s\S]*normalizePortfolioPositions[\s\S]*buildPortfolioHistory\(normalizedPositions,/,
  'rota /portfolio/history deve normalizar posições/tickers e usar buildPortfolioHistory');
assert.match(history, /PORTFOLIO_HISTORY_VERSION = '21.12.382-quote-state-resilience-v350'/,
  'motor deve expor a versão atual mantendo o engine v292');
assert.match(history, /VALORAE_PORTFOLIO_HISTORY_REBUILD_V292/,
  'resposta deve identificar engine reconstruída v292');
assert.equal((history.match(/const investedValue = Number\(currentPositions\.reduce/g) || []).length, 1,
  'não pode haver declaração duplicada de investedValue no buildPortfolioHistory');
assert.match(history, /stateAtTimestamp\(entry\.position, entry\.transactions, stateTimestamp, entry\.openingInventory\)/,
  'histórico consolidado deve recalcular quantidade/custo pelo fechamento real do período');
assert.match(history, /fetchYahooHistory\(p\.ticker, \{ range, interval, timeoutMs, limit: options\.limit \}\)/,
  'motor deve buscar histórico real por ticker no Yahoo/proxy');
assert.match(quotes, /regularMarketPrice \?\? lastClose \?\? meta\.previousClose \?\? meta\.chartPreviousClose/,
  'cotação atual deve priorizar preço de mercado/último close antes de previousClose');
for (const field of ['dayChangeValue', 'dayChangePercent', 'regularMarketChangePercent', 'variationPct', 'quoteQuality']) {
  assert.match(quotes, new RegExp(field), `cotação deve expor ${field}`);
}

console.log('modal-deadline-disable-external-v295 ok');
