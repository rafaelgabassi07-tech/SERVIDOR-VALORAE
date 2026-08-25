import assert from 'node:assert/strict';
import { sendJson } from '../lib/core/http.js';
import { VALORAE_CONTRACT_RESPONSE_VERSION } from '../lib/contract/response.js';

function fakeResponse() {
  const headers = new Map();
  return {
    statusCode: 0,
    writableEnded: false,
    body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    end(body = '') { this.body = String(body); this.writableEnded = true; return this; },
    headers
  };
}

for (const endpointContract of [
  'valorae-portfolio-returns-v2-index-provider-parity',
  '26.asset-modal.stock.v59-contract-batching',
  '26.asset-modal.fii.v25-modal-source-repair'
]) {
  const req = { method: 'POST', url: '/api/v1/test', headers: {} };
  const res = fakeResponse();
  sendJson(req, res, { status: 'OK', contractVersion: endpointContract, payload: { value: 1 } });
  assert.equal(res.getHeader('X-Valorae-Contract-Version'), VALORAE_CONTRACT_RESPONSE_VERSION,
    'global header must keep the transport contract');
  assert.equal(res.getHeader('X-Valorae-Endpoint-Contract-Version'), endpointContract,
    'endpoint schema must be observable without replacing the transport contract');
  assert.equal(JSON.parse(res.body).contractVersion, endpointContract,
    'endpoint contract must remain in the JSON body');
}

console.log('http endpoint/global contract header v403: ok');

const { sendJson: sendPerformanceJson } = await import('../lib/performance/http.js');
const perfHeaders = new Map();
const perfRes = {
  statusCode: 0,
  setHeader(name, value) { perfHeaders.set(String(name).toLowerCase(), String(value)); },
  getHeader(name) { return perfHeaders.get(String(name).toLowerCase()); },
  removeHeader(name) { perfHeaders.delete(String(name).toLowerCase()); },
  status(code) { this.statusCode = code; return this; },
  send(value) { this.body = String(value); return this; },
  end(value = '') { this.body = String(value); return this; }
};
sendPerformanceJson(
  { method: 'GET', url: '/api/v1/asset/history', headers: {} },
  perfRes,
  { status: 'OK', contractVersion: 'asset-history-v7', points: [{ month: '2026-01', value: 1 }] },
  { cacheControl: 'private, max-age=60' }
);
assert.equal(perfRes.getHeader('X-Valorae-Contract-Version'), VALORAE_CONTRACT_RESPONSE_VERSION);
assert.equal(perfRes.getHeader('X-Valorae-Endpoint-Contract-Version'), 'asset-history-v7');
assert.ok(perfRes.getHeader('X-Valorae-Baseline-Contract'));
assert.ok(perfRes.getHeader('X-Valorae-Formal-Schema'));
console.log('performance HTTP strict contract headers v403: ok');
