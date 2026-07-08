import assert from 'node:assert/strict';
import { fetchYahooHistory, fetchYahooLogo, fetchYahooQuote } from '../lib/market/yahoo.js';

const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  throw new Error('fetch must not be called when external is disabled');
};

try {
  process.env.VALORAE_DISABLE_EXTERNAL = '1';
  const logo = await fetchYahooLogo('PETR4', { bypassCache: true });
  assert.equal(logo.ok, false);
  assert.equal(logo.cache, 'DISABLED');
  assert.equal(logo.error, 'external-disabled');

  const history = await fetchYahooHistory('PETR4', { bypassCache: true, range: '1D' });
  assert.equal(history.ok, false);
  assert.equal(history.cache, 'DISABLED');
  assert.deepEqual(history.points, []);

  const quote = await fetchYahooQuote('PETR4', { bypassCache: true });
  assert.equal(quote.ok, false);
  assert.equal(quote.cache, 'DISABLED');
  assert.equal(quote.error, 'external-disabled');
  assert.equal(fetchCalls, 0);
} finally {
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
  globalThis.fetch = originalFetch;
}

console.log('yahoo-disable-external-v295 ok');
