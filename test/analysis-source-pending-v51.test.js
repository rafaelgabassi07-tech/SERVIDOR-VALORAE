import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';
import { buildInvestidor10CanonicalCharts } from '../lib/market/investidor10-chart-extractor.js';
import { _test as assetDetailsTest } from '../lib/sources/asset-details.js';

const stockFromCanonical = buildAnalysisPageResponse({
  ticker: 'BBAS3',
  assetClass: 'ACAO',
  currentPrice: 28.4,
  results: {
    assetChartsCanonical: {
      company: {
        fundamentalIndicatorHistory: {
          colunas: ['2025', '2024', '2023'],
          linhas: [
            { indicador: 'P/L', valores: { '2025': '4,20', '2024': '4,90', '2023': '5,30' } },
            { indicador: 'P/VP', valores: { '2025': '0,92', '2024': '0,86', '2023': '0,79' } },
            { indicador: 'Dividend Yield', valores: { '2025': '9,10%', '2024': '8,20%', '2023': '7,40%' } },
            { indicador: 'ROE', valores: { '2025': '21,40%', '2024': '19,70%', '2023': '18,10%' } }
          ]
        },
        ownership: { Controladores: '50,40%', 'Free Float': '49,60%' }
      }
    }
  }
}, { ticker: 'BBAS3' });

const historical = stockFromCanonical.sections.find(section => section.id === 'historical_indicators');
assert.equal(historical.status, 'ready', 'Histórico deve aceitar results.assetChartsCanonical.company.fundamentalIndicatorHistory');
assert.ok(!stockFromCanonical.missingSignals.some(signal => signal.id === 'historical_indicators'));
assert.ok(historical.charts.length >= 2, 'Histórico vindo do canonical deve gerar gráficos para o APK');

const ownershipFromCanonical = stockFromCanonical.sections.find(section => section.id === 'ownership');
assert.equal(ownershipFromCanonical.status, 'ready', 'Posição acionária deve aceitar mapas no canonical da empresa');
assert.ok(ownershipFromCanonical.charts.some(chart => chart.id === 'ownership_distribution'));
assert.ok(!stockFromCanonical.missingSignals.some(signal => signal.id === 'ownership'));

const stockFromSections = buildAnalysisPageResponse({
  ticker: 'GRND3',
  assetClass: 'ACAO',
  results: {
    sections: {
      empresa: {
        posicaoAcionaria: {
          keyValues: [
            { label: 'Controladores', value: '64,10%' },
            { label: 'Free Float', value: '35,90%' }
          ]
        }
      }
    }
  }
}, { ticker: 'GRND3' });
const ownershipFromSections = stockFromSections.sections.find(section => section.id === 'ownership');
assert.equal(ownershipFromSections.status, 'ready', 'Posição acionária deve aceitar results.sections.empresa.posicaoAcionaria');
assert.ok(!stockFromSections.missingSignals.some(signal => signal.id === 'ownership'));

const fiiCanonical = buildInvestidor10CanonicalCharts({
  ticker: 'HGLG11',
  type: 'FII',
  html: '<h2>Histórico de Indicadores Fundamentalistas</h2>',
  apiExtras: {
    rawJson: {
      historicoIndicadoresFii: {
        colunas: ['2025', '2024'],
        linhas: [
          { indicador: 'P/VP', valores: { '2025': '1,03', '2024': '0,98' } },
          { indicador: 'Dividend Yield', valores: { '2025': '8,20%', '2024': '8,00%' } }
        ]
      }
    },
    apiStatus: []
  }
});
assert.ok(fiiCanonical.fii?.fundamentalIndicatorHistory, 'Extractor deve encaminhar rawJson.historicoIndicadoresFii para o canonical FII');

const fiiResponse = buildAnalysisPageResponse({
  ticker: 'HGLG11',
  assetClass: 'FII',
  assetChartsCanonical: fiiCanonical
}, { ticker: 'HGLG11' });
assert.equal(fiiResponse.sections.find(section => section.id === 'historical_indicators').status, 'ready');
assert.ok(!fiiResponse.missingSignals.some(signal => signal.id === 'historical_indicators'));

const ownershipHtml = `
<section>
  <h2>Posição acionária</h2>
  <table>
    <tr><th>Acionista</th><th>Participação</th></tr>
    <tr><td>Controladores</td><td>64,00%</td></tr>
    <tr><td>Free Float</td><td>36,00%</td></tr>
  </table>
</section>`;
const ownershipExtracted = assetDetailsTest.extractInvestidor10OwnershipFromHtml(ownershipHtml);
assert.equal(ownershipExtracted.rows.length, 2, 'HTML real da seção Posição acionária deve gerar rows consumíveis pelo contrato');

console.log('Analysis pending source routing v51 test OK.');
