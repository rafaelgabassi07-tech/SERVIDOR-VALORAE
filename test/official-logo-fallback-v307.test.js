import assert from 'node:assert/strict';
import { fetchOfficialStatusInvestLogo, officialStatusInvestLogoCandidates } from '../lib/market/official-logo.js';

assert.match(officialStatusInvestLogoCandidates('MXRF11')[0], /fundos-imobiliarios/);
assert.match(officialStatusInvestLogoCandidates('TAEE11')[0], /\/acao\//, 'unit não pode ser consultada primeiro como FII');

const originalFetch = globalThis.fetch;
let requested = '';
globalThis.fetch = async url => {
  requested = String(url);
  return new Response(new Uint8Array(512).fill(7), { status: 200, headers: { 'content-type': 'image/png' } });
};
try {
  const result = await fetchOfficialStatusInvestLogo('MXRF11', { cache: false, timeoutMs: 500 });
  assert.ok(result?.bytes?.length === 512);
  assert.equal(result.contentType, 'image/png');
  assert.match(requested, /companytickerimage\?ticker=MXRF11/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('official-logo-fallback-v307 ok');
