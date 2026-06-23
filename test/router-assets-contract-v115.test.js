import assert from 'node:assert/strict';
import { dispatchRoute } from '../routes/_router.js';

async function callJson(url) {
  let payload = '';
  const headers = {};
  const req = { method: 'GET', url, headers: {} };
  const res = {
    statusCode: 200,
    headers,
    setHeader(key, value) { headers[key.toLowerCase()] = value; },
    removeHeader(key) { delete headers[key.toLowerCase()]; },
    status(code) { this.statusCode = code; return this; },
    send(body) { payload = String(body ?? ''); return this; },
    end(body = '') { payload = String(body ?? ''); return this; },
  };
  await dispatchRoute(req, res);
  return { statusCode: res.statusCode, body: JSON.parse(payload || '{}'), headers };
}

const suggestions = await callJson('/api/v1/assets?q=PETR&suggest=true&searchMode=analysis&max=10');
assert.equal(suggestions.statusCode, 200, 'router /api/v1/assets deve responder 200 para sugestões');
assert.ok(['SUGGESTIONS', 'OK'].includes(suggestions.body.status), 'router deve usar contrato de sugestões, não batch vazio');
assert.ok(Array.isArray(suggestions.body.assets), 'assets deve ser array');
assert.ok(suggestions.body.assets.some(item => item.ticker === 'PETR4' || item.symbol === 'PETR4'), 'PETR deve sugerir PETR4');
assert.equal(suggestions.body.source, 'VALORAE_CATALOG');

const peers = await callJson('/api/v1/assets?peerOf=PETR4&sameSector=true&searchMode=analysis_comparison&suggest=true&max=12');
assert.equal(peers.statusCode, 200, 'router /api/v1/assets deve responder 200 para pares setoriais');
assert.equal(peers.body.strictSameSector, true, 'pares devem declarar setor estrito');
assert.ok(Array.isArray(peers.body.assets), 'assets de pares deve ser array');
assert.ok(peers.body.assets.some(item => item.ticker === 'PRIO3' || item.symbol === 'PRIO3'), 'PETR4 deve sugerir PRIO3 como par setorial');
assert.ok(!peers.body.assets.some(item => item.ticker === 'BBAS3' || item.symbol === 'BBAS3'), 'PETR4 não deve sugerir banco como par setorial');
assert.equal(peers.body.source, 'VALORAE_PEER_CATALOG');

console.log('Router assets contract v115 test OK.');
