import assert from 'node:assert/strict';
import { fetchYahooLogo } from '../lib/market/yahoo.js';
import { routeManifest, _test } from '../routes/_router.js';

const originalFetch = globalThis.fetch;
let requestedUrl = '';
globalThis.fetch = async (url) => {
  requestedUrl = String(url);
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        quoteResponse: {
          result: [
            {
              symbol: 'PETR4.SA',
              shortName: 'Petrobras PN',
              companyLogoUrl: 'https://s.yimg.com/cv/apiv2/default/finance/logo/petr4.png'
            }
          ]
        }
      };
    }
  };
};

try {
  const logo = await fetchYahooLogo('PETR4', { bypassCache: true, timeoutMs: 1500 });
  assert.equal(logo.ok, true);
  assert.equal(logo.logoUrl, 'https://s.yimg.com/cv/apiv2/default/finance/logo/petr4.png');
  assert.equal(logo.source, 'Yahoo Finance Quote API');
  assert.ok(requestedUrl.includes('/v6/finance/quote?'));
  assert.ok(requestedUrl.includes('fields=logoUrl%2CcompanyLogoUrl%2CshortName%2ClongName%2Csymbol'));
} finally {
  globalThis.fetch = originalFetch;
}

const routes = routeManifest().routes;
assert.ok(routes.includes('/asset/logo'));
assert.ok(routes.includes('/asset/yahoo-logo'));
assert.equal(_test.routeMethod('/asset/logo'), 'GET');

console.log('yahoo-asset-logo-v272 ok');
