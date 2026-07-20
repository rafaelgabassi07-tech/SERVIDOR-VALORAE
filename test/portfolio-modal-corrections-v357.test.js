import assert from 'node:assert/strict';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';
import { _test as stockTest } from '../lib/analysis/stock-modal-contract.js';
import { _test as routerTest } from '../routes/_router.js';

// “Informações sobre a empresa” não repete o mesmo número em forma compacta e bruta.
assert.equal(
  stockTest.stockCompanyInformationDistinctDetailedValue('R$ 3,07 Bilhões', 'R$ 3.073.322.000'),
  ''
);
assert.equal(
  stockTest.stockCompanyInformationDistinctDetailedValue('648,28 Milhões', '648.283.000'),
  ''
);

// FII não dispara resolvedor externo de logo; ações/units seguem elegíveis.
let externalCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  externalCalls += 1;
  throw new Error('não deveria consultar fonte externa para FII');
};
const headers = new Map();
const res = {
  statusCode: 200,
  body: '',
  setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
  end(value = '') { this.body = Buffer.isBuffer(value) ? value.toString('utf8') : String(value); return this; }
};
await routerTest.assetLogoHandler({ method: 'GET', headers: {} }, res, { ticker: 'GARE11', assetType: 'FII', format: 'json' });
assert.equal(externalCalls, 0);
assert.equal(res.statusCode, 200);
const logoPayload = JSON.parse(res.body);
assert.equal(logoPayload.status, 'NOT_APPLICABLE');
assert.equal(logoPayload.logoUrl, '');
globalThis.fetch = originalFetch;

// Sem histórico remoto, o ponto atual real é mantido sem curva sintética baseada em custo.
const history = await buildPortfolioHistory([
  { ticker: 'INVALIDO99', quantity: 2, averagePrice: 10, currentPrice: 14 }
], { range: '1mo', interval: '1d', timeoutMs: 1, maxConcurrency: 1, limit: 1 });
assert.equal(history.ok, true);
assert.equal(history.fallbackUsed, false);
assert.equal(history.remotePointCount, 0);
assert.equal(history.series.length, 1);
assert.equal(history.series[0].source, 'currentPrice');
assert.equal(history.series[0].completeValuation, true);
assert.equal(history.series[0].totalValue, 28);

console.log('portfolio-modal-corrections-v357 ok');
