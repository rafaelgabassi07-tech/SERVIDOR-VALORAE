import assert from 'node:assert/strict';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

function section(response, id) {
  return response.sections.find(item => item.id === id);
}

function charts(response) {
  return response.sections.flatMap(item => item.charts || []);
}

function readyIds(response) {
  return new Set(response.sections.filter(item => item.items.length || item.charts.length || item.status === 'ready').map(item => item.id));
}

// 1) Ticker inexistente / sem dados reais: não pode inventar blocos, gráficos ou indicadores.
const unknown = buildAnalysisPageResponse({ ticker: 'ZZZZ9', assetClass: 'ACAO' }, { ticker: 'ZZZZ9' });
assert.equal(unknown.contract, 'AnalysisPageResponse');
assert.equal(unknown.contractVersion, '26.analysis.v2');
assert.equal(unknown.ok, false, 'ticker sem payload real não deve ser marcado como OK');
assert.equal(unknown.status, 'PARTIAL');
assert.equal(unknown.summary.readySections, 0, 'ticker sem payload real não deve ter seção pronta');
assert.equal(unknown.summary.totalCharts, 0, 'ticker sem payload real não deve ter gráfico');
assert.ok(unknown.missingSignals.length > 0, 'ticker sem dados precisa sinalizar indisponibilidade discreta');
assert.ok(unknown.missingSignals.every(signal => !readyIds(unknown).has(signal.id)), 'missingSignals não pode incluir seção pronta');

// 2) Resposta parcial: se há resumo real, essa seção deve ficar pronta, sem sinalização pendente indevida.
const partial = buildAnalysisPageResponse({ ticker: 'PETR4', assetClass: 'ACAO', currentPrice: 37.12 }, { ticker: 'PETR4' });
assert.equal(section(partial, 'summary')?.status, 'ready', 'resumo parcial com preço real deve ficar pronto');
assert.ok(!partial.missingSignals.some(signal => signal.id === 'summary'), 'resumo com dados não pode aparecer como pendente');
assert.ok(partial.missingSignals.some(signal => signal.id === 'comparisons'), 'se comparadores não têm séries reais, devem ficar sinalizados');

// 3) FIIs completos: somente FIIs recebem fii_details; ações não devem receber esse bloco.
const stock = buildAnalysisPageResponse({ ticker: 'PETR4', assetClass: 'ACAO', currentPrice: 37.12 }, { ticker: 'PETR4' });
assert.equal(section(stock, 'fii_details'), undefined, 'ações não devem receber seção fii_details');
const fii = buildAnalysisPageResponse({
  ticker: 'HGLG11',
  assetClass: 'FII',
  fiiInfo: {
    segmento: 'Logística',
    administrador: 'Administrador real',
    gestor: 'Gestor real',
    taxaAdministracao: '0,60% a.a.',
    cnpj: '00.000.000/0001-00',
    publicoAlvo: 'Investidor geral'
  },
  assetChartBundle: {
    fiiAssetDistribution: [{ label: 'Imóveis', percentual: 92 }, { label: 'Caixa', percentual: 8 }]
  }
}, { ticker: 'HGLG11' });
assert.equal(section(fii, 'fii_details')?.status, 'ready', 'FII com dados reais precisa receber fii_details pronto');
assert.ok(!fii.missingSignals.some(signal => signal.id === 'fii_details'), 'fii_details com dados não pode aparecer como pendente');

