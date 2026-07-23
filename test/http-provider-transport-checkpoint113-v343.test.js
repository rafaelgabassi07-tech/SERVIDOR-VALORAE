import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {
  VALORAE_HTTP_TRANSPORT_IMPLEMENTATION,
  VALORAE_HTTP_TRANSPORT_POLICY,
  VALORAE_HTTP_TRANSPORT_VERSION,
  buildProviderTransportManifest,
  providerFetch,
  providerNameForUrl,
  providerTransportStats,
  resetProviderTransportForTests,
  resolveProviderTransportProfile,
} from '../lib/http/provider-transport.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';

const originalFetch = globalThis.fetch;
const envKeys = [
  'VALORAE_HTTP_TRANSPORT_ENABLED',
  'VALORAE_HTTP_TRANSPORT_MODE',
  'VALORAE_HTTP_LEGACY_FALLBACK',
  'VALORAE_HTTP_GENERIC_CONNECTIONS',
  'VALORAE_HTTP_GENERIC_MAX_CONCURRENCY',
  'VALORAE_HTTP_YAHOO_MAX_CONCURRENCY',
  'VALORAE_HTTP_YAHOO_MAX_QUEUE',
  'VALORAE_HTTP_YAHOO_QUEUE_TIMEOUT_MS',
  'VALORAE_HTTP_YAHOO_TOTAL_TIMEOUT_MS',
];
const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const waitUntil = async (predicate, timeoutMs = 2000) => {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('timeout aguardando condição de teste');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};

function responseHarness() {
  const headers = new Map();
  let body = '';
  return {
    response: {
      statusCode: 200,
      writableEnded: false,
      setHeader(k, v) { headers.set(String(k).toLowerCase(), String(v)); },
      getHeader(k) { return headers.get(String(k).toLowerCase()); },
      removeHeader(k) { headers.delete(String(k).toLowerCase()); },
      end(value = '') { body += String(value); this.writableEnded = true; return this; },
      status(code) { this.statusCode = code; return this; },
      send(value) { return this.end(value); },
    },
    headers,
    json() { return JSON.parse(body || '{}'); },
  };
}

