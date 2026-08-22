import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { normalizePositions, quantityAtDate } from '../lib/portfolio/positions.js';
import { dividendCacheSignature, enrichPortfolio } from '../lib/portfolio/dividends-contract.js';
import { _test as routerTest } from '../routes/_router.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

test('posições duplicadas são consolidadas sem perder quantidade ou patrimônio', () => {
  const positions = normalizePositions([
    { ticker: 'petr4.sa', quantity: 10, avgPrice: 20, currentPrice: 30, firstPurchaseDate: '2025-02-10', assetClass: 'ACAO' },
    { ticker: ' PETR4 ', quantity: 5, avgPrice: 40, currentPrice: 32, firstPurchaseDate: '2024-01-05', assetClass: 'ACAO' },
  ]);

  assert.equal(positions.length, 1);
  assert.equal(positions[0].ticker, 'PETR4');
  assert.equal(positions[0].quantity, 15);
  assert.equal(positions[0].invested, 400);
  assert.equal(positions[0].marketValue, 460);
  assert.equal(positions[0].firstPurchaseDate, '2024-01-05');
  assert.ok(Math.abs(positions[0].avgPrice - (400 / 15)) < 1e-10);
  assert.ok(Math.abs(positions[0].currentPrice - (460 / 15)) < 1e-10);
});

test('elegibilidade de dividendos usa a quantidade consolidada quando não há transações', () => {
  const quantity = quantityAtDate('MXRF11.SA', '2026-07-01', [
    { ticker: 'MXRF11', quantity: 80, firstPurchaseDate: '2024-01-01' },
    { ticker: 'mxrf11.sa', quantity: 20, firstPurchaseDate: '2025-01-01' },
  ]);
  assert.equal(quantity, 100);
});

test('evento com sufixo de mercado encontra a posição canônica e preserva classe e quantidade', () => {
  const event = enrichPortfolio(
    { ticker: 'petr4.sa', kind: 'DIVIDENDO', valuePerShare: 1.5 },
    { positions: [{ ticker: 'PETR4', quantity: 12, assetClass: 'ACAO', firstPurchaseDate: '2024-01-01' }] },
  );
  assert.equal(event.quantityAtDate, 12);
  assert.equal(event.assetClass, 'ACAO');
  assert.equal(event.estimatedAmount, 18);
});

test('cache de dividendos não é invalidado por oscilação de cotação ou preço médio', () => {
  const base = {
    positions: [{ ticker: 'PETR4', quantity: 10, avgPrice: 20, currentPrice: 30, firstPurchaseDate: '2024-01-01', assetClass: 'ACAO' }],
    transactions: [{ ticker: 'PETR4', quantity: 10, price: 20, date: '2024-01-01', side: 'BUY' }],
    futureMonths: 12,
    historyMonths: 36,
  };
  const changedQuotes = {
    ...base,
    positions: [{ ...base.positions[0], avgPrice: 99, currentPrice: 123 }],
    transactions: [{ ...base.transactions[0], price: 99 }],
  };
  assert.deepEqual(
    dividendCacheSignature(base, ['PETR4'], 'mobile'),
    dividendCacheSignature(changedQuotes, ['PETR4'], 'mobile'),
  );

  const changedEligibility = {
    ...base,
    positions: [{ ...base.positions[0], firstPurchaseDate: '2025-01-01' }],
  };
  assert.notDeepEqual(
    dividendCacheSignature(base, ['PETR4'], 'mobile'),
    dividendCacheSignature(changedEligibility, ['PETR4'], 'mobile'),
  );
});

test('bundle parcial preserva somente blocos antigos que falharam', () => {
  const stale = {
    quotes: [{ symbol: 'PETR4', price: 30 }],
    dividends: { upcoming: [{ ticker: 'PETR4', paymentDate: '2026-08-01' }] },
    news: [{ title: 'notícia antiga' }],
    rankings: { highs: [{ symbol: 'VALE3' }], lows: [] },
    blockStatus: { quotes: 'OK', dividends: 'OK', news: 'OK', rankings: 'OK' },
  };
  const current = {
    status: 'PARTIAL',
    partial: true,
    quotes: [],
    dividends: null,
    news: [{ title: 'notícia nova' }],
    rankings: { highs: [], lows: [] },
    blockStatus: { quotes: 'ERROR', dividends: 'PARTIAL', news: 'OK', rankings: 'ERROR' },
    diagnostics: {},
  };

  const merged = routerTest.mergeMobileAlertsWithStale(current, stale);
  assert.equal(merged.quotes[0].symbol, 'PETR4');
  assert.equal(merged.dividends.upcoming[0].ticker, 'PETR4');
  assert.equal(merged.news[0].title, 'notícia nova');
  assert.equal(merged.rankings.highs[0].symbol, 'VALE3');
  assert.equal(merged.blockStatus.quotes, 'STALE');
  assert.equal(merged.blockStatus.dividends, 'STALE');
  assert.equal(merged.blockStatus.news, 'OK');
  assert.equal(merged.blockStatus.rankings, 'STALE');
});


