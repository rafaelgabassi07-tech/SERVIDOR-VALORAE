import assert from 'node:assert/strict';
import { fetchYahooLogo } from '../lib/market/yahoo.js';

const originalFetch = globalThis.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
const originalMissTtl = process.env.VALORAE_YAHOO_LOGO_MISS_TTL_MS;
delete process.env.VALORAE_DISABLE_EXTERNAL;
process.env.VALORAE_YAHOO_LOGO_MISS_TTL_MS = '1800000';
let fetchCalls = 0;

globalThis.fetch = async () => {
  fetchCalls += 1;
  return {
    ok: true,
    status: 200,
    async json() {
      return { quoteResponse: { result: [{ symbol: 'ZZZZ3.SA', shortName: 'Sem logo' }] } };
    }
  };
};

try {
  const first = await fetchYahooLogo('ZZZZ3', { bypassCache: true, timeoutMs: 1000 });
  assert.equal(first.ok, false);
  assert.equal(first.logoUrl, '');
  assert.equal(first.cache, 'MISS_NEGATIVE_CACHE');

  const second = await fetchYahooLogo('ZZZZ3', { timeoutMs: 1000 });
  assert.equal(second.ok, false);
  assert.equal(second.logoUrl, '');
  assert.equal(second.cache, 'HIT');
  assert.equal(fetchCalls, 2, 'primeira chamada tenta query1/query2; segunda deve vir do cache negativo');
} finally {
  globalThis.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
  if (originalMissTtl === undefined) delete process.env.VALORAE_YAHOO_LOGO_MISS_TTL_MS;
  else process.env.VALORAE_YAHOO_LOGO_MISS_TTL_MS = originalMissTtl;
}

console.log('yahoo-logo-negative-cache-v301 ok');
