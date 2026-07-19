import assert from 'node:assert/strict';
import { _test as fiiTest } from '../lib/analysis/fii-modal-contract.js';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';
import { clearCache } from '../lib/core/cache.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const legacyChecklist = fiiTest.ensureFiiBuyHoldChecklist({
  checklist: {
    items: [{
      id: 'dy_24m_9',
      label: 'Dividend Yield médio dos últimos 24 meses acima de 9%',
      passed: true,
      status: 'PASSED',
      statusLabel: 'Atende',
      source: 'Investidor10 checklist buy and hold',
      dataNature: 'DIRECT'
    }]
  },
  ticker: 'HGLG11',
  html: '<main>FII constituído em 2014</main>',
  dividendCharts: {
    yieldSeriesByFrequency: {
      monthly: Array.from({ length: 12 }, (_, index) => ({ period: `2025-${String(index + 1).padStart(2, '0')}`, yieldPercent: 10 }))
    }
  }
});
assert.equal(legacyChecklist.items.length, 8);
assert.equal(legacyChecklist.items.find(item => item.id === 'dy_24m_above_9')?.status, 'PASSED', 'critério direto legado deve ser reconciliado pelo rótulo canônico');

const shortWindowChecklist = fiiTest.ensureFiiBuyHoldChecklist({
  checklist: { items: [] },
  ticker: 'MXRF11',
  html: '<main>FII constituído em 2014</main>',
  dividendCharts: {
    yieldSeriesByFrequency: {
      monthly: Array.from({ length: 12 }, (_, index) => ({ period: `2025-${String(index + 1).padStart(2, '0')}`, yieldPercent: 12 }))
    }
  }
});
assert.equal(shortWindowChecklist.items.find(item => item.id === 'dy_24m_above_9')?.status, 'UNKNOWN', 'janela de 12 meses não pode decidir critério de 24 meses');
assert.equal(shortWindowChecklist.diagnostics.hasAverageDy24m, false);

