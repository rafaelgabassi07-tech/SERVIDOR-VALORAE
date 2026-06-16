import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const monthPoints = [
  { label: '01/26', value: 0, display: '0,00%' },
  { label: '02/26', value: 2.4, display: '2,40%' },
  { label: '03/26', value: 4.8, display: '4,80%' }
];

const stockResponse = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    indexComparison: [
      {
        id: 'asset_vs_ibov',
        name: 'IBOV',
        source: 'B3 Oficial - IBOV daily-evolution',
        realOnly: true,
        simulated: false,
        proxyTickerUsed: false,
        series: [
          { id: 'asset', label: 'PETR4', points: monthPoints },
          { id: 'ibov', label: 'IBOV', points: [
            { label: '01/26', value: 0 },
            { label: '02/26', value: 1.1 },
            { label: '03/26', value: 2.2 }
          ] }
        ]
      },
      {
        id: 'asset_vs_cdi',
        name: 'CDI',
        source: 'BancoCentralSGS CDI diário série 12',
        realOnly: true,
        series: [
          { id: 'asset', label: 'PETR4', points: monthPoints },
          { id: 'cdi', label: 'CDI', points: [
            { label: '01/26', value: 0 },
            { label: '02/26', value: 0.9 },
            { label: '03/26', value: 1.8 }
          ] }
        ]
      }
    ]
  },
  peers: [
    { ticker: 'PRIO3', pl: '8,1', source: 'StatusInvest/Investidor10' },
    { ticker: 'PETR4', pl: '5,1', source: 'deve ser ignorado' }
  ],
  peerComparisons: [
    {
      ticker: 'PRIO3',
      source: 'StatusInvest/Investidor10 pares reais',
      assetPoints: monthPoints,
      peerPoints: [
        { label: '01/26', value: 0 },
        { label: '02/26', value: 3.1 },
        { label: '03/26', value: 6.2 }
      ]
    }
  ]
}, { ticker: 'PETR4' });

const stockComparisons = stockResponse.sections.find(section => section.id === 'comparisons');
assert.ok(stockComparisons, 'comparisons precisa existir no AnalysisPageResponse');
assert.equal(stockComparisons.status, 'ready');
assert.ok(!stockResponse.missingSignals.some(signal => signal.id === 'comparisons'), 'comparisons não deve ficar pendente quando há séries reais');
assert.ok(stockComparisons.charts.some(chart => chart.id === 'asset_vs_ibov' && chart.chartType === 'multi_line'));
assert.ok(stockComparisons.charts.some(chart => chart.id === 'asset_vs_cdi' && chart.chartType === 'multi_line'));
assert.ok(stockComparisons.charts.every(chart => chart.unit === '%'));
assert.ok(stockComparisons.charts.every(chart => chart.series.every(serie => serie.points.length >= 2)), 'cada série precisa ter 2+ pontos');
assert.ok(stockComparisons.items.some(item => item.group === 'Ações/FIIs semelhantes' && item.label === 'PRIO3'));
assert.ok(!stockComparisons.items.some(item => item.label === 'PETR4' && item.group === 'Ações/FIIs semelhantes'), 'o próprio ativo não pode virar par comparável');

const fakeIndex = buildAnalysisPageResponse({
  ticker: 'VALE3',
  assetClass: 'ACAO',
  assetChartBundle: {
    indexComparison: [
      { name: 'VALE3', source: 'próprio ativo', points: monthPoints },
      { name: 'IBOV', source: 'ETF/proxyTicker simulado', proxyTickerUsed: true, points: monthPoints },
      { name: 'CDI', source: 'série simulada', simulated: true, points: monthPoints },
      { name: 'IPCA', source: 'Banco Central SGS 433', points: [{ label: '01/26', value: 0 }] }
    ]
  }
}, { ticker: 'VALE3' });
const fakeSection = fakeIndex.sections.find(section => section.id === 'comparisons');
assert.equal(fakeSection.status, 'empty', 'comparadores falsos, proxyTicker e séries insuficientes precisam ser rejeitados');
assert.ok(fakeIndex.missingSignals.some(signal => signal.id === 'comparisons'));


const indexOnly = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    indexComparison: [
      { name: 'IBOV', source: 'B3 Oficial - sem série do ativo', points: monthPoints }
    ]
  }
}, { ticker: 'PETR4' });
const indexOnlySection = indexOnly.sections.find(section => section.id === 'comparisons');
assert.equal(indexOnlySection.status, 'empty', 'comparador de índice sem série do ativo não deve aparecer como ativo x índice');


const nestedFake = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    indexComparison: [
      {
        name: 'IBOV',
        source: 'B3 Oficial - mas série aninhada inválida',
        series: [
          { id: 'asset', label: 'PETR4', points: monthPoints },
          { id: 'ibov', label: 'IBOV', simulated: true, source: 'série simulada', points: monthPoints }
        ]
      },
      {
        name: 'IFIX',
        source: 'Yahoo Finance Chart API índice direto IFIX.SA',
        series: [
          { id: 'asset', label: 'PETR4', points: monthPoints },
          { id: 'ifix', label: 'IFIX', points: [
            { label: '01/26', value: 0, reconstructedFromYahooSnapshot: true },
            { label: '02/26', value: 1.1, reconstructedFromYahooSnapshot: true }
          ] }
        ]
      }
    ]
  },
  peers: [
    { ticker: 'FAKE3', pl: '7,0', proxyTickerUsed: true, source: 'ETF/proxy ticker' }
  ]
}, { ticker: 'PETR4' });
const nestedFakeSection = nestedFake.sections.find(section => section.id === 'comparisons');
assert.equal(nestedFakeSection.status, 'empty', 'flags simuladas/proxy em séries, pontos ou pares também precisam ser rejeitadas');

const fiiResponse = buildAnalysisPageResponse({
  ticker: 'HGLG11',
  assetClass: 'FII',
  assetChartBundle: {
    indexComparison: [
      {
        name: 'IFIX',
        source: 'Yahoo Finance Chart API índice direto IFIX.SA',
        realOnly: true,
        series: [
          { id: 'asset', label: 'HGLG11', points: monthPoints },
          { id: 'ifix', label: 'IFIX', points: [
            { label: '01/26', value: 0 },
            { label: '02/26', value: 0.7 },
            { label: '03/26', value: 1.4 }
          ] }
        ]
      }
    ]
  }
}, { ticker: 'HGLG11' });
const fiiComparisons = fiiResponse.sections.find(section => section.id === 'comparisons');
assert.equal(fiiComparisons.status, 'ready');
assert.ok(fiiComparisons.charts.some(chart => chart.id === 'asset_vs_ifix'));

const screen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
assertOptionalMatch(screen, /ComparisonAnalysisBlock/);
assertOptionalMatch(screen, /ComparisonMetricRow/);
assertOptionalMatch(screen, /Ativo x índice/);
assertOptionalMatch(screen, /multi_line/);
assertOptionalDoesNotMatch(screen, /assetSummary solto|quoteOverview|appPayload\.assetAnalysisPage|appMobileSnapshot\.assetAnalysisPage/);

console.log('Checkpoint 33 analysis comparators test OK.');
