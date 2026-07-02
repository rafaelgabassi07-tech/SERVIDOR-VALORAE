import assert from 'node:assert/strict';
import { normalizeTicker, uniqueTickers } from '../lib/core/tickers.js';
import { canonicalizeTicker } from '../lib/Valorae-engine.js';
import { canonicalTicker, yahooSymbol } from '../lib/market/yahoo.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const cases = {
  'PETR4.SA': 'PETR4',
  'B3:PETR4': 'PETR4',
  'BVMF:KLBN4': 'KLBN4',
  'BMFBOVESPA:TAEE11': 'TAEE11',
  'KLBN4F': 'KLBN4',
  'KLBN4SA': 'KLBN4',
  'AAPL34.SA': 'AAPL34',
  'BOVA11.SA': 'BOVA11'
};

for (const [input, expected] of Object.entries(cases)) {
  assert.equal(normalizeTicker(input), expected, `normalização canônica falhou para ${input}`);
}

assert.deepEqual(
  uniqueTickers(['PETR4.SA', 'B3:PETR4', 'BVMF:PETR4', 'KLBN4F', 'KLBN4SA']),
  ['PETR4', 'KLBN4'],
  'uniqueTickers deve colapsar sufixos/prefixos que recriavam duplicidade na Carteira'
);

assert.equal(canonicalizeTicker('BVMF:PETR4F'), 'PETR4', 'Valorae-engine também precisa canonicalizar prefixo/sufixo/lote fracionário');
assert.equal(canonicalTicker('B3:KLBN4SA'), 'KLBN4', 'Yahoo history precisa usar a mesma chave canônica do sync');
assert.equal(yahooSymbol('BVMF:KLBN4F'), 'KLBN4.SA', 'Yahoo não pode montar símbolo inválido com prefixo B3/BVMF');

const response = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  price: 38.9,
  indicators: { pl: 4.67, psr: 1.01, pvp: 1.13, dividendYield: 7.15 },
  dividends: []
}, { ticker: 'PETR4' });

const summary = response.sections.find(section => section.id === 'summary');
assert.equal(summary.items.find(item => item.label === 'P/VP')?.value, '1,13', 'P/VP do resumo deve usar o indicador pvp, não PSR');
assert.equal(summary.items.find(item => item.label === 'DY')?.value, '7,15%', 'DY do resumo deve usar dividendYield, não P/VP');
const radar = response.sections.find(section => section.id === 'dividend_radar');
assert.equal(radar?.status, 'empty', 'sem eventos reais o Radar de Dividendos não pode ficar pronto');
assert.equal(radar?.itemCount, 0, 'sem eventos reais o Radar de Dividendos não deve expor itens');

console.log('Full audit ticker normalization v169/v170 test OK.');
