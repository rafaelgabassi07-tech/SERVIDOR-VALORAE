import assert from 'node:assert/strict';
import { buildPortfolioReturns } from '../lib/portfolio/analysis.js';
import { clearCache } from '../lib/core/cache.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const originalFetch = globalThis.fetch;
const savedExternal = process.env.VALORAE_DISABLE_EXTERNAL;

function indexRows(base) {
  return [
    { last_update: '31/01/2026', points: base },
    { last_update: '28/02/2026', points: base * 1.02 },
    { last_update: '31/03/2026', points: base * 1.05 },
    { last_update: '30/04/2026', points: base * 1.09 }
  ];
}

try {
  delete process.env.VALORAE_DISABLE_EXTERNAL;
  clearCache();
  const requests = [];
  globalThis.fetch = async (url) => {
    const raw = String(url);
    requests.push(raw);
    if (raw.includes('/api/indices/cotacoes/6/3650')) {
      return new Response(JSON.stringify(indexRows(2200)), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (raw.includes('/api/indices/cotacoes/22/3650')) {
      return new Response(JSON.stringify(indexRows(3800)), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (raw.includes('/api/indices/cotacoes/8/3650')) {
      return new Response(JSON.stringify(indexRows(12000)), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (raw.includes('finance.yahoo.com')) {
      return new Response(JSON.stringify({ chart: { result: null, error: { code: 'Not Found' } } }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }
    return new Response('', { status: 404 });
  };

  const result = await buildPortfolioReturns({
    range: '3M',
    historyMonths: 3,
    benchmarkMonths: 3,
    indexTimeoutMs: 9000,
    benchmarkSourcePolicy: 'asset-modal-direct-index-first',
    preferDirectIndexHistory: true,
    benchmarks: ['SMLL', 'IFIX', 'IDIV'],
    portfolioHistory: [
      { date: '2026-01-01', totalValue: 1000, investedValue: 1000, returnPercent: 0, source: 'broker-real-history' },
      { date: '2026-02-01', totalValue: 1020, investedValue: 1000, returnPercent: 2, source: 'broker-real-history' },
      { date: '2026-03-01', totalValue: 1050, investedValue: 1000, returnPercent: 5, source: 'broker-real-history' },
      { date: '2026-04-01', totalValue: 1090, investedValue: 1000, returnPercent: 9, source: 'broker-real-history' }
    ]
  });

  assert.equal(result.status, 'OK');
  for (const code of ['SMLL', 'IFIX', 'IDIV']) {
    const benchmark = result.benchmarks.find(item => item.ticker === code);
    assert.ok(benchmark, `${code} precisa existir no contrato`);
    assert.equal(benchmark.status, 'OK', `${code} precisa sair de aguardando série`);
    assert.equal(benchmark.provider, 'Investidor10DirectIndexHistory');
    assert.equal(benchmark.providerParity, 'asset-modal-direct-index-first');
    assert.match(benchmark.source, new RegExp(`índice ${code}`, 'i'));
    assert.ok(benchmark.points.length >= 3, `${code} precisa ter série mensal real`);
  }
  assert.equal(result.series.some(point => point.smllReturnPercent != null && point.smal11ReturnPercent != null), true);
  assert.equal(result.series.some(point => point.ifixReturnPercent != null), true);
  assert.equal(result.series.some(point => point.idivReturnPercent != null), true);
  assert.equal(requests.some(url => /finance\.yahoo\.com/.test(url)), false, 'Yahoo não deve ser chamado quando a mesma fonte direta dos modais respondeu');
  assert.equal(result.diagnostics.marketBenchmarkStatus.every(item => item.provider === 'Investidor10DirectIndexHistory'), true);

  const service = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyPortfolioContractsService.kt');
  const parser = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyMarketPortfolioParsers.kt');
  const merger = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraeReturnBenchmarkMerger.kt');
  if ([service, parser, merger].every(Boolean)) {
    assert.match(service, /benchmarkSourcePolicy", "asset-modal-direct-index-first"/);
    assert.match(service, /preferDirectIndexHistory", true/);
    assert.match(service, /PortfolioReturnsBenchmarkContractVersion/);
    assert.match(parser, /mergeReturnBenchmarkSnapshots/);
    assert.match(parser, /parseReturnBenchmarkSnapshots/);
    assert.match(merger, /smal11ReturnPercent = point\.smal11ReturnPercent \?: mergedByCode\["SMLL"\]/);
  }

  console.log('return-page-index-provider-parity-v333 ok');
} finally {
  clearCache();
  globalThis.fetch = originalFetch;
  if (savedExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = savedExternal;
}
