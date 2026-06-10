import assert from 'node:assert/strict';
import { classifyTicker } from '../lib/core/tickers.js';
assert.equal(classifyTicker('TAEE11'), 'ACAO_UNIT');
assert.equal(classifyTicker('MXRF11'), 'FII');
assert.equal(classifyTicker('PETR4'), 'ACAO');
