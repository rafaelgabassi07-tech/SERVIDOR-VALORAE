import assert from 'node:assert/strict';
import { coalesce } from '../lib/resilience/inflight.js';

let calls = 0;
const [a, b, c] = await Promise.all([
  coalesce('unit:dedupe', async () => { calls += 1; await new Promise(r => setTimeout(r, 10)); return 42; }),
  coalesce('unit:dedupe', async () => { calls += 1; return 99; }),
  coalesce('unit:dedupe', async () => { calls += 1; return 100; }),
]);
assert.equal(calls, 1);
assert.deepEqual([a, b, c], [42, 42, 42]);
console.log('inflight dedupe tests OK.');