const savedExternal = process.env.VALORAE_DISABLE_EXTERNAL;
const originalFetch = globalThis.fetch;
try {
  delete process.env.VALORAE_DISABLE_EXTERNAL;
  clearCache();
  const timestamps = [Math.floor(Date.UTC(2026, 3, 1) / 1000), Math.floor(Date.UTC(2026, 4, 1) / 1000)];
  globalThis.fetch = async input => {
    const url = String(input?.url || input || '');
    const missingQuote = /VALE3(?:\.SA)?/i.test(url);
    return new Response(JSON.stringify({
      chart: {
        result: [{
          meta: { currency: 'BRL', regularMarketPrice: missingQuote ? null : 40, chartPreviousClose: missingQuote ? null : 38 },
          timestamp: missingQuote ? [] : timestamps,
          indicators: { quote: [{ close: missingQuote ? [] : [35, 38], open: missingQuote ? [] : [35, 38], high: missingQuote ? [] : [35, 38], low: missingQuote ? [] : [35, 38], volume: missingQuote ? [] : [100, 100] }] }
        }],
        error: null
      }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const history = await buildPortfolioHistory([
    { ticker: 'PETR4', quantity: 10, averagePrice: 30, currentPrice: 40, firstPurchaseAt: Math.floor(Date.UTC(2025, 0, 1) / 1000) }
  ], { range: '1Y', interval: '1mo', timeoutMs: 400 });
  const current = history.series.find(row => row.source === 'currentPrice');
  assert.ok(current, 'histórico deve conter ponto atual real');
  assert.equal(current.totalValue, 400);
  assert.equal(current.completeValuation, true);
  assert.equal(current.partialValuation, false);
  assert.equal(current.valuationCoveragePercent, 100);

  clearCache();
  const partialCurrentHistory = await buildPortfolioHistory([
    { ticker: 'PETR4', quantity: 10, averagePrice: 30, currentPrice: 40, firstPurchaseAt: Math.floor(Date.UTC(2025, 0, 1) / 1000) },
    { ticker: 'VALE3', quantity: 2, averagePrice: 60, currentPrice: 0, firstPurchaseAt: Math.floor(Date.UTC(2025, 0, 1) / 1000) }
  ], { range: '1Y', interval: '1mo', timeoutMs: 400 });
  const partialCurrent = partialCurrentHistory.series.find(row => row.source === 'currentPricePartial');
  assert.ok(partialCurrent, 'cotação atual ausente deve produzir ponto explicitamente parcial');
  assert.equal(partialCurrent.totalValue, 400, 'custo médio do ativo sem cotação não pode entrar no patrimônio atual');
  assert.equal(partialCurrent.completeValuation, false);
  assert.equal(partialCurrent.partialValuation, true);
  assert.equal(partialCurrent.valuationCoveragePercent, 50);
  assert.deepEqual(partialCurrent.unavailableValuationTickers, ['VALE3']);
} finally {
  clearCache();
  globalThis.fetch = originalFetch;
  if (savedExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL; else process.env.VALORAE_DISABLE_EXTERNAL = savedExternal;
}


const apkFiles = {
  indicators: readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalIndicatorsHistoryUi.kt'),
  stockPeers: readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalStockPeerRevenueUi.kt'),
  comparison: readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalDividendsChartsComparisonUi.kt'),
  checklist: readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalChecklistUi.kt'),
  cards: readSiblingApkFile('app/src/main/java/com/example/ui/PortfolioAssetsCardsUi.kt'),
  parser: readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyAssetParsers.kt'),
  historyParser: readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyJsonHelpers.kt'),
  historyService: readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyPortfolioContractsService.kt'),
  dashboard: readSiblingApkFile('app/src/main/java/com/example/ui/PortfolioDashboardReturnsUi.kt'),
  dashboardModal: readSiblingApkFile('app/src/main/java/com/example/ui/PortfolioDashboardModalUi.kt'),
  discovery: readSiblingApkFile('app/src/main/java/com/example/ui/AnalysisDiscoveryUi.kt')
};
if (Object.values(apkFiles).every(Boolean)) {
  assert.match(apkFiles.indicators, /Arrangement\.spacedBy\(1\.dp\)/);
  assert.match(apkFiles.indicators, /title\.contains\("resultado"/i);
  assert.match(apkFiles.stockPeers, /actionColumnWidth/);
  assert.match(apkFiles.comparison, /selectedChartTimestamp/);
  assert.match(apkFiles.comparison, /onSelectedTimestampChange/);
  assert.doesNotMatch(apkFiles.comparison, /Toque ou arraste.*tooltip/i);
  assert.match(apkFiles.comparison, /adaptiveFiiPeerWidth/);
  assert.match(apkFiles.checklist, /val completed = DefaultFiiChecklistCriteria\.mapIndexed/);
  assert.doesNotMatch(apkFiles.checklist, /if \(items\.isEmpty\(\)\) return items/);
  assert.match(apkFiles.cards, /if \(!supportsOfficialLogo\) return/);
  assert.match(apkFiles.parser, /quoteObject\?\.optNullableDouble\("pvp"\)/);
  assert.match(apkFiles.historyParser, /requireCompleteValuation/);
  assert.match(apkFiles.historyService, /requireCompleteValuation = true/);
  assert.match(apkFiles.dashboard, /ZoneOffset\.UTC/);
  assert.match(apkFiles.dashboardModal, /emptyMap<String, Double>\(\)\.withDashboardCurrentMonthTotal/);
  assert.match(apkFiles.discovery, /LaunchedEffect\(normalizedLocalQuery, sortMode\)/);
}

const fiiContractSource = await import('node:fs/promises').then(fs => fs.readFile(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8'));
assert.doesNotMatch(fiiContractSource, /fetchYahooLogo\(/, 'modal FII não deve iniciar busca de logotipo');
assert.match(fiiContractSource, /DISABLED_FOR_FII_NO_OFFICIAL_LOGO/);

console.log('maintenance-portfolio-modal-corrections-v355 ok');
