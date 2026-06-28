import assert from 'node:assert/strict';
import { _test as assetDetailsTest } from '../lib/sources/asset-details.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

function section(page, id) {
  return page.sections.find(item => item.id === id) || { items: [] };
}

function values(page, id) {
  return section(page, id).items.map(item => `${item.label}: ${item.value}`);
}

const html = `
  Valor de Mercado R$ 854,70 Bilhões
  Patrimônio Líquido R$ 445,19 Milhões
  Liquidez Média Diária R$ 7,50 Milhões
  P/L 8,20
  Dividend Yield 7,10%
`;
const parsed = assetDetailsTest.parseMetricsFromHtml(html);
assert.equal(parsed.indicators.valorDeMercado, 854_700_000_000);
assert.equal(parsed.indicators.patrimonioLiquido, 445_190_000);
assert.equal(parsed.indicators.liquidezMediaDiaria, 7_500_000);
assert.ok(parsed.indicatorCards.some(card => card.label === 'Valor de Mercado' && /Bilhões/i.test(card.display)));
assert.ok(parsed.indicatorCards.some(card => card.label === 'Patrimônio Líquido' && /Milhões/i.test(card.display)));

const safePage = buildAnalysisPageResponse({
  ticker: 'TEST3',
  assetClass: 'ACAO',
  currentPrice: 10,
  valorDeMercado: 'R$ 854,70 Bilhões',
  patrimonioLiquido: 'R$ 445,19 Milhões',
  valorDeFirma: 'R$ 900,00 Bilhões',
  liquidezMediaDiaria: 'R$ 7,50 Milhões'
}, { ticker: 'TEST3' });
const profileValues = values(safePage, 'company_profile').join(' | ');
const marketValues = values(safePage, 'market_context').join(' | ');
assert.match(profileValues, /Valor de mercado: R\$ 854,70 bi/);
assert.match(profileValues, /Patrimônio líquido: R\$ 445,19 mi/);
assert.match(profileValues, /Valor da firma: R\$ 900,00 bi/);
assert.match(profileValues, /Liquidez média diária: R\$ 7,50 mi/);
assert.match(marketValues, /Liquidez média diária: R\$ 7,50 mi/);

const suspiciousPage = buildAnalysisPageResponse({
  ticker: 'TEST3',
  assetClass: 'ACAO',
  currentPrice: 10,
  valorDeMercado: 'R$ 854,70',
  patrimonioLiquido: 'R$ 445,19',
  valorDeFirma: 'R$ 900,00',
  liquidezMediaDiaria: 'R$ 7,50'
}, { ticker: 'TEST3' });
const suspiciousText = [...values(suspiciousPage, 'company_profile'), ...values(suspiciousPage, 'market_context')].join(' | ');
assert.doesNotMatch(suspiciousText, /R\$ 854,70|R\$ 445,19|R\$ 900,00|R\$ 7,50/);

const rootAliasPage = buildAnalysisPageResponse({
  ticker: 'TEST3',
  assetClass: 'ACAO',
  currentPrice: 10,
  valorDeMercado: 854_700_000_000,
  valorDeFirma: 900_000_000_000,
  patrimonioLiquido: 445_190_000,
  liquidezMediaDiaria: 7_500_000
}, { ticker: 'TEST3' });
const rootAliasText = [...values(rootAliasPage, 'company_profile'), ...values(rootAliasPage, 'market_context')].join(' | ');
assert.match(rootAliasText, /R\$ 854,70 bi/);
assert.match(rootAliasText, /R\$ 900,00 bi/);
assert.match(rootAliasText, /R\$ 445,19 mi/);
assert.match(rootAliasText, /R\$ 7,50 mi/);

console.log('Analysis value scale v147 test OK.');
