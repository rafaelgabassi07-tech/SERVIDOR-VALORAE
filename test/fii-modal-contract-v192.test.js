import assert from 'node:assert/strict';
import { buildFiiModalContract } from '../lib/analysis/fii-modal-contract.js';

const nonFii = await buildFiiModalContract({ ticker: 'PETR4' });
assert.equal(nonFii.ok, true);
assert.equal(nonFii.status, 'NOT_FII');
assert.equal(nonFii.contract, 'FiiAssetModalResponse');
assert.equal(nonFii.contractVersion, '26.asset-modal.fii.v8');
assert.equal(nonFii.ticker, 'PETR4');

const invalid = await buildFiiModalContract({ ticker: '' });
assert.equal(invalid.ok, false);
assert.equal(invalid.status, 'ERROR');

console.log('FII modal contract v192 guard test OK.');
