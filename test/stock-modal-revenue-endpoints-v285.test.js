import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const withoutIds = _test.stockRevenueApiEndpointCandidates({ symbol: 'PETR4', ids: {} });
const withoutUrls = withoutIds.map(([, url]) => url);
assert.ok(withoutUrls.some(url => /\/api\/acoes\/regioes-receita\/petr4\/?$/i.test(url)), 'slug region endpoint must be attempted without companyId');
assert.ok(withoutUrls.some(url => /\/api\/acoes\/negocios-receita\/petr4\/?$/i.test(url)), 'slug business endpoint must be attempted without companyId');
assert.ok(withoutUrls.some(url => /\/api\/rest\/assets\/tickers\/PETR4\/receitas$/i.test(url)), 'REST revenue endpoint must be attempted by ticker');

const withIds = _test.stockRevenueApiEndpointCandidates({ symbol: 'PETR4', ids: { companyId: '1234', tickerId: '5678' } });
const withUrls = withIds.map(([, url]) => url);
assert.ok(withUrls.some(url => /\/api\/acoes\/receitas-por-regiao\/1234\/?$/i.test(url)), 'companyId region endpoint must be attempted');
assert.ok(withUrls.some(url => /\/api\/acoes\/receitas-por-segmento\/1234\/?$/i.test(url)), 'companyId business endpoint must be attempted');
assert.equal(new Set(withUrls).size, withUrls.length, 'endpoint candidates must be deduplicated');

console.log('stock-modal-revenue-endpoints-v285 ok');
