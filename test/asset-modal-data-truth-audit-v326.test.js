import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inspectRealHistoryIntegrity } from '../lib/sources/history-integrity.js';
import { _test as fiiTest } from '../lib/analysis/fii-modal-contract.js';
import { _test as stockTest } from '../lib/analysis/stock-modal-contract.js';

// Curvas reconstruídas a partir de retornos mensais podem representar uma transformação
// matemática válida, mas não são o histórico bruto de preço do índice e não podem passar
// pelo gate que promete apenas séries históricas diretas.
for (const payload of [
  { reconstructedFromMonthlyReturns: true, source: 'Mais Retorno', points: [{ date: '2025-01-01', close: 100 }, { date: '2025-02-01', close: 102 }] },
  { source: 'curva acumulada reconstruída', points: [{ date: '2025-01-01', close: 100 }, { date: '2025-02-01', close: 102 }] },
  { source: 'Mais Retorno', points: [{ date: '2025-01-01', close: 100 }, { date: '2025-02-01', close: 102, reconstructedFromMonthlyReturns: true }] }
]) {
  assert.equal(inspectRealHistoryIntegrity(payload).trusted, false, 'curva reconstruída não pode ser tratada como histórico direto');
}
assert.equal(inspectRealHistoryIntegrity({ source: 'Yahoo Finance Chart API', points: [{ date: '2025-01-01', close: 100 }, { date: '2025-02-01', close: 102 }] }).trusted, true);

// Texto do critério sem marcador visual inequívoco é UNKNOWN, nunca aprovação automática.
const criterion = 'Liquidez diária acima de R$ 700 mil';
assert.equal(fiiTest.detectChecklistPassed(criterion, 0, criterion.length), undefined);
assert.equal(fiiTest.detectChecklistPassed(`${criterion} checked success`, 0, criterion.length), true);
assert.equal(fiiTest.detectChecklistPassed(`${criterion} Não atende`, 0, criterion.length), false);

// Identidade do ticker: aceitar URL/página corretas e rejeitar conteúdo de outro fundo.
assert.equal(fiiTest.fiiTickerIdentityOk('<h1>HGLG11 CSHG Logística</h1>', 'https://investidor10.com.br/fiis/hglg11/', 'HGLG11'), true);
assert.equal(fiiTest.fiiTickerIdentityOk('<h1>XPML11 XP Malls</h1>', 'https://investidor10.com.br/fiis/xpml11/', 'HGLG11'), false);
assert.equal(fiiTest.fiiPageIdentityDiagnostics('<h1>HGLG11</h1>', '', 'HGLG11').symbolFoundInPageHead, true);


// O fallback de FIIs relacionados não pode atribuir o tipo/segmento do fundo de referência aos pares.
const relatedPeers = fiiTest.extractInvestidor10FiiRelatedPeerComparison(`
  <div>Comparando o HGLG11 com a média dos indicadores dos FIIs de tipo (Tijolo) e do segmento (Logística)</div>
  <h2>FIIs Relacionados</h2>
  <div>XPML11 DY: 9,10% P/VP: 0,95</div>
  <div>KNRI11 DY: 8,20% P/VP: 0,91</div>
  <div>Dúvidas comuns</div>
`, 'HGLG11', { dy12mDisplay: '8,50%', pvpDisplay: '0,90' });
assert.equal(relatedPeers.filterLabel, 'FIIs relacionados');
const xpml = relatedPeers.rows.find(row => row.ticker === 'XPML11');
assert.equal(xpml?.fundType, '—');
assert.equal(xpml?.segment, '—');
assert.match(relatedPeers.subtitle, /tipo e segmento só aparecem/i);


const relatedAverage = fiiTest.buildTypeSegmentAverageRows({
  html: '',
  ticker: 'HGLG11',
  quickMetrics: { pvp: 0.90, pvpDisplay: '0,90', dy12m: 8.5, dy12mDisplay: '8,50%' },
  infoItems: [{ id: 'tipo_fundo', value: 'Tijolo' }, { id: 'segmento', value: 'Logística' }],
  peerComparison: {
    diagnostics: { mode: 'related_fiis_real_source' },
    rows: [
      { ticker: 'XPML11', pvp: 0.95, dividendYield: 9.1, patrimonialValue: 6_000_000_000 },
      { ticker: 'KNRI11', pvp: 0.91, dividendYield: 8.2, patrimonialValue: 4_000_000_000 }
    ]
  },
  patrimonial: {}
});
assert.equal(relatedAverage.diagnostics.calculatedPeerRows, 0);
assert.ok(relatedAverage.rows.every(row => row.comparisonValue === null), 'FIIs apenas relacionados não podem gerar falsa média de tipo/segmento');