// 4) Gráficos finais: séries temporais não podem voltar para barras; composições precisam manter percentuais válidos.
const charted = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    priceHistory: [{ label: 'Jan/26', close: 30 }, { label: 'Fev/26', close: 32 }],
    revenueProfit: [{ year: '2023', netRevenue: 10, netProfit: 2 }, { year: '2024', netRevenue: 12, netProfit: 3 }],
    profitVsQuote: [{ year: '2023', value: 30, secondaryValue: 2 }, { year: '2024', value: 32, secondaryValue: 3 }],
    indexComparison: [{
      name: 'IBOV',
      source: 'B3/Yahoo Finance índice direto',
      series: [
        { label: 'PETR4', points: [{ label: 'Jan/26', value: 0 }, { label: 'Fev/26', value: 2 }] },
        { label: 'IBOV', points: [{ label: 'Jan/26', value: 0 }, { label: 'Fev/26', value: 1 }] }
      ]
    }]
  }
}, { ticker: 'PETR4' });
const allCharts = charts(charted);
assert.ok(allCharts.length >= 3, 'auditoria final precisa enxergar gráficos reais no contrato');
for (const chart of allCharts) {
  assert.ok(chart.source && chart.source !== 'VALORAE Proxy', `${chart.id} precisa manter fonte explícita`);
  assert.notEqual(chart.chartType, 'bar', `${chart.id} não pode voltar para barra temporal`);
  assert.notEqual(chart.chartType, 'bar_line', `${chart.id} não pode voltar para bar_line temporal`);
  for (const serie of chart.series) {
    assert.ok(serie.points.length > 0, `${chart.id}/${serie.label} precisa ter pontos`);
    for (const point of serie.points) assert.ok(Number.isFinite(point.value), `${chart.id}/${serie.label}/${point.label} precisa ter valor numérico finito`);
  }
}
assert.equal(section(charted, 'asset_charts').charts.find(chart => chart.id === 'profit_vs_quote')?.chartType, 'multi_line', 'Lucro x Cotação precisa preservar duas séries');
const ibov = section(charted, 'comparisons').charts.find(chart => chart.id === 'asset_vs_ibov');
assert.ok(ibov, 'comparador real com períodos comuns deve existir');
assert.deepEqual(ibov.series.map(serie => serie.points.map(point => point.label)), [['Jan/26', 'Fev/26'], ['Jan/26', 'Fev/26']], 'comparador precisa manter labels alinhados');

// 5) Fonte externa com flag simulada/aninhada: deve ser descartada, não desenhada.
const fakeComparison = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    indexComparison: [{
      name: 'IBOV',
      source: 'B3/Yahoo Finance índice direto',
      series: [
        { label: 'PETR4', points: [{ label: 'Jan/26', value: 0 }, { label: 'Fev/26', value: 2 }] },
        { label: 'IBOV', synthetic: true, points: [{ label: 'Jan/26', value: 0 }, { label: 'Fev/26', value: 1 }] }
      ]
    }]
  }
}, { ticker: 'PETR4' });
assert.ok(!(section(fakeComparison, 'comparisons')?.charts || []).some(chart => chart.id === 'asset_vs_ibov'), 'comparador com flag sintética aninhada deve ser descartado');

// 6) APK: Análise segue contrato único, busca confirmada e Canvas nativo.
const screen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
const client = readOptionalApkFile('../apk/app/src/main/java/com/example/data/proxy/ValoraeProxyClient.kt');
assertOptionalMatch(screen, /submittedTicker/, 'Busca precisa separar texto digitado de ticker consultado');
assertOptionalMatch(screen, /AnalysisVisualOverview/, 'Mapa visual do checkpoint 36 precisa permanecer');
assertOptionalMatch(screen, /AnalysisMissingSignalsSection/, 'Sinalização discreta precisa permanecer');
assertOptionalMatch(screen, /FiiDetailsBlock/, 'FIIs completos precisam permanecer no APK');
assertOptionalMatch(screen, /ComparisonAnalysisBlock/, 'Comparadores precisam permanecer no APK');
assertOptionalMatch(screen, /drawLine/, 'Gráficos de séries temporais precisam usar linhas nativas');
assertOptionalMatch(screen, /drawArc/, 'Composições precisam usar arco/donut nativo');
assertOptionalDoesNotMatch(screen, /getAnalysisPage\(normalizedQuery\)/, 'Análise não pode carregar a cada letra');
assertOptionalDoesNotMatch(screen, /assetAnalysisPage|appMobileSnapshot\.assetAnalysisPage|appPayload\.assetAnalysisPage|quoteOverview|assetSummary/, 'AnalysisScreen não pode voltar a contratos antigos');
assertOptionalDoesNotMatch(screen, /drawRoundRect|isBarLike|WebView|iframe|<html/i, 'Análise não pode usar barras temporais, WebView ou HTML');
assertOptionalMatch(client, /executeJsonGet\(\s*"\/api\/v1\/analysis"/, 'getAnalysisPage precisa chamar somente /api/v1/analysis');

console.log('Analysis final audit v37 test OK.');
