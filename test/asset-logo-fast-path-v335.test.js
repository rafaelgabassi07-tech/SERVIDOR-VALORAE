import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';
import {
  OFFICIAL_ASSET_LOGO_VERSION,
  clearOfficialAssetLogoCache,
  fetchOfficialAssetLogo
} from '../lib/market/official-logo.js';
import { dispatchRoute } from '../routes/_router.js';

function fakePng(seed = 1) {
  const bytes = Buffer.alloc(768, seed);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(96, 16);
  bytes.writeUInt32BE(96, 20);
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

let requestSequence = 70;
async function invoke(url, { method = 'GET', headers = {} } = {}) {
  const res = response();
  await dispatchRoute({ method, url, headers, socket: { remoteAddress: `127.0.5.${requestSequence++}` } }, res);
  return res;
}

const originalFetch = globalThis.fetch;
const originalKeys = process.env.VALORAE_CLIENT_KEYS;
const originalAuth = process.env.VALORAE_REQUIRE_CLIENT_AUTH;
const originalRate = process.env.VALORAE_RATE_LIMIT_DISABLED;
const calls = [];
let valePageCalls = 0;
let petrYahooCalls = 0;

globalThis.fetch = async (url) => {
  const raw = String(url);
  calls.push(raw);

  if (raw.includes('/v6/finance/quote')) {
    if (raw.includes('PETR4.SA')) {
      petrYahooCalls += 1;
      return new Response(JSON.stringify({
        quoteResponse: { result: [{ symbol: 'PETR4.SA', companyLogoUrl: 'https://s.yimg.com/cv/apiv2/default/finance/logo/petr4.png' }] }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ quoteResponse: { result: [] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (raw.includes('s.yimg.com')) {
    return new Response(fakePng(4), { status: 200, headers: { 'content-type': 'image/png' } });
  }

  if (raw.includes('investidor10.com.br/acoes/vale3/')) {
    valePageCalls += 1;
    return new Response(
      '<html><img class="company-logo profile" alt="VALE3 logo oficial" src="https://cdn.investidor10.com.br/logos/vale3.png"></html>',
      { status: 200, headers: { 'content-type': 'text/html' } }
    );
  }
  if (raw.includes('cdn.investidor10.com.br/logos/vale3.png')) {
    return new Response(fakePng(3), { status: 200, headers: { 'content-type': 'image/png' } });
  }

  if (raw.includes('investidor10.com.br/acoes/petr4/')) {
    // A corrida primária pode iniciar a página junto do Yahoo. A resposta sem candidato
    // comprova que o vencedor rápido continua sendo Yahoo sem acionar o fallback legado.
    return new Response('<html><body>PETR4 sem imagem nesta simulação</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' }
    });
  }

  if (raw.includes('statusinvest.com.br')) {
    throw new Error(`fallback legado não deve ser chamado quando um primário resolve: ${raw}`);
  }
  return new Response('', { status: 404 });
};

try {
  process.env.VALORAE_RATE_LIMIT_DISABLED = '1';
  process.env.VALORAE_CLIENT_KEYS = 'protected-app:protected-key';
  process.env.VALORAE_REQUIRE_CLIENT_AUTH = '1';
  clearCache();
  clearOfficialAssetLogoCache();

  const [first, coalesced] = await Promise.all([
    fetchOfficialAssetLogo('VALE3', { cache: true, timeoutMs: 4200 }),
    fetchOfficialAssetLogo('VALE3', { cache: true, timeoutMs: 4200 })
  ]);
  assert.equal(first?.providerKey, 'investidor10');
  assert.equal(first?.providerTier, 'ASSET_PAGE');
  assert.match(first?.source || '', /Investidor10/i);
  assert.equal(first?.contentType, 'image/png');
  assert.equal(coalesced?.providerKey, 'investidor10');
  assert.equal(coalesced?.cache, 'COALESCED');
  assert.equal(valePageCalls, 1, 'requisições concorrentes do mesmo ticker devem compartilhar o resolver');

  const cached = await fetchOfficialAssetLogo('VALE3', { cache: true, timeoutMs: 4200 });
  assert.equal(cached?.cache, 'HIT');
  assert.equal(valePageCalls, 1, 'cache positivo não deve consultar a fonte novamente');

  clearCache();
  clearOfficialAssetLogoCache();
  const yahoo = await fetchOfficialAssetLogo('PETR4', { cache: true, timeoutMs: 3200 });
  assert.equal(yahoo?.providerKey, 'yahoo');
  assert.equal(yahoo?.providerTier, 'FAST_API');
  assert.match(yahoo?.source || '', /Yahoo Finance/i);
  assert.equal(petrYahooCalls, 1);

  const routeLogo = await invoke('/api/v1/asset/logo?ticker=VALE3&cache=false&v=5');
  assert.equal(routeLogo.statusCode, 200);
  assert.equal(routeLogo.getHeader('X-Valorae-Logo-Contract'), OFFICIAL_ASSET_LOGO_VERSION);
  assert.equal(routeLogo.getHeader('X-Valorae-Logo-Provider'), 'investidor10');
  assert.equal(routeLogo.getHeader('X-Valorae-Logo-Tier'), 'ASSET_PAGE');
  assert.match(routeLogo.getHeader('Cache-Control') || '', /max-age=604800/);
  assert.ok(Number(routeLogo.getHeader('X-Valorae-Logo-Elapsed-Ms')) >= 0);
  assert.match(routeLogo.getHeader('Server-Timing') || '', /^logo;dur=/);
  const etag = routeLogo.getHeader('ETag');
  assert.ok(etag);

  const notModified = await invoke('/api/v1/asset/logo?ticker=VALE3&v=5', {
    headers: { 'if-none-match': etag }
  });
  assert.equal(notModified.statusCode, 304);
  assert.equal(notModified.body, '');

  console.log('asset-logo-fast-path-v335 yahoo+investidor10 ok');
} finally {
  globalThis.fetch = originalFetch;
  clearCache();
  clearOfficialAssetLogoCache();
  if (originalKeys === undefined) delete process.env.VALORAE_CLIENT_KEYS; else process.env.VALORAE_CLIENT_KEYS = originalKeys;
  if (originalAuth === undefined) delete process.env.VALORAE_REQUIRE_CLIENT_AUTH; else process.env.VALORAE_REQUIRE_CLIENT_AUTH = originalAuth;
  if (originalRate === undefined) delete process.env.VALORAE_RATE_LIMIT_DISABLED; else process.env.VALORAE_RATE_LIMIT_DISABLED = originalRate;
}
