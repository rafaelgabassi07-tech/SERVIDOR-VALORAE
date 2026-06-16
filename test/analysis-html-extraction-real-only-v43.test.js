import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const onlySnapshot = buildAnalysisPageResponse({
  ticker: 'TEST3',
  symbol: 'TEST3',
  assetClass: 'ACAO',
  financialSummary: {
    valorDeMercado: 1_000_000_000,
    patrimonioLiquido: 500_000_000,
    ativos: 700_000_000,
    dividaBruta: 200_000_000,
    dividaLiquida: 150_000_000,
    disponibilidade: 50_000_000
  },
  results: {
    financialSummary: {
      valorDeMercado: 1_000_000_000,
      patrimonioLiquido: 500_000_000,
      ativos: 700_000_000
    }
  }
}, {});

const statements = onlySnapshot.sections.find(section => section.id === 'financial_statements');
assert.ok(statements, 'contrato deve manter o bloco de demonstrativos');
assert.equal(statements.items.length, 0, 'financialSummary pontual não pode virar DRE/Balanço/Fluxo de Caixa');
assert.equal(statements.charts.length, 0, 'financialSummary pontual não pode gerar gráfico de demonstrativo');
assert.ok(onlySnapshot.missingSignals.some(signal => signal.id === 'financial_statements'), 'demonstrativos devem ficar sinalizados como ausentes quando não há série real');

const source = fs.readFileSync('lib/sources/asset-details.js', 'utf8');
assert.doesNotMatch(source, /acompanhado pelo contrato oficial VALORAE/i, 'descrição genérica não pode aparecer como perfil real');
assert.doesNotMatch(source, /Renda variável|Fundo imobiliário'/i, 'classificação genérica não pode substituir setor/segmento real');
assert.doesNotMatch(source, /setor:\s*assetClass\s*===\s*'FII'\s*\?\s*'Fundo imobiliário'\s*:\s*'Renda variável'/, 'dadosEmpresa não pode preencher setor genérico');
assert.doesNotMatch(source, /subSector:\s*assetClass\s*===\s*'FII'/, 'subsetor não pode depender de classe para inventar classificação');
assert.doesNotMatch(source, /fiiSegment:\s*assetClass\s*===\s*'FII'\s*\?\s*'Fundo imobiliário'/, 'segmento FII precisa vir da fonte real');

assert.doesNotMatch(source, /indicators\.payout\s*\?\s*\[\s*\{[^}]*Payout/s, 'indicador pontual de payout não pode virar histórico de payout');
assert.doesNotMatch(source, /dividendYieldHistory\s*=\s*dividendYearly\.map|label:\s*'DY %'/, 'proventos anuais + cotação atual não podem virar histórico de DY');

const investidor10ExtractorSource = fs.readFileSync('lib/market/investidor10-chart-extractor.js', 'utf8');
assert.doesNotMatch(investidor10ExtractorSource, /currentPriceEstimate|DY anual estimado/i, 'histórico de DY não pode ser estimado por cotação atual');
assert.doesNotMatch(investidor10ExtractorSource, /canonicalDividendYieldHistory\s*=\s*pointCount\(apiDividendYieldHistory\)\s*\?\s*apiDividendYieldHistory\s*:\s*htmlDividendAggregates\.dividendYieldHistory/, 'histórico de DY precisa vir de série real da fonte, não de agregado calculado');


const unlabeledFinancialSeries = buildAnalysisPageResponse({
  ticker: 'NOYEAR3',
  assetClass: 'ACAO',
  financialChartsCanonical: {
    incomeStatement: {
      labels: [],
      series: [{ label: 'Receita líquida', data: [100, 120] }]
    }
  }
}, {});
const unlabeledStatements = unlabeledFinancialSeries.sections.find(section => section.id === 'financial_statements');
assert.equal(unlabeledStatements.items.length, 0, 'série financeira sem período real não pode inventar P1/P2');
assert.equal(unlabeledStatements.charts.length, 0, 'série financeira sem período real não pode gerar gráfico com período inventado');

const rowWithoutPeriod = buildAnalysisPageResponse({
  ticker: 'ATUAL3',
  assetClass: 'ACAO',
  financialStatements: [{ receitaLiquida: 100, lucroLiquido: 10 }]
}, {});
const rowWithoutPeriodStatements = rowWithoutPeriod.sections.find(section => section.id === 'financial_statements');
assert.equal(rowWithoutPeriodStatements.items.length, 0, 'linha de demonstrativo sem data/período não pode virar período Atual');

const withCanonical = buildAnalysisPageResponse({
  ticker: 'REAL3',
  assetClass: 'ACAO',
  financialChartsCanonical: {
    revenueProfit: [
      { year: '2024', netRevenue: 100, netProfit: 10 },
      { year: '2025', netRevenue: 120, netProfit: 12 }
    ],
    balanceSheet: [
      { year: '2024', totalAssets: 200, netWorth: 80 },
      { year: '2025', totalAssets: 240, netWorth: 90 }
    ]
  }
}, {});
const canonicalStatements = withCanonical.sections.find(section => section.id === 'financial_statements');
assert.ok(canonicalStatements.items.length >= 4, 'séries canônicas reais continuam aceitas');
assert.ok(canonicalStatements.charts.length >= 1, 'séries canônicas reais continuam gerando gráfico');

console.log('Analysis HTML extraction real-only v43 test OK.');
