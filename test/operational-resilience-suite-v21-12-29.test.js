import assert from 'node:assert/strict';
import { ValoraeEngine, runValoraeSelfTest } from '../lib/Valorae-engine.js';
import { buildFieldConsistencyGuard } from '../lib/quality/field-consistency-guard.js';
import { buildPayloadBudget } from '../lib/quality/payload-budget.js';
import { buildAssetActionPlan } from '../lib/quality/asset-action-plan.js';
import manifestHandler from '../routes/integration/manifest.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';

function mockReq(url, headers = {}) { return { method: 'GET', url, headers, socket: { remoteAddress: '127.0.0.1' } }; }
function mockRes() {
  const res = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.getHeader = k => res.headers[String(k).toLowerCase()];
  res.status = code => { res.statusCode = code; return res; };
  res.send = chunk => { if (chunk) res.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk); res.finished = true; return res; };
  res.json = obj => { res.body += JSON.stringify(obj); res.finished = true; return res; };
  res.end = chunk => { if (chunk) res.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk); res.finished = true; return res; };
  return res;
}
async function call(handler, url) { const req = mockReq(url); const res = mockRes(); await handler(req, res); return { res, json: JSON.parse(res.body || '{}') }; }

const samplePayload = {
  version: ValoraeEngine.version,
  status: 'PARTIAL',
  partial: true,
  ticker: 'HGLG11',
  type: 'FII',
  metrics: { generatedAt: new Date().toISOString() },
  normalized: {
    precoAtual: { value: 160, display: 'R$ 160,00', unit: 'BRL' },
    pvp: { value: 450, display: '450', unit: 'ratio' },
    dividendYield: { value: 9.8, display: '9,8%', unit: '%' },
  },
  appPayload: { metrics: { canonical: { precoAtual: { value: 160 }, pvp: { value: 450 }, dividendYield: { value: 9.8 } } }, charts: { count: 1, series: [{ points: [{x:1,y:2}] }] } },
  appMobileSnapshot: { metrics: { precoAtual: 160 }, charts: { series: [{ points: [{x:1,y:2}] }] }, sync: { renderSafe: true } },
  appResponseIntegrity: { score: 78, renderSafe: true, cacheSafe: false },
  assetIndicatorCoverage: { completenessPercent: 66, criticalCompletenessPercent: 58, missingCriticalFields: ['vacanciaFisica'], summary: { present: 12 }, groups: [] },
};

const guard = buildFieldConsistencyGuard(samplePayload);
assert.equal(guard.version.includes('21.12.29'), true);
assert.equal(guard.issueCounts.total > 0, true, 'P/VP extremo de FII precisa ser sinalizado');
assert.equal(guard.appPolicy.showDataQualityBadge, true);

const budget = buildPayloadBudget(samplePayload, { view: 'app' });
assert.equal(budget.version.includes('21.12.29'), true);
assert.equal(budget.signals.hasMobileSnapshot, true);
assert.equal(Array.isArray(budget.rootWeights), true);

const plan = buildAssetActionPlan({ ...samplePayload, fieldConsistencyGuard: guard, payloadBudget: budget });
assert.equal(plan.version.includes('21.12.29'), true);
assert.equal(plan.releaseDecision.includes('cache') || plan.releaseDecision.includes('partial') || plan.releaseDecision.includes('quality'), true);
assert.ok(plan.nextEndpoints.quality.includes('/api/v1/asset/quality'));

const self = runValoraeSelfTest();
assert.equal(self.ok, true);
assert.equal(self.checks.some(c => c.name === 'field-consistency-guard-module'), true);
assert.equal(self.checks.some(c => c.name === 'payload-budget-module'), true);
assert.equal(self.checks.some(c => c.name === 'asset-action-plan-module'), true);

const manifest = await call(manifestHandler, '/api/v1/integration/manifest');
assert.equal(/21\.12\.(29|30|32|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|54|55|56|57|57|57)/.test(manifest.json.contractVersion), true);
assert.equal(manifest.json.stableRoots.quality, 'fieldConsistencyGuard');
assert.equal(manifest.json.stableRoots.action, 'assetActionPlan');

const routes = routeManifest().routes;
assert.ok(routes.includes('/asset/quality'));
assert.ok(routes.includes('/asset/action-plan'));
assert.ok(routes.includes('/integration/manifest'));

// Confirma que o router reconhece o endpoint novo sem cair em NOT_FOUND.
const routed = await call(dispatchRoute, '/api/v1/integration/manifest');
assert.equal(routed.res.statusCode, 200);
assert.equal(routed.json.endpoint, 'integration/manifest');

console.log('operational-resilience-suite-v21-12-29 ok');
