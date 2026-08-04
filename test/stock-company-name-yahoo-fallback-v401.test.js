import assert from 'node:assert/strict';
import { resolveStockCompanyName, sanitizeStockCompanyName } from '../lib/analysis/stock-identity.js';

assert.equal(
  resolveStockCompanyName({
    ticker: 'PETR4',
    investidor10: { name: 'PETR4' },
    yahooLogo: { name: 'Petróleo Brasileiro S.A. - Petrobras' }
  }),
  'Petróleo Brasileiro S.A. - Petrobras'
);

assert.equal(
  resolveStockCompanyName({
    ticker: 'VALE3',
    investidor10: { name: 'Ação da Bolsa Brasileira' },
    oneDayHistory: { longName: 'Vale S.A.', shortName: 'VALE' }
  }),
  'Vale S.A.'
);

assert.equal(sanitizeStockCompanyName('PETR4 - Petrobras PN | Investidor10', 'PETR4'), 'Petrobras PN');
assert.equal(sanitizeStockCompanyName('Ação da Bolsa Brasileira', 'ITUB4'), '');

console.log('stock-company-name-yahoo-fallback-v401 ok');
