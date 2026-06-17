import assert from 'node:assert/strict';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const monthlyPoints = [
  { label: '01/26', value: 0.85, display: 'R$ 0,85' },
  { label: '02/26', value: 0.88, display: 'R$ 0,88' },
  { label: '03/26', value: 0.91, display: 'R$ 0,91' }
];

const percentPoints = [
  { label: '01/26', value: 0, display: '0,00%' },
  { label: '02/26', value: 1.2, display: '1,20%' },
  { label: '03/26', value: 2.4, display: '2,40%' }
];

const fiiResponse = buildAnalysisPageResponse({
  ticker: 'HGLG11',
  assetClass: 'FII',
  yield12m: '8,5%',
  pvp: '0,95',
  vacancia: '4,2%',
  numeroCotistas: '450.000',
  cotasEmitidas: '20.000.000',
  liquidezMediaDiaria: 'R$ 12 mi',
  results: {
    informacoesFundo: {
      administrador: 'XPTO DTVM',
      gestor: 'Gestora XPTO',
      segmento: 'Logística',
      tipoFundo: 'Tijolo',
      mandato: 'Renda',
      tipoGestao: 'Ativa',
      taxaAdministracao: '0,9% a.a.',
      publicoAlvo: 'Investidores em geral',
      cnpj: '00.000.000/0001-00'
    },
    listaImoveis: [
      { nome: 'Galpão SP', tipo: 'Logístico', cidade: 'São Paulo', uf: 'SP', abl: '50.000 m²' },
      { nome: 'Condomínio RJ', tipo: 'Industrial', cidade: 'Rio de Janeiro', uf: 'RJ' }
    ],
    distribuicaoAtivosFundo: [
      { label: 'Galpões logísticos', percentual: '72%' },
      { label: 'Caixa', percentual: '28%' }
    ]
  },
  assetChartBundle: {
    fiiDistribution12m: monthlyPoints,
    dividendYieldHistory: [
      { label: '2024', value: 7.8, display: '7,80%' },
      { label: '2025', value: 8.1, display: '8,10%' },
      { label: '2026', value: 8.5, display: '8,50%' }
    ],
    equityEvolution: [
      { label: '2024', value: 105.5, display: 'R$ 105,50' },
      { label: '2025', value: 108.1, display: 'R$ 108,10' },
      { label: '2026', value: 110.2, display: 'R$ 110,20' }
    ],
    indexComparison: [
      {
        name: 'IFIX',
        source: 'Yahoo Finance Chart API índice direto IFIX.SA',
        realOnly: true,
        series: [
          { id: 'asset', label: 'HGLG11', points: percentPoints },
          { id: 'ifix', label: 'IFIX', points: [
            { label: '01/26', value: 0 },
            { label: '02/26', value: 0.7 },
            { label: '03/26', value: 1.4 }
          ] }
        ]
      },
      {
        name: 'CDI',
        source: 'Banco Central SGS CDI diário série 12',
        realOnly: true,
        series: [
          { id: 'asset', label: 'HGLG11', points: percentPoints },
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
    { ticker: 'KNRI11', pvp: '0,90', source: 'StatusInvest/Investidor10 pares reais' },
    { ticker: 'HGLG11', pvp: '0,95', source: 'deve ser ignorado' }
  ]
}, { ticker: 'HGLG11' });

const fiiDetails = fiiResponse.sections.find(section => section.id === 'fii_details');
assert.ok(fiiDetails, 'fii_details precisa existir para FIIs');
assert.equal(fiiDetails.status, 'ready', 'fii_details deve ficar pronto quando houver dados reais');
assert.ok(!fiiResponse.missingSignals.some(signal => signal.id === 'fii_details'), 'fii_details não deve ficar pendente com itens/gráficos reais');
assert.ok(fiiDetails.items.some(item => item.label === 'Administrador' && item.value === 'XPTO DTVM'));
assert.ok(fiiDetails.items.some(item => item.label === 'Gestor' && item.value === 'Gestora XPTO'));
assert.ok(fiiDetails.items.some(item => item.label === 'Vacância' && item.value.includes('%')));
assert.ok(fiiDetails.items.some(item => item.label === 'Cotistas'));
assert.ok(fiiDetails.items.some(item => item.label === 'Cotas emitidas'));
assert.ok(fiiDetails.items.some(item => item.group === 'Lista de imóveis' && item.label === 'Galpão SP'));
assert.ok(fiiDetails.items.some(item => item.group === 'Distribuição de ativos' && item.label === 'Galpões logísticos'));
assert.ok(fiiDetails.items.some(item => item.group === 'FIIs relacionados' && item.label === 'KNRI11'));
assert.ok(!fiiDetails.items.some(item => item.group === 'FIIs relacionados' && item.label === 'HGLG11'), 'o próprio FII não deve aparecer como relacionado');
assert.ok(fiiDetails.charts.some(chart => chart.id === 'fii_detail_monthly_income' && chart.chartType === 'bar'));
assert.ok(fiiDetails.charts.some(chart => chart.id === 'fii_detail_dy_history' && chart.chartType === 'bar'));
assert.ok(fiiDetails.charts.some(chart => chart.id === 'fii_detail_asset_distribution' && chart.chartType === 'donut_composition'));
assert.ok(!fiiDetails.charts.some(chart => /line/.test(chart.chartType) && /monthly_income|dy_history/.test(chart.id)), 'rendimentos e DY de FII devem usar barras discretas, não linhas cruas');

const comparisons = fiiResponse.sections.find(section => section.id === 'comparisons');
assert.equal(comparisons.status, 'ready');
assert.ok(comparisons.charts.some(chart => chart.id === 'asset_vs_ifix'));
assert.ok(comparisons.charts.some(chart => chart.id === 'asset_vs_cdi'));

const stockResponse = buildAnalysisPageResponse({ ticker: 'PETR4', assetClass: 'ACAO' }, { ticker: 'PETR4' });
assert.ok(!stockResponse.sections.some(section => section.id === 'fii_details'), 'ações não devem receber seção de FIIs completos');

const emptyFii = buildAnalysisPageResponse({ ticker: 'VAZIO11', assetClass: 'FII' }, { ticker: 'VAZIO11' });
const emptyDetails = emptyFii.sections.find(section => section.id === 'fii_details');
assert.equal(emptyDetails.status, 'empty', 'FII sem dados específicos reais deve ficar indisponível, não simulado');
assert.ok(emptyFii.missingSignals.some(signal => signal.id === 'fii_details'));

const screen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
assertOptionalMatch(screen, /FiiDetailsBlock/);
assertOptionalMatch(screen, /FiiDetailRow/);
assertOptionalMatch(screen, /fii_details/);
assertOptionalDoesNotMatch(screen, /assetSummary solto|quoteOverview|appPayload\.assetAnalysisPage|appMobileSnapshot\.assetAnalysisPage/);

console.log('Checkpoint 34 FIIs completos test OK.');