const proxyAnalysisSource = fs.readFileSync(new URL('../lib/portfolio/analysis.js', import.meta.url), 'utf8');
const returnDividendSource = fs.readFileSync(new URL('../lib/portfolio/return-dividends.js', import.meta.url), 'utf8');

test('retorno ignora provento explicitamente inelegível e deduplica eventos idênticos', () => {
  assert.match(proxyAnalysisSource, /normalizeReturnDividendEvents/);
  assert.match(returnDividendSource, /if \(event\.eligible === false\) return null/);
  assert.match(returnDividendSource, /const unique = new Map\(\)/);
  assert.match(returnDividendSource, /normalizeTicker\(event\.ticker/);
});

const runtimeSource = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyRuntime.kt');
const normalizerSource = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraePortfolioRequestNormalizer.kt');
const contractsSource = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyPortfolioContractsService.kt');
const alertsSource = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyBackgroundAlertsService.kt');
const returnIdentitySource = readSiblingApkFile('app/src/main/java/com/example/domain/PortfolioReturnIdentityEngine.kt');

test('APK mantém caches por chave e consolida posições antes do transporte', { skip: !runtimeSource }, () => {
  assert.match(runtimeSource, /ConcurrentHashMap<String, TimedCache<ValoraeDividendAgenda>>/);
  assert.match(runtimeSource, /ConcurrentHashMap<String, TimedCache<ValoraeEquilibriumContract>>/);
  assert.match(runtimeSource, /fun dividendPositionsKey/);
  assert.match(runtimeSource, /PortfolioReturnIdentityEngine\.transactionsKey\(transactions\)/);
  assert.match(runtimeSource, /PortfolioReturnIdentityEngine\.incomeKey\(events\)/);
  assert.match(returnIdentitySource, /transaction\.operationCode\.orEmpty\(\)/);
  assert.match(returnIdentitySource, /number\(transaction\.grossValue\)/);
  assert.match(returnIdentitySource, /transaction\.source\.orEmpty\(\)/);
  assert.match(returnIdentitySource, /event\.comDate\.orEmpty\(\)/);
  assert.match(returnIdentitySource, /event\.exDate\.orEmpty\(\)/);
  assert.match(returnIdentitySource, /number\(event\.netAmount\)/);
  assert.match(returnIdentitySource, /number\(event\.grossAmount\)/);
  assert.match(runtimeSource, /BackgroundAlertsPartialCacheTtlMs = 30 \* 1000L/);
  assert.match(runtimeSource, /DividendAgendaPartialCacheTtlMs = 45 \* 1000L/);
  assert.match(runtimeSource, /MarketRankingPartialCacheTtlMs = 30 \* 1000L/);
  assert.match(normalizerSource, /groupBy \{ it\.ticker \}/);
  assert.match(alertsSource, /normalizeAndAggregateDividendPositions\(positions, maxEntries = 45\)/);
  assert.match(contractsSource, /getPortfolioReturns[\s\S]*?val cleanPositions = normalizeAndAggregateDividendPositions\(positions\)/);
  assert.match(contractsSource, /if \(cached\.value\.partial\) DividendAgendaPartialCacheTtlMs/);
  assert.match(contractsSource, /event\.eligible && event\.ticker in cleanTickers/);
  assert.doesNotMatch(contractsSource, /distinctBy \{ it\.ticker \}/);
  assert.match(alertsSource, /mergeBackgroundAlertsWithStale/);
  assert.match(alertsSource, /dividendPositionsKey\(cleanPositions\)/);
  assert.match(alertsSource, /if \(cached\.value\.partial\) BackgroundAlertsPartialCacheTtlMs/);
});
