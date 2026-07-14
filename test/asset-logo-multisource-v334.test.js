import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';
import {
  OFFICIAL_ASSET_LOGO_VERSION,
  clearOfficialAssetLogoCache,
  extractInvestidor10LogoCandidates,
  fetchOfficialAssetLogo
} from '../lib/market/official-logo.js';
import { dispatchRoute } from '../routes/_router.js';

function fakePng(seed = 1) {
  const bytes = Buffer.alloc(640, seed);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(72, 16);
  bytes.writeUInt32BE(72, 20);
  return bytes;
}

function response() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: '',
    writableEnded: false,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    end(value = '') { this.body = Buffer.isBuffer(value) ? value : String(value); this.writableEnded = true; return this; },
    status(code) { this.statusCode = code; return this; },
    send(value) { return this.end(value); }
  };
}

let requestSequence = 30;
async function invoke(url, method = 'GET') {
  const res = response();
  await dispatchRoute({ method, url, headers: {}, socket: { remoteAddress: `127.0.4.${requestSequence++}` } }, res);
  return res;
}

const htmlCandidates = extractInvestidor10LogoCandidates(
  '<img class="company-logo" alt="VALE3 logo oficial" data-src="https://cdn.investidor10.com.br/logos/vale3.png">',
  'https://investidor10.com.br/acoes/vale3/',
  'VALE3'
);
assert.deepEqual(htmlCandidates, ['https://cdn.investidor10.com.br/logos/vale3.png']);
assert.deepEqual(
  extractInvestidor10LogoCandidates(
    '<img class="company-logo" alt="PETR4 logo" src="https://cdn.investidor10.com.br/logos/petr4.png">',
    'https://investidor10.com.br/acoes/vale3/',
    'VALE3'
  ),
  [],
  'um logo de outro emissor não pode ser aceito para o ticker atual'
);

const originalFetch = globalThis.fetch;
const originalKeys = process.env.VALORAE_CLIENT_KEYS;
const originalAuth = process.env.VALORAE_REQUIRE_CLIENT_AUTH;
const originalRate = process.env.VALORAE_RATE_LIMIT_DISABLED;
const calls = [];

globalThis.fetch = async (url) => {
  const raw = String(url);
  calls.push(raw);
  if (raw.includes('brapi.dev')) {
    return new Response(JSON.stringify({ error: 'token-required' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  if (raw.includes('/v6/finance/quote')) {
    const isPetr = raw.includes('PETR4.SA');
    return new Response(JSON.stringify({
      quoteResponse: {
        result: isPetr ? [{ symbol: 'PETR4.SA', companyLogoUrl: 'https://s.yimg.com/cv/apiv2/default/finance/logo/petr4.png' }] : []
      }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (raw.includes('s.yimg.com')) return new Response(fakePng(8), { status: 200, headers: { 'content-type': 'image/png' } });
  if (raw.includes('statusinvest.com.br')) {
    // Reproduz o endpoint legado devolvendo a mesma imagem genérica para qualquer ticker.
    return new Response(fakePng(2), { status: 200, headers: { 'content-type': 'image/png' } });
  }
  const page = raw.match(/investidor10\.com\.br\/(acoes|fiis)\/(vale3|itub4|bbas3|wege3|hglg11|knri11)\/?/i);
  if (page) {
    const ticker = page[2].toUpperCase();
    return new Response(
      `<html><img class="company-logo profile" alt="${ticker} logo oficial" src="https://cdn.investidor10.com.br/logos/${ticker}.png"></html>`,
      { status: 200, headers: { 'content-type': 'text/html' } }
    );
  }
  const image = raw.match(/cdn\.investidor10\.com\.br\/logos\/(VALE3|ITUB4|BBAS3|WEGE3|HGLG11|KNRI11)\.png/i);
  if (image) return new Response(fakePng(image[1].charCodeAt(0)), { status: 200, headers: { 'content-type': 'image/png' } });
  return new Response('', { status: 404 });
};

try {
  process.env.VALORAE_RATE_LIMIT_DISABLED = '1';
  process.env.VALORAE_CLIENT_KEYS = 'protected-app:protected-key';
  process.env.VALORAE_REQUIRE_CLIENT_AUTH = '1';
  clearCache();
  clearOfficialAssetLogoCache();

  for (const ticker of ['VALE3', 'ITUB4', 'BBAS3', 'WEGE3', 'HGLG11', 'KNRI11']) {
    const logo = await fetchOfficialAssetLogo(ticker, { cache: false, timeoutMs: 3200 });
    assert.equal(logo?.ticker, ticker);
    assert.equal(logo?.contentType, 'image/png');
    assert.equal(logo?.bytes?.length, 640);
    assert.match(logo?.source || '', /Investidor10/, `${ticker} deve usar a página real do ativo antes do placeholder legado`);
    assert.match(logo?.sourceUrl || '', new RegExp(ticker, 'i'));
  }

  const routeLogo = await invoke('/api/v1/asset/logo?ticker=VALE3&cache=false&v=4');
  assert.equal(routeLogo.statusCode, 200);
  assert.equal(routeLogo.getHeader('X-Valorae-Auth-Bypass'), 'public-asset-logo');
  assert.equal(routeLogo.getHeader('X-Valorae-Logo-Contract'), OFFICIAL_ASSET_LOGO_VERSION);
  assert.equal(routeLogo.getHeader('X-Valorae-Logo-Ticker'), 'VALE3');
  assert.match(routeLogo.getHeader('X-Valorae-Logo-Source') || '', /Investidor10/);
  assert.equal(routeLogo.getHeader('Content-Type'), 'image/png');
  assert.equal(Buffer.isBuffer(routeLogo.body), true);

  const headLogo = await invoke('/api/v1/asset/logo?ticker=HGLG11&cache=false&v=4', 'HEAD');
  assert.equal(headLogo.statusCode, 200);
  assert.equal(headLogo.body, '');
  assert.equal(headLogo.getHeader('X-Valorae-Logo-Ticker'), 'HGLG11');

  assert.equal(calls.some(url => url.includes('investidor10.com.br/acoes/vale3/')), true);
  assert.equal(calls.some(url => url.includes('investidor10.com.br/fiis/hglg11/')), true);
  console.log('asset-logo-multisource-v334 ok');
} finally {
  globalThis.fetch = originalFetch;
  clearCache();
  clearOfficialAssetLogoCache();
  if (originalKeys === undefined) delete process.env.VALORAE_CLIENT_KEYS; else process.env.VALORAE_CLIENT_KEYS = originalKeys;
  if (originalAuth === undefined) delete process.env.VALORAE_REQUIRE_CLIENT_AUTH; else process.env.VALORAE_REQUIRE_CLIENT_AUTH = originalAuth;
  if (originalRate === undefined) delete process.env.VALORAE_RATE_LIMIT_DISABLED; else process.env.VALORAE_RATE_LIMIT_DISABLED = originalRate;
}