// Checklist calculado precisa declarar a natureza e manter UNKNOWN quando falta métrica.
const derivedFiiChecklist = fiiTest.ensureFiiBuyHoldChecklist({
  ticker: 'HGLG11',
  html: '<html><body>HGLG11 constituído em 2010</body></html>',
  quickMetrics: { dailyLiquidity: 2_000_000 },
  infoItems: [],
  propertyPortfolio: { properties: [] },
  vacancyHistory: { points: [] },
  patrimonialInfo: { metrics: [] },
  dividendCharts: { events: [] }
});
assert.match(derivedFiiChecklist.source, /VALORAE/i);
assert.equal(derivedFiiChecklist.diagnostics.dataNature, 'CALCULATED');
assert.ok(derivedFiiChecklist.items.some(item => item.dataNature === 'CALCULATED'));
assert.ok(derivedFiiChecklist.items.some(item => item.dataNature === 'UNKNOWN' && item.passed === null));

// Dividendos reais não podem ser convertidos em DY histórico usando a cotação atual.
const stockDividends = stockTest.buildStockDividendHistoryPayload({
  ticker: 'PETR4',
  canonical: {
    company: {
      dividendHistory: [
        { type: 'DIVIDENDO', dataCom: '2024-04-25', paymentDate: '2024-05-20', value: 1.20 },
        { type: 'JCP', dataCom: '2023-04-25', paymentDate: '2023-05-20', value: 0.80 }
      ]
    }
  },
  quickMetrics: { price: 40, dy: 12 },
  fundamentalIndicators: { items: [] }
});
assert.ok(stockDividends.dividendSeriesByFrequency.yearly.length >= 2);
assert.deepEqual(stockDividends.yieldSeriesByFrequency.yearly, []);
assert.equal(stockDividends.diagnostics.yieldDerivedFromCurrentPrice, false);

const fiiDividends = fiiTest.buildFiiDividendChartsPayload({
  ticker: 'HGLG11',
  canonical: {
    fii: {
      dividendHistory: [
        { type: 'RENDIMENTO', dataCom: '2024-04-25', paymentDate: '2024-05-15', value: 1.10 },
        { type: 'RENDIMENTO', dataCom: '2024-05-25', paymentDate: '2024-06-15', value: 1.10 }
      ]
    }
  },
  quickMetrics: { price: 160, dy12m: 8.5 },
  referencePrice: 160
});
assert.ok(fiiDividends.dividendSeriesByFrequency.monthly.length >= 2);
assert.deepEqual(fiiDividends.yieldSeriesByFrequency.monthly, []);
assert.deepEqual(fiiDividends.yieldSeriesByFrequency.yearly, []);
assert.equal(fiiDividends.diagnostics.dyDerivedFromDividends, false);

const fiiSource = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
assert.equal(fiiSource.includes('function buildDerivedDividendYieldSeries'), false);
assert.equal(stockSource.includes('function deriveStockYieldFromDividends'), false);
assert.equal(fiiSource.includes("source: 'Investidor10 dividendos + cotação de referência'"), false);
assert.equal(stockSource.includes("source: 'Investidor10 dividendos + cotação de referência'"), false);
assert.match(stockSource, /dataTruth:\s*\{/);
assert.match(stockSource, /historical_dy_from_current_price/);
assert.match(stockSource, /unavailableBehavior:\s*'EMPTY_ERROR_OR_UNKNOWN'/);
assert.match(fiiSource, /dataTruth:\s*\{/);
assert.match(fiiSource, /peer_type_inheritance/);
assert.match(fiiSource, /patrimonial_value_inference/);

console.log('asset-modal-data-truth-audit-v326 ok');
