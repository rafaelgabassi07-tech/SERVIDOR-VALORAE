import assert from 'node:assert/strict';
import {
  fetchAllowedScrapeText,
  validatePublicScrapeTarget,
  _test,
} from '../lib/scrape/safe-target-fetch.js';

const allowedHosts = ['example.com', 'www.example.com'];
assert.equal(validatePublicScrapeTarget('https://example.com/acoes/petr4?period=12m', { allowedHosts }).hostname, 'example.com');
assert.throws(() => validatePublicScrapeTarget('http://example.com/', { allowedHosts }), error => error.code === 'INVALID_TARGET_URL_PROTOCOL');
assert.throws(() => validatePublicScrapeTarget('https://user:pass@example.com/', { allowedHosts }), error => error.code === 'INVALID_TARGET_URL_CREDENTIALS');
assert.throws(() => validatePublicScrapeTarget('https://127.0.0.1/', { allowedHosts }), error => error.code === 'UNSAFE_TARGET_HOST');
assert.throws(() => validatePublicScrapeTarget('https://evil.example.net/', { allowedHosts }), error => error.code === 'SCRAPE_HOST_NOT_ALLOWED');
assert.throws(() => validatePublicScrapeTarget('https://example.com/login', { allowedHosts }), error => error.code === 'SENSITIVE_TARGET_PATH');
assert.throws(() => validatePublicScrapeTarget('https://example.com/data?access_token=secret', { allowedHosts }), error => error.code === 'SENSITIVE_TARGET_QUERY');
assert.equal(_test.hostAllowed('cdn.example.com', ['example.com'], true), true);
assert.equal(_test.hostAllowed('cdn.example.com', ['example.com'], false), false);

const resolutions = [];
const fetches = [];
const result = await fetchAllowedScrapeText('https://example.com/start?asset=PETR4', {
  allowedHosts,
  resolver: async host => { resolutions.push(host); return [{ address: '93.184.216.34', family: 4 }]; },
  fetcher: async url => {
    fetches.push(url);
    if (url.includes('/start')) return { status: 302, location: '/final?asset=PETR4', text: '' };
    return { status: 200, text: '<html>ok</html>', finalUrl: url, cacheStatus: 'LIVE' };
  },
});
assert.equal(result.status, 200);
assert.equal(result.redirectCount, 1);
assert.deepEqual(resolutions, ['example.com', 'example.com']);
assert.equal(fetches.length, 2);
assert.equal(result.diagnosticUrl, 'https://example.com/final');
assert.equal(result.hops.every(hop => !hop.url.includes('?')), true);

await assert.rejects(
  fetchAllowedScrapeText('https://example.com/start', {
    allowedHosts,
    resolver: async () => [{ address: '93.184.216.34', family: 4 }],
    fetcher: async () => ({ status: 302, location: 'https://evil.example.net/private' }),
  }),
  error => error.code === 'SCRAPE_HOST_NOT_ALLOWED',
);

let fetchedAfterDnsFailure = false;
await assert.rejects(
  fetchAllowedScrapeText('https://example.com/start', {
    allowedHosts,
    resolver: async () => { throw Object.assign(new Error('private'), { code: 'UNSAFE_RESOLVED_ADDRESS' }); },
    fetcher: async () => { fetchedAfterDnsFailure = true; return { status: 200 }; },
  }),
  error => error.code === 'UNSAFE_RESOLVED_ADDRESS',
);
assert.equal(fetchedAfterDnsFailure, false);

await assert.rejects(
  fetchAllowedScrapeText('https://example.com/a', {
    allowedHosts,
    resolver: async () => [{ address: '93.184.216.34', family: 4 }],
    fetcher: async url => ({ status: 302, location: url.endsWith('/a') ? '/b' : '/a' }),
  }),
  error => error.code === 'SCRAPE_REDIRECT_LOOP',
);

await assert.rejects(
  fetchAllowedScrapeText('https://example.com/0', {
    allowedHosts,
    maxRedirects: 1,
    resolver: async () => [{ address: '93.184.216.34', family: 4 }],
    fetcher: async url => ({ status: 302, location: `/${Number(url.split('/').pop()) + 1}` }),
  }),
  error => error.code === 'SCRAPE_REDIRECT_LIMIT',
);

console.log('safe-target-fetch-v362 ok');
