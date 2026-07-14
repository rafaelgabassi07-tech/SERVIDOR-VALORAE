import assert from 'node:assert/strict';
import { dispatchRoute } from '../routes/_router.js';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';
import { buildPortfolioReturns } from '../lib/portfolio/analysis.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';
import { clearCache } from '../lib/core/cache.js';

let seq = 1;
function response() {
  const headers = new Map();
  return {
    statusCode: 200,
    writableEnded: false,
    body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    end(value = '') { this.body = Buffer.isBuffer(value) ? value : String(value); this.writableEnded = true; return this; },
    status(code) { this.statusCode = code; return this; },
    send(value) { return this.end(value); }
  };
}
async function invoke(url, { method = 'GET', headers = {}, body } = {}) {
  const res = response();
  await dispatchRoute({ method, url, headers, body, socket: { remoteAddress: `127.0.2.${seq++}` } }, res);
  return res;
}

function yahooChart(symbol, closes, timestamps) {
  return new Response(JSON.stringify({
    chart: {
      result: [{
        meta: { currency: 'BRL', regularMarketPrice: closes.at(-1), chartPreviousClose: closes.at(-2) || closes.at(-1) },
        timestamp: timestamps,
        indicators: { quote: [{ close: closes, open: closes, high: closes, low: closes, volume: closes.map(() => 1000) }] }
      }],
      error: null
    }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

const saved = {
  keys: process.env.VALORAE_CLIENT_KEYS,
  required: process.env.VALORAE_REQUIRE_CLIENT_AUTH,
  rate: process.env.VALORAE_RATE_LIMIT_DISABLED,
  external: process.env.VALORAE_DISABLE_EXTERNAL
};
const originalFetch = globalThis.fetch;

try {
  process.env.VALORAE_RATE_LIMIT_DISABLED = '1';
  process.env.VALORAE_CLIENT_KEYS = 'secured-app:secured-key';
  process.env.VALORAE_REQUIRE_CLIENT_AUTH = '1';
  delete process.env.VALORAE_DISABLE_EXTERNAL;

  // A rota binária precisa funcionar no Coil sem expor a chave do cliente no APK.
  globalThis.fetch = async (url) => {
    if (String(url).includes('statusinvest.com.br')) {
      return new Response(Buffer.alloc(768, 3), { status: 200, headers: { 'content-type': 'image/png' } });
    }
    return new Response('', { status: 404 });
  };
  const ready = await invoke('/api/v1/ready');
  assert.equal(ready.statusCode, 401, 'rotas de dados continuam protegidas');
  const logo = await invoke('/api/v1/asset/logo?ticker=PETR4&cache=false');
  assert.equal(logo.statusCode, 200, 'logo público deve atravessar somente o gate de autenticação');
  assert.equal(logo.getHeader('X-Valorae-Auth-Bypass'), 'public-asset-logo');
  assert.equal(logo.getHeader('Content-Type'), 'image/png');
  assert.equal(Buffer.isBuffer(logo.body), true);

  delete process.env.VALORAE_CLIENT_KEYS;
  delete process.env.VALORAE_REQUIRE_CLIENT_AUTH;

  // Uma posição sem histórico não pode apagar as variações reais das demais posições.
  const monthSeconds = [
    Math.floor(Date.UTC(2026, 0, 1) / 1000),
    Math.floor(Date.UTC(2026, 1, 1) / 1000),
    Math.floor(Date.UTC(2026, 2, 1) / 1000)
  ];
  globalThis.fetch = async (url) => {
    const raw = String(url);
    if (raw.includes('REAL3')) return yahooChart('REAL3.SA', [10, 12, 15], monthSeconds);
    return new Response(JSON.stringify({ chart: { result: null, error: { code: 'Not Found' } } }), { status: 404, headers: { 'content-type': 'application/json' } });
  };
  const history = await buildPortfolioHistory([
    { ticker: 'REAL3', quantity: 10, averagePrice: 8, currentPrice: 16, firstPurchaseAt: Math.floor(Date.UTC(2025, 10, 1) / 1000) },
    { ticker: 'MISS3', quantity: 2, averagePrice: 50, currentPrice: 55, firstPurchaseAt: Math.floor(Date.UTC(2025, 10, 1) / 1000) }
  ], { range: '1Y', interval: '1mo', timeoutMs: 300, maxConcurrency: 2 });
  const remoteRows = history.series.filter(row => row.source !== 'currentPrice');
  assert.ok(remoteRows.length >= 2, 'histórico remoto parcial deve continuar utilizável');
  assert.deepEqual(remoteRows.slice(0, 3).map(row => row.totalValue), [200, 220, 250]);
  assert.ok(remoteRows.every(row => row.partialValuation === true));
  assert.ok(remoteRows.every(row => row.unavailableValuationTickers.includes('MISS3')));
  assert.equal(history.fallbackUsed, false, 'carry contábil de uma componente não é curva sintética da carteira');
  assert.equal(history.partialValuationUsed, true);
  assert.deepEqual(history.partialValuationTickers, ['MISS3']);

  clearCache();
  // O gráfico Retorno deve buscar índices na janela exibida, não em MAX/10y por causa
  // de um historyMonths legado de 120 meses.
  const indexRequests = [];
  const indexTimestamps = [1704067200, 1706745600, 1709251200];
  globalThis.fetch = async (url) => {
    const raw = String(url);
    indexRequests.push(raw);
    if (raw.includes('finance.yahoo.com')) return yahooChart('INDEX', [100, 103, 108], indexTimestamps);
    return new Response('', { status: 404 });
  };
  const returns = await buildPortfolioReturns({
    range: 'YTD',
    historyMonths: 120,
    assetFilter: 'ALL',
    benchmarks: ['IBOV', 'SMLL', 'SMAL11', 'IFIX', 'IDIV', 'DIVO11', 'IVVB11'],
    portfolioHistory: [
      { date: '2024-01-01', totalValue: 1000, investedValue: 1000, returnPercent: 0, source: 'broker-real-history' },
      { date: '2024-02-01', totalValue: 1030, investedValue: 1000, returnPercent: 3, source: 'broker-real-history' },
      { date: '2024-03-01', totalValue: 1080, investedValue: 1000, returnPercent: 8, source: 'broker-real-history' }
    ]
  });
  assert.equal(returns.diagnostics.benchmarkMonths, new Date().getUTCMonth() + 1);
  assert.equal(returns.diagnostics.portfolioMonths, 120, 'profundidade da carteira continua independente');
  assert.equal(indexRequests.some(url => url.includes('range=10y')), false, 'YTD não deve iniciar por 10y');
  assert.ok(indexRequests.some(url => url.includes('range=1y') && url.includes('interval=1d')));
  const benchmarkTickers = returns.benchmarks.map(row => row.ticker);
  for (const ticker of ['IBOV', 'SMLL', 'IFIX', 'IDIV', 'IVVB11']) {
    assert.equal(benchmarkTickers.filter(value => value === ticker).length, 1, `${ticker} deve aparecer uma vez`);
    assert.equal(returns.benchmarks.find(row => row.ticker === ticker)?.status, 'OK');
  }
  assert.equal(returns.series.some(row => row.ibovReturnPercent != null), true);
  assert.equal(returns.series.some(row => row.smllReturnPercent != null || row.smal11ReturnPercent != null), true);
  assert.equal(returns.series.some(row => row.ifixReturnPercent != null), true);
  assert.equal(returns.series.some(row => row.idivReturnPercent != null), true);
  assert.equal(returns.series.some(row => row.ivvb11ReturnPercent != null), true);

  const avatar = readSiblingApkFile('app/src/main/java/com/example/ui/PortfolioAssetsCardsUi.kt');
  const discovery = readSiblingApkFile('app/src/main/java/com/example/ui/AnalysisDiscoveryUi.kt');
  const service = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyPortfolioContractsService.kt');
  const calculator = readSiblingApkFile('app/src/main/java/com/example/domain/PatrimonyEvolutionCalculator.kt');
  if ([avatar, discovery, service, calculator].every(Boolean)) {
    assert.match(avatar, /\.headers\s*\(/);
    assert.match(avatar, /Headers\.Builder\(\)/);
    assert.match(avatar, /X-Valorae-Mobile-Protocol/);
    assert.match(avatar, /asset\/logo\?ticker=\$ticker&v=3/);
    assert.match(discovery, /asset\/logo\?ticker=\$cleanTicker&v=3/);
    assert.ok(
      /historyMonths", range\.toPortfolioReturnsHistoryMonths\(\)/.test(service)
        || (/val historyMonths = range\.toPortfolioReturnsHistoryMonths\(\)/.test(service) && /put\("historyMonths", historyMonths\)/.test(service)),
      'profundidade da carteira deve continuar vinculada ao período'
    );
    assert.ok(
      /benchmarkMonths", range\.toPortfolioReturnsHistoryMonths\(\)/.test(service)
        || (/val benchmarkMonths = historyMonths/.test(service) && /put\("benchmarkMonths", benchmarkMonths\)/.test(service)),
      'profundidade dos benchmarks deve continuar explícita'
    );
    assert.match(calculator, /val calculationMonthKeys/);
    assert.match(calculator, /filter \{ it\.monthKey in displayMonthKeySet \}/);
  }

  console.log('monthly-variation-logos-return-indices-v332 ok');
} finally {
  clearCache();
  globalThis.fetch = originalFetch;
  if (saved.keys === undefined) delete process.env.VALORAE_CLIENT_KEYS; else process.env.VALORAE_CLIENT_KEYS = saved.keys;
  if (saved.required === undefined) delete process.env.VALORAE_REQUIRE_CLIENT_AUTH; else process.env.VALORAE_REQUIRE_CLIENT_AUTH = saved.required;
  if (saved.rate === undefined) delete process.env.VALORAE_RATE_LIMIT_DISABLED; else process.env.VALORAE_RATE_LIMIT_DISABLED = saved.rate;
  if (saved.external === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL; else process.env.VALORAE_DISABLE_EXTERNAL = saved.external;
}
