import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const stockResponse = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  results: {
    empresa: {
      negociosReceita: [
        { segmento: 'Exploração e Produção', percentual: '67,4%' },
        { segmento: 'Refino', percentual: '21,6%' },
        { segmento: 'Gás e Energia', percentual: '11,0%' }
      ],
      regioesReceita: {
        Brasil: '78,5%',
        Exterior: '21,5%'
      }
    }
  }
}, { ticker: 'PETR4' });

const section = stockResponse.sections.find(item => item.id === 'revenue_breakdown');
assert.ok(section, 'revenue_breakdown precisa existir no AnalysisPageResponse');
assert.equal(section.status, 'ready');
assert.ok(!stockResponse.missingSignals.some(signal => signal.id === 'revenue_breakdown'), 'revenue_breakdown não deve ficar pendente com percentuais reais');
assert.ok(section.items.some(item => item.group === 'Negócios que geram receita' && item.label === 'Exploração e Produção' && item.value.includes('%')));
assert.ok(section.items.some(item => item.group === 'Regiões onde gera receita' && item.label === 'Brasil'));
assert.equal(section.charts.length, 2, 'deve criar uma composição para negócios e outra para regiões');
assert.ok(section.charts.every(chart => chart.chartType === 'horizontal_bar_composition'), 'receita por negócio/região deve usar barras horizontais de composição');
assert.ok(section.charts.every(chart => chart.series.every(serie => serie.points.every(point => point.value > 0 && point.value <= 100))), 'pontos precisam ser percentuais reais válidos');

const internalExternalResponse = buildAnalysisPageResponse({
  ticker: 'TEST3',
  assetClass: 'ACAO',
  mercadoInternoExterno: [
    { mercado: 'Mercado interno', participacao: '61%' },
    { mercado: 'Mercado externo', participacao: '39%' }
  ]
}, { ticker: 'TEST3' });
const internalExternal = internalExternalResponse.sections.find(item => item.id === 'revenue_breakdown');
assert.equal(internalExternal.status, 'ready');
assert.ok(internalExternal.items.some(item => item.label === 'Mercado interno'));
assert.ok(internalExternal.items.some(item => item.label === 'Mercado externo'));

const emptyResponse = buildAnalysisPageResponse({ ticker: 'VAZIO3', assetClass: 'ACAO' }, { ticker: 'VAZIO3' });
const emptySection = emptyResponse.sections.find(item => item.id === 'revenue_breakdown');
assert.equal(emptySection.status, 'empty');
assert.ok(emptyResponse.missingSignals.some(signal => signal.id === 'revenue_breakdown'), 'sem percentuais reais, seção deve ser sinalizada');

const invalidResponse = buildAnalysisPageResponse({
  ticker: 'FAKE3',
  assetClass: 'ACAO',
  negociosReceita: { SegmentoA: 'n/d', SegmentoB: 0, SegmentoC: '140%' }
}, { ticker: 'FAKE3' });
const invalidSection = invalidResponse.sections.find(item => item.id === 'revenue_breakdown');
assert.equal(invalidSection.status, 'empty', 'percentuais inválidos não podem montar gráfico');

const screen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
assertOptionalMatch(screen, /RevenueBreakdownBlock/);
assertOptionalMatch(screen, /RevenueBreakdownBarRow/);
assertOptionalMatch(screen, /parseAnalysisPercent/);

console.log('Checkpoint 32 revenue breakdown test OK.');
