import assert from 'node:assert/strict';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const aeroLikePayload = {
  ticker: 'GRND3',
  assetClass: 'ACAO',
  results: {
    companyChartsCanonical: {
      businessRevenue: [
        { name: 'Mercado interno', share: '55,5%' },
        { name: 'Mercado externo', share: '44,5%' }
      ]
    },
    charts: {
      geographicRevenue: {
        Brasil: '72%',
        Exterior: '28%'
      }
    }
  }
};

const response = buildAnalysisPageResponse(aeroLikePayload, { ticker: 'GRND3' });
const revenue = response.sections.find(section => section.id === 'revenue_breakdown');
assert.ok(revenue, 'revenue_breakdown precisa existir');
assert.equal(revenue.status, 'ready');
assert.ok(revenue.items.some(item => item.label === 'Mercado interno'));
assert.ok(revenue.items.some(item => item.label === 'Brasil'));
assert.ok(revenue.charts.length >= 2, 'negócios e regiões devem gerar gráficos separados quando há fonte real');
assert.ok(revenue.charts.every(chart => chart.chartType === 'donut_composition'));
assert.ok(revenue.charts.every(chart => chart.series.every(serie => serie.points.every(point => point.value > 0 && point.value <= 100))));

const apk = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
assertOptionalMatch(apk, /AnalysisCategoryBlock/);
assertOptionalMatch(apk, /RichAnalysisChart/);
assertOptionalMatch(apk, /Detalhamento da receita/);
assertOptionalMatch(apk, /Detalhamento da fonte/);
assertOptionalMatch(apk, /isCompositionAnalysisChart/);
assertOptionalDoesNotMatch(apk, /CompactSectionPreview/);
assertOptionalDoesNotMatch(apk, /Recolher/);
assertOptionalDoesNotMatch(apk, /Há visualizações disponíveis para leitura/);

console.log('Analysis rework v39 categories and revenue extraction test OK.');
