import { dispatchRoute } from '../routes/_router.js';
import { observeStaticAssetRequest, observabilitySnapshot, resetObservabilityForTests } from '../lib/observability/metrics.js';

function mockReq(url, options = {}) {
  return {
    method: options.method || 'GET',
    url,
    query: options.query || {},
    body: options.body,
    rawBody: options.rawBody,
    headers: {
      host: 'example.vercel.app',
      origin: 'https://app.audit.example',
      'user-agent': 'audit-client/1.0',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': '203.0.113.10',
      'x-valorae-client-id': 'audit-app',
      ...(options.headers || {}),
    },
    socket: { remoteAddress: '203.0.113.10' },
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writableEnded: false,
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; },
    hasHeader(k) { return Object.prototype.hasOwnProperty.call(this.headers, String(k).toLowerCase()); },
    status(c) { this.statusCode = Number(c); return this; },
    write(chunk = '') { this.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk); return true; },
    end(chunk = '') { if (chunk) this.write(chunk); this.writableEnded = true; return this; },
    send(body = '') { return this.end(body); },
    json(payload) { const body = JSON.stringify(payload ?? null); this.setHeader('Content-Type', 'application/json; charset=utf-8'); this.setHeader('Content-Length', String(Buffer.byteLength(body))); return this.end(body); },
    once() { return this; },
  };
}

async function call(url, options = {}) {
  const req = mockReq(url, options);
  const res = mockRes();
  await dispatchRoute(req, res);
  return { req, res, json: JSON.parse(res.body || '{}') };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

resetObservabilityForTests();

await call('/api/health');
await call('/api/ready', { headers: { 'x-valorae-dashboard-probe': '1', 'x-valorae-client-id': 'dashboard-ui' } });
await call('/api/observability?minutes=60', { headers: { 'x-valorae-client-id': 'dashboard-ui' } });

let snap = observabilitySnapshot({ minutes: 60 });
assert(snap.totals.requests === 1, `esperado 1 request de proxy, veio ${snap.totals.requests}`);
assert(snap.measurement.observabilityReads >= 1, 'leituras de observability devem ser contadas separadamente');
assert(snap.measurement.internalProbeReads >= 1, 'probes internos do dashboard devem ser contados separadamente');
assert(snap.top.clients.some(c => c.app === 'audit-app'), 'cliente audit-app precisa aparecer como consumidor real');
assert(snap.distributions.contentTypes.some(x => x.name === 'JSON' && x.value > 0), 'Content-Type JSON de API não foi medido');
assert(snap.delivery.apiResponses.bytes > 0, 'bytes de respostas API precisam ser medidos');
assert(snap.top.dataDeliveries.length > 0, 'famílias de entrega de dados precisam ser geradas');
assert(snap.top.ips.every(x => /^ip-[a-f0-9]{10}$/.test(x.name)), 'IPs precisam permanecer anonimizados');

const staticReq = mockReq('/index.html', { headers: { 'x-valorae-client-id': 'browser-ui', 'user-agent': 'Mozilla/5.0 Audit' } });
const staticRes = mockRes();
staticRes.statusCode = 200;
staticRes.setHeader('Content-Type', 'text/html; charset=utf-8');
staticRes.setHeader('Content-Length', '32');
observeStaticAssetRequest(staticReq, staticRes, { pathname: '/index.html', filePath: '/public/index.html', contentType: 'text/html; charset=utf-8', bytes: 32 });
staticRes.write('<!doctype html>');
staticRes.end('<html></html>');

snap = observabilitySnapshot({ minutes: 60 });
assert(snap.delivery.publicAssets.completed >= 1, 'arquivos públicos entregues precisam ser medidos');
assert(snap.top.publicFiles.some(f => f.path === '/index.html'), 'arquivo público /index.html precisa aparecer no painel');
assert(snap.distributions.staticExtensions.some(x => x.name === '.html'), 'extensão .html precisa ser distribuída');
assert(snap.delivery.privacy.storesBody === false, 'observability não deve declarar armazenamento de corpo');
assert(snap.measurement.payloadPrivacy.measured === true, 'medição de privacidade do payload precisa estar explícita');

console.log('Observability harmony OK: Proxy, dados API, arquivos públicos, probes internos, clientes, CORS e privacidade estão integrados.');
