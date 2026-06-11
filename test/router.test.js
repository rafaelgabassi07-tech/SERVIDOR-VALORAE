import assert from 'node:assert/strict';
import { _test } from '../routes/_router.js';
assert.equal(_test.stripApi('/api/v1/mobile/portfolio-sync'), '/mobile/portfolio-sync');
assert.equal(_test.stripApi('/api/health'), '/health');
assert.deepEqual(_test.comparisonTickers({ tickers: 'TAEE11,IBOV,IPCA,CDI' }), ['TAEE11', 'IBOV', 'IPCA', 'CDI']);
