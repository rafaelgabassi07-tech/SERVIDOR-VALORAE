import assert from 'node:assert/strict';
import { fetchOfficialStatusInvestLogo, officialStatusInvestLogoCandidates } from '../lib/market/official-logo.js';

assert.deepEqual(officialStatusInvestLogoCandidates('MXRF11'), [], 'FIIs não devem possuir candidatos de logotipo');
assert.match(officialStatusInvestLogoCandidates('TAEE11')[0], /\/acao\//, 'unit não pode ser consultada primeiro como FII');

const originalFetch = globalThis.fetch;
let requested = '';
globalThis.fetch = async url => {
  requested = String(url);
  return new Response(new Uint8Array(512).fill(7), { status: 200, headers: { 'content-type': 'image/png' } });
};
try {
  const fiiResult = await fetchOfficialStatusInvestLogo('MXRF11', { cache: false, timeoutMs: 500 });
  assert.equal(fiiResult, null);
  assert.equal(requested, '', 'FII não deve iniciar chamada externa de logotipo');

  const stockResult = await fetchOfficialStatusInvestLogo('TAEE11', { cache: false, timeoutMs: 500 });
  assert.ok(stockResult?.bytes?.length === 512);
  assert.equal(stockResult.contentType, 'image/png');
  assert.match(requested, /companytickerimage\?ticker=TAEE11/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('official-logo-fallback-v307 ok');