try {
  process.env.VALORAE_HTTP_TRANSPORT_ENABLED = '1';
  process.env.VALORAE_HTTP_TRANSPORT_MODE = 'managed';
  process.env.VALORAE_HTTP_LEGACY_FALLBACK = '1';

  assert.equal(providerNameForUrl('https://investidor10.com.br/acoes/petr4/'), 'investidor10');
  assert.equal(providerNameForUrl('https://query1.finance.yahoo.com/v8/finance/chart/PETR4.SA'), 'yahoo');
  assert.equal(providerNameForUrl('https://api.bcb.gov.br/dados/serie'), 'bcb');
  const yahooProfile = resolveProviderTransportProfile('https://query1.finance.yahoo.com/v8/finance/chart/PETR4.SA');
  assert.ok(yahooProfile.connections >= 1);
  assert.ok(yahooProfile.maxConcurrency >= yahooProfile.connections);
  assert.ok(yahooProfile.connectTimeoutMs < yahooProfile.totalTimeoutMs);
  assert.ok(yahooProfile.headersTimeoutMs < yahooProfile.totalTimeoutMs);
  assert.ok(yahooProfile.bodyTimeoutMs <= yahooProfile.totalTimeoutMs);

  const manifest = buildProviderTransportManifest();
  assert.equal(manifest.version, VALORAE_HTTP_TRANSPORT_VERSION);
  assert.equal(manifest.policyVersion, VALORAE_HTTP_TRANSPORT_POLICY);
  assert.equal(manifest.implementation, VALORAE_HTTP_TRANSPORT_IMPLEMENTATION);
  assert.equal(manifest.hiddenFromUi, true);
  assert.equal(manifest.guarantees.financialPayloadShapeUnchanged, true);
  assert.equal(manifest.guarantees.separateConnectHeadersBodyAndTotalTimeouts, true);
  assert.equal(manifest.rollback.mode, 'VALORAE_HTTP_TRANSPORT_MODE=legacy');

  // Dispatcher real + Pool real: uma conexão mantida e reutilizada quando o pool é configurado com um socket.
  process.env.VALORAE_HTTP_GENERIC_CONNECTIONS = '1';
  process.env.VALORAE_HTTP_GENERIC_MAX_CONCURRENCY = '1';
  await resetProviderTransportForTests();
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    sockets.add(req.socket.remotePort);
    res.setHeader('content-type', 'application/json');
    res.end('{"ok":true}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    for (let index = 0; index < 3; index += 1) {
      const response = await providerFetch(`http://127.0.0.1:${port}/reuse`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
    }
    if (manifest.guarantees.poolsPerOriginAndProvider) {
      assert.equal(sockets.size, 1, 'Pool com uma conexão deve reutilizar o mesmo socket HTTP keep-alive');
      assert.equal(providerTransportStats().pools, 1);
    } else {
      assert.ok(sockets.size >= 1, 'fetch nativo deve concluir as requisições quando undici não estiver instalado');
      assert.equal(providerTransportStats().pools, 0);
      assert.ok(providerTransportStats().providers.generic.legacyFallbacks >= 3);
    }
  } finally {
    await resetProviderTransportForTests();
    await new Promise(resolve => server.close(resolve));
  }
  delete process.env.VALORAE_HTTP_GENERIC_CONNECTIONS;
  delete process.env.VALORAE_HTTP_GENERIC_MAX_CONCURRENCY;

  // Concorrência limitada e fila com backpressure sem disparar chamadas extras ao provedor.
  process.env.VALORAE_HTTP_YAHOO_MAX_CONCURRENCY = '1';
  process.env.VALORAE_HTTP_YAHOO_MAX_QUEUE = '1';
  process.env.VALORAE_HTTP_YAHOO_QUEUE_TIMEOUT_MS = '5000';
  process.env.VALORAE_HTTP_YAHOO_TOTAL_TIMEOUT_MS = '10000';
  await resetProviderTransportForTests();
  let active = 0;
  let maxActive = 0;
  const releases = [];
  globalThis.fetch = async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise(resolve => releases.push(resolve));
    active -= 1;
    return new Response('{"chart":{"result":[]}}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/PETR4.SA';
  const first = providerFetch(yahooUrl);
  await waitUntil(() => releases.length === 1);
  const second = providerFetch(`${yahooUrl}?second=1`);
  await waitUntil(() => providerTransportStats().providers.yahoo?.queuedNow === 1);
  await assert.rejects(providerFetch(`${yahooUrl}?third=1`), error => error?.code === 'VALORAE_HTTP_BACKPRESSURE');
  releases[0]();
  await first;
  await waitUntil(() => releases.length === 2);
  releases[1]();
  await second;
  assert.equal(maxActive, 1);
  assert.equal(providerTransportStats().providers.yahoo.queueRejected, 1);

  // Cancelamento do consumidor remove a requisição da fila antes de chegar à rede.
  process.env.VALORAE_HTTP_YAHOO_MAX_QUEUE = '2';
  await resetProviderTransportForTests();
  const cancellationReleases = [];
  globalThis.fetch = async () => {
    await new Promise(resolve => cancellationReleases.push(resolve));
    return new Response('{}', { status: 200 });
  };
  const blocking = providerFetch(yahooUrl);
  await waitUntil(() => cancellationReleases.length === 1);
  const controller = new AbortController();
  const cancelled = providerFetch(`${yahooUrl}?cancel=1`, { signal: controller.signal });
  await waitUntil(() => providerTransportStats().providers.yahoo?.queuedNow === 1);
  controller.abort();
  await assert.rejects(cancelled, error => error?.name === 'AbortError');
  assert.equal(providerTransportStats().providers.yahoo.queuedNow, 0);
  assert.equal(providerTransportStats().providers.yahoo.cancelled, 1);
  cancellationReleases[0]();
  await blocking;

  // Falha específica do dispatcher cai imediatamente no fetch legado, mantendo o mesmo contrato Response.
  await resetProviderTransportForTests();
  let fallbackCalls = 0;
  globalThis.fetch = async (_url, init = {}) => {
    fallbackCalls += 1;
    if (init.dispatcher) throw new TypeError('dispatcher incompatible for controlled test');
    return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const fallbackResponse = await providerFetch(yahooUrl);
  assert.equal(fallbackResponse.status, 200);
  if (manifest.guarantees.poolsPerOriginAndProvider) {
    assert.equal(fallbackCalls, 2, 'dispatcher incompatível deve repetir via fetch legado');
    assert.equal(providerTransportStats().providers.yahoo.legacyFallbacks, 1);
  } else {
    assert.equal(fallbackCalls, 1, 'sem undici o fetch nativo já é o transporte compatível');
    assert.equal(providerTransportStats().providers.yahoo.legacyFallbacks, 1);
  }

  // Rollback operacional não cria dispatcher nem altera a assinatura do fetch antigo.
  await resetProviderTransportForTests();
  process.env.VALORAE_HTTP_TRANSPORT_MODE = 'legacy';
  let legacyDispatcher = 'not-called';
  globalThis.fetch = async (_url, init = {}) => {
    legacyDispatcher = init.dispatcher;
    return new Response('{}', { status: 200 });
  };
  await providerFetch(yahooUrl);
  assert.equal(legacyDispatcher, undefined);
  assert.equal(providerTransportStats().providers.yahoo.legacyRequests, 1);
  process.env.VALORAE_HTTP_TRANSPORT_MODE = 'managed';

  globalThis.fetch = originalFetch;
  await resetProviderTransportForTests();
  const routed = responseHarness();
  await dispatchRoute({ method: 'GET', url: '/api/v1/contract/http-transport', headers: { 'x-request-id': 'cp113-http' } }, routed.response);
  assert.equal(routed.response.statusCode, 200);
  assert.equal(routed.headers.get('x-valorae-http-transport'), VALORAE_HTTP_TRANSPORT_VERSION);
  assert.equal(routed.json().version, VALORAE_HTTP_TRANSPORT_VERSION);
  assert.ok(routeManifest().routes.includes('/contract/http-transport'));

  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies.undici, '^7.28.0');
} finally {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  await resetProviderTransportForTests();
}

console.log('http-provider-transport-checkpoint113-v343 ok');
