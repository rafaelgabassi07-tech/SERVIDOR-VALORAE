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
function authenticatedHeaders(url, method = 'GET', extras = {}) {
  return {
    'x-valorae-app': 'VALORAE Android',
    'x-valorae-channel': 'android',
    'x-valorae-app-version': '2026.07.30.03',
    'x-valorae-build': 'release',
    'x-valorae-app-id': 'com.aistudio.carteira.kxmpzq',
    'x-valorae-mobile-protocol': '2026.07.10.10',
    'x-request-id': `logo-test-${requestSequence}`,
    ...extras,
  };
}
async function invoke(url, method = 'GET', headers = undefined) {
  const res = response();
  const effectiveHeaders = headers === undefined ? authenticatedHeaders(url, method) : headers;
  await dispatchRoute({ method, url, headers: effectiveHeaders, socket: { remoteAddress: `127.0.4.${requestSequence++}` } }, res);
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
const originalRate = process.env.VALORAE_RATE_LIMIT_DISABLED;
const originalApkOnly = process.env.VALORAE_APK_ONLY;
const calls = [];

globalThis.fetch = async (url) => {
  const raw = String(url);
  calls.push(raw);
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
  process.env.VALORAE_APK_ONLY = '1';
  clearCache();
  clearOfficialAssetLogoCache();

  for (const ticker of ['VALE3', 'ITUB4', 'BBAS3', 'WEGE3']) {
    const logo = await fetchOfficialAssetLogo(ticker, { cache: false, timeoutMs: 3200 });
    assert.equal(logo?.ticker, ticker);
    assert.equal(logo?.contentType, 'image/png');
    assert.equal(logo?.bytes?.length, 640);
    assert.match(logo?.source || '', /Investidor10/, `${ticker} deve usar a página real do ativo antes do placeholder legado`);
    assert.match(logo?.sourceUrl || '', new RegExp(ticker, 'i'));
  }

  const publicLogo = await invoke('/api/v1/asset/logo?ticker=VALE3&cache=false&v=5', 'GET', {});
  assert.equal(publicLogo.statusCode, 200, 'Coil e outros carregadores de imagem não enviam headers canônicos do APK');
  assert.equal(publicLogo.getHeader('X-Valorae-Logo-Ticker'), 'VALE3');

  const routeLogo = await invoke('/api/v1/asset/logo?ticker=VALE3&cache=false&v=5');
  assert.equal(routeLogo.statusCode, 200);
  assert.equal(routeLogo.getHeader('X-Valorae-Auth-Bypass'), undefined);
  assert.equal(routeLogo.getHeader('X-Valorae-Logo-Contract'), OFFICIAL_ASSET_LOGO_VERSION);
  assert.equal(routeLogo.getHeader('X-Valorae-Logo-Ticker'), 'VALE3');
  assert.match(routeLogo.getHeader('X-Valorae-Logo-Source') || '', /Investidor10/);
  assert.equal(routeLogo.getHeader('X-Valorae-Logo-Provider'), 'investidor10');
  assert.equal(routeLogo.getHeader('X-Valorae-Logo-Tier'), 'ASSET_PAGE');
  assert.equal(routeLogo.getHeader('Content-Type'), 'image/png');
  assert.equal(Buffer.isBuffer(routeLogo.body), true);

  const callsBeforeFii = calls.length;
  const directFiiLogo = await fetchOfficialAssetLogo('HGLG11', { cache: false, timeoutMs: 3200 });
  assert.equal(directFiiLogo, null);
  const headLogo = await invoke('/api/v1/asset/logo?ticker=HGLG11&cache=false&v=5', 'HEAD');
  assert.equal(headLogo.statusCode, 204);
  assert.equal(headLogo.body, '');
  assert.equal(headLogo.getHeader('X-Valorae-Logo-Ticker'), 'HGLG11');
  assert.equal(headLogo.getHeader('X-Valorae-Logo-Status'), 'NOT_APPLICABLE');
  const fiiJson = await invoke('/api/v1/asset/logo?ticker=HGLG11&format=json&cache=false&v=5');
  assert.equal(fiiJson.statusCode, 200);
  assert.equal(JSON.parse(fiiJson.body).status, 'NOT_APPLICABLE');
  assert.equal(calls.length, callsBeforeFii, 'FII não deve iniciar qualquer busca externa de logotipo');

  assert.equal(calls.some(url => url.includes('investidor10.com.br/acoes/vale3/')), true);
  assert.equal(calls.some(url => url.includes('investidor10.com.br/fiis/hglg11/')), false);
  console.log('asset-logo-multisource-v335 fallback ok');
} finally {
  globalThis.fetch = originalFetch;
  clearCache();
  clearOfficialAssetLogoCache();
  if (originalRate === undefined) delete process.env.VALORAE_RATE_LIMIT_DISABLED; else process.env.VALORAE_RATE_LIMIT_DISABLED = originalRate;
  if (originalApkOnly === undefined) delete process.env.VALORAE_APK_ONLY; else process.env.VALORAE_APK_ONLY = originalApkOnly;
}
