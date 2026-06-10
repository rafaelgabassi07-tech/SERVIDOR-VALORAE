import assert from 'node:assert/strict';
import route from '../routes/portfolio/insights-bundle.js';
function req(body = {}) {
  return { method: 'POST', url: '/api/v1/mobile/portfolio-sync', headers: { host: 'localhost' }, body };
}
function res() {
  return { statusCode: 200, headers: {}, body: null, status(c) { this.statusCode = c; return this; }, setHeader(k,v) { this.headers[k]=v; }, json(p) { this.body = p; return this; }, send(p) { this.body = p; return this; } };
}
const response = res();
await route(req({
  positions: [{ ticker: 'BBAS3', quantity: 10, averagePrice: 25, purchaseDate: '2024-01-10' }],
  includeRankings: false,
  includeDividends: true,
  includeHistory: false,
  includeIpca: false,
  includeAnalysis: true
}), response);
const payload = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
assert.equal(response.statusCode, 200);
assert.equal(payload.endpoint, 'mobile-portfolio-sync');
assert.equal(payload.bundleVersion, '21.12.93');
assert.equal(payload.contract.name, 'valorae-mobile-portfolio-sync');
assert.equal(payload.contract.style, 'valorae-single-request-cache-first');
assert.equal(payload.includeRankings, false);
assert.ok(payload.blockStatus.rankings.skipped);
console.log('Mobile portfolio contract smoke v21.12.93 OK');
