import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPersonalReleaseReadiness, VALORAE_PERSONAL_MATURITY_VERSION } from '../lib/release/personal-maturity.js';
import { VALORAE_SERVER_METRICS_VERSION, getServerMetricsSnapshot } from '../lib/observability/server-metrics.js';
import { routeManifest, dispatchRoute } from '../routes/_router.js';

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
async function call(url) { const req = mockReq(url); const res = mockRes(); await dispatchRoute(req, res); return { res, json: JSON.parse(res.body || '{}') }; }

assert.ok(fs.existsSync('.gitignore'), '.gitignore deve existir para release pessoal');
const gitignore = fs.readFileSync('.gitignore', 'utf8');
for (const needle of ['.env', '.vercel/', 'node_modules/', '*.zip']) assert.ok(gitignore.includes(needle), `.gitignore deve conter ${needle}`);

const index = fs.readFileSync('public/index.html', 'utf8');
const server = fs.readFileSync('public/server.html', 'utf8');
assert.equal(index, server, 'index e server devem continuar espelhados');
for (const needle of ['/api/ready', '/api/v1/release/readiness', '21.12.30-final-personal-launch-cleanup']) assert.ok(index.includes(needle), `index deve conter ${needle}`);

const assetRoute = fs.readFileSync('routes/asset.js', 'utf8');
assert.ok(assetRoute.includes("VALORAE_DEFAULT_ASSET_VIEW || 'app'"), 'asset deve usar view=app como fallback padrão');
const assetsRoute = fs.readFileSync('routes/assets.js', 'utf8');
assert.ok(assetsRoute.includes("VALORAE_DEFAULT_ASSETS_VIEW || 'app'"), 'assets deve usar view=app como fallback padrão');

assert.equal(VALORAE_PERSONAL_MATURITY_VERSION, '21.12.30-final-personal-launch-cleanup');
assert.match(VALORAE_SERVER_METRICS_VERSION, /^21\.12\.(30|32|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|54|55|56|57|57|57)-/);
const readiness = buildPersonalReleaseReadiness({ providers: [{ status: 'healthy' }], metrics: { eventsStored: 1, deliveryHarmony: { payloadsDelivered: 1 } } });
assert.equal(readiness.defaultView, 'app');
assert.ok(readiness.launchChecklist.some(x => x.item.includes('view=app')));

const snap = getServerMetricsSnapshot();
assert.match(snap.version, /^21\.12\.(30|32|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|54|55|56|57|57|57)-/);
assert.ok(snap.personalReleaseReadiness?.version.includes('21.12.30'));

const manifest = routeManifest();
assert.ok(manifest.routes.includes('/release/readiness'));
assert.ok(manifest.routes.includes('/asset/quality'));

const rel = await call('/api/v1/release/readiness');
assert.equal(rel.res.statusCode, 200);
assert.ok(rel.json.readiness.version.includes('21.12.30'));

const integration = await call('/api/v1/integration/manifest');
assert.equal(integration.res.statusCode, 200);
assert.ok(/21\.12\.(30|32|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|54|55|56|57|57|57)/.test(integration.json.contractVersion));

console.log('final-personal-launch-cleanup-v21-12-30 ok');
