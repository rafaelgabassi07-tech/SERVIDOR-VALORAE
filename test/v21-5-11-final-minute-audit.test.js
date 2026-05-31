import assert from 'node:assert/strict';
import { dispatchRoute, _test as routerTest } from '../routes/_router.js';
import { getInput, isReadLikeMethod } from '../lib/http/route.js';
import { ValoraeEngine } from '../lib/Valorae-engine.js';

class Res {
  constructor() { this.statusCode = 200; this.headers = {}; this.body = ''; this.ended = false; }
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
  getHeader(k) { return this.headers[k.toLowerCase()]; }
  removeHeader(k) { delete this.headers[k.toLowerCase()]; }
  status(n) { this.statusCode = n; return this; }
  send(b) { this.body = String(b); this.ended = true; return this; }
  end() { this.ended = true; return this; }
}

async function call(method, url, body = undefined) {
  const req = { method, url, headers: { host: 'example.vercel.app' }, query: undefined, body, socket: { remoteAddress: '127.0.0.1' } };
  const res = new Res();
  await dispatchRoute(req, res);
  return res;
}

assert.equal(ValoraeEngine.version, '21.12.0');
assert.equal(isReadLikeMethod('HEAD'), true);
assert.equal(getInput({ method: 'HEAD', query: { ticker: 'PETR4' }, body: { ticker: 'ERR' } }).ticker, 'PETR4');
assert.equal(routerTest.stripApiPrefix('/api/v1/ready'), '/v1/ready');
assert.equal(routerTest.stripApiPrefix('/apiary/ready'), '/apiary/ready');

const headReady = await call('HEAD', '/api/v1/ready?ticker=PETR4&profile=instant&view=quote&maxItems=1');
assert.equal(headReady.statusCode, 200, 'HEAD em rota GET leve deve preservar query string e retornar 200 sem depender de fonte externa');
assert.equal(headReady.body, '', 'HEAD não deve enviar corpo');
assert.ok(headReady.headers.etag || headReady.headers['cache-control'], 'HEAD deve manter headers de cache/ETag');

const apiary = await call('GET', '/apiary/ready');
assert.equal(apiary.statusCode, 404);
assert.ok(apiary.body.includes('/apiary/ready'), 'Caminhos similares a /api não devem ser truncados para /ary');

console.log('v21.12.0 final minute audit tests OK.');
