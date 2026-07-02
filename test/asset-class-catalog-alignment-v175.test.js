import assert from 'node:assert/strict';
import { classifyTicker, investidor10PageTypes, statusInvestPageTypes, isEtfTicker, isStockUnitTicker, normalizeTicker } from '../lib/core/tickers.js';
import { isFiiTicker, isStockTicker, exposureLabel } from '../lib/portfolio/equilibrium-metadata.js';
import { buildMobileScraperAssetContract } from '../lib/compat/mobile-scraper-contract.js';

const etfs = ['WRLD11', 'ISUS11', 'GOVE11', 'WEB311', 'META11', 'QBTC11', 'QETH11', 'B5P211', 'IB5M11'];
for (const ticker of etfs) {
  assert.equal(classifyTicker(ticker), 'ETF', `${ticker} deve ser ETF no core`);
  assert.equal(isEtfTicker(ticker), true, `${ticker} deve passar no helper isEtfTicker`);
  assert.equal(isFiiTicker(ticker), false, `${ticker} não pode virar FII no equilíbrio`);
  assert.equal(investidor10PageTypes(ticker)[0], 'etfs', `${ticker} deve priorizar /etfs no Investidor10`);
  assert.equal(statusInvestPageTypes(ticker)[0], 'etfs', `${ticker} deve priorizar /etfs no StatusInvest`);
}

for (const ticker of ['EQTL11', 'RNEW11', 'VIVT11', 'SAPR11', 'RAPT11', 'PINE11']) {
  assert.equal(classifyTicker(ticker), 'ACAO_UNIT', `${ticker} deve ser ação/unit, não FII`);
  assert.equal(isStockUnitTicker(ticker), true, `${ticker} deve passar no helper de units`);
  assert.equal(isStockTicker(ticker), true, `${ticker} deve contar como ação no equilíbrio`);
  assert.equal(isFiiTicker(ticker), false, `${ticker} não pode entrar como FII`);
}

assert.equal(classifyTicker('AAPL39'), 'BDR', 'BDR faixa 30-39 precisa continuar aceito');
assert.equal(exposureLabel('AAPL39'), 'Exterior', 'BDR faixa 30-39 deve manter exposição exterior');
assert.equal(normalizeTicker('B3:WRLD11.SA'), 'WRLD11', 'normalização com prefixo/sufixo deve preservar ETF');

assert.equal(buildMobileScraperAssetContract({ ticker: 'ISUS11' }).classe_ativo, 'etf', 'contrato compat não pode classificar ISUS11 como FII');
assert.equal(buildMobileScraperAssetContract({ ticker: 'AAPL30' }).classe_ativo, 'bdr', 'contrato compat precisa aceitar BDR faixa 30-39');
assert.equal(buildMobileScraperAssetContract({ ticker: 'VIVT11' }).classe_ativo, 'acao', 'contrato compat precisa tratar unit como ação');

console.log('Asset class catalog alignment v175 test OK.');
