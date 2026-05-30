import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { dispatchRoute } from '../routes/_router.js';
import { _test as routerTest } from '../api/router.js';
import { attachPartialDataGuidance } from '../lib/quality/partial-data-guidance.js';

class Res extends EventEmitter {
  constructor() { super(); this.statusCode = 200; this.headers = new Map(); this.body = ''; this.writableEnded = false; }
  setHeader(k, v) { this.headers.set(String(k).toLowerCase(), String(v)); }
  getHeader(k) { return this.headers.get(String(k).toLowerCase()); }
  status(code) { this.statusCode = code; return this; }
  send(body = '') { return this.end(body); }
  end(chunk = '') { this.body += String(chunk || ''); this.writableEnded = true; this.emit('close'); return this; }
}

async function call(url) {
  const req = { url, method: 'GET', headers: { host: 'localhost', 'user-agent': 'failure-audit-v21-12-38' }, socket: { remoteAddress: '127.0.0.1' }, query: {} };
  const res = new Res();
  await dispatchRoute(req, res);
  let json = null;
  try { json = JSON.parse(res.body); } catch {}
  return { res, json };
}

{
  const { res, json } = await call('/api/scrape');
  assert.equal(res.statusCode, 400);
  assert.equal(json.code, 'MISSING_TARGET_URL');
}
{
  const { res, json } = await call('/api/scrape?url=http%3A%2F%2Fexample.com&selector=h1&timeoutMs=500');
  assert.equal(res.statusCode, 400);
  assert.equal(json.code, 'INVALID_TARGET_URL_PROTOCOL');
}
{
  const { res, json } = await call('/api/scrape?url=https%3A%2F%2Fexample.com&selector=h1&timeoutMs=500');
  assert.equal(res.statusCode, 403);
  assert.equal(json.code, 'SCRAPE_HOST_NOT_ALLOWED');
}
{
  const req = { url: '/api/router?path=server/metrics', query: {}, headers: {} };
  routerTest.rewriteRequestForInternalRouter(req);
  assert.equal(req.url, '/api/server/metrics');
}
{
  const payload = attachPartialDataGuidance({ status: 'PARTIAL', partial: true, ticker: 'PETR4', appResponseIntegrity: { cacheSafe: false, renderSafe: true }, attempts: [{ provider: 'DirectFetch', ok: false, status: 403, error: 'blocked' }] }, { endpoint: 'asset', ticker: 'PETR4' });
  assert.equal(payload.partialDataGuidance.state, 'PARTIAL_SOURCE_DATA');
  assert.equal(payload.partialDataGuidance.canReplacePreviousSnapshot, false);
  assert.match(payload.partialDataGuidance.diagnostics.actionPlanEndpoint, /PETR4/);
}
{
  const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
  assert.deepEqual(metadata.majorCapabilities || [], []);
  assert.equal(metadata.version, '21.12.0');
  assert.match(metadata.releasePatch, /^21\.12\.(38|39|40|41|42|43|44|45|46|47|48|49|50|51)-/);
  assert.equal(fs.existsSync('build.gradle'), false);
  assert.equal(fs.existsSync('settings.gradle'), false);
  assert.equal(fs.existsSync('.gradle'), false);
}
{
  const html = fs.readFileSync('public/server.html', 'utf8');
  for (const needle of ['X-Valorae-Telemetry', 'id="densityToggleBtn"', 'id="anomalyChart"', 'engineCoreChart', 'engineCoreList', 'HTML family hit']) {
    assert.ok(html.includes(needle), `marcador ausente: ${needle}`);
  }
}

console.log('failure-audit-v21-12-38 OK');
