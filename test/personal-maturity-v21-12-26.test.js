import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPersonalReleaseReadiness, VALORAE_PERSONAL_MATURITY_VERSION } from '../lib/release/personal-maturity.js';
import { VALORAE_SERVER_METRICS_VERSION, getServerMetricsSnapshot } from '../lib/observability/server-metrics.js';
import { routeManifest } from '../routes/_router.js';

const readiness = buildPersonalReleaseReadiness({
  providers: [{ name: 'Investidor10', status: 'healthy' }, { name: 'YahooChart', status: 'healthy' }],
  metrics: { summary: { routesTracked: 2 }, eventsStored: 1, deliveryHarmony: { payloadsDelivered: 1 } },
  proxyOutputMonitor: { outputFeed: [{ route: '/api/asset' }], totals: { payloadResponses: 1 } },
});
assert.equal(readiness.version, VALORAE_PERSONAL_MATURITY_VERSION);
assert.equal(readiness.audience, 'uso pessoal e pessoas próximas');
assert.equal(readiness.commercialPublicApi, false);
assert.ok(readiness.score >= 75, 'readiness pessoal deve ser bom para cenário controlado');
assert.ok(readiness.categories.some(c => c.key === 'auth'));
assert.ok(readiness.categories.some(c => c.key === 'persistence'));
assert.ok(readiness.launchChecklist.length >= 5);
assert.ok(readiness.nextMilestones.some(x => /21\.12\.(27|28|30|35|36|37|38|39|40|41|42|43|44)/.test(x)));

assert.match(VALORAE_SERVER_METRICS_VERSION, /^21\.12\.(28|29|30|32|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|54|55|56|57|58)-/);
const snap = getServerMetricsSnapshot();
assert.match(snap.version, /^21\.12\.(28|29|30|32|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|54|55|56|57|58)-/);
assert.ok(snap.personalReleaseReadiness, 'server metrics deve expor readiness pessoal');
assert.ok(snap.personalReleaseReadiness.categories.some(c => c.key === 'observability'));

const manifest = routeManifest();
assert.ok(manifest.routes.includes('/release/readiness'));
assert.ok(manifest.routes.includes('/personal/readiness'));

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index e server devem continuar espelhados');
for (const needle of [
  'Maturidade pessoal do VALORAE',
  'data-page="maturity"',
  'maturityScore',
  'personalReleaseReadiness',
  '/api/v1/release/readiness',
]) assert.ok(html.includes(needle), `monitor deve conter ${needle}`);

const readme = fs.readFileSync('README.md', 'utf8');
assert.ok(readme.includes('v21.12.26'));
assert.ok(readme.includes('/api/v1/release/readiness'));
assert.ok(readme.includes('uso pessoal e pessoas próximas'));

const openapi = fs.readFileSync('routes/openapi.js', 'utf8');
assert.ok(openapi.includes('/api/v1/release/readiness'));
assert.ok(openapi.includes('PersonalReleaseReadiness'));

const fields = fs.readFileSync('routes/fields.js', 'utf8');
assert.ok(fields.includes('personalReleaseReadiness.score'));

const env = fs.readFileSync('.env.example', 'utf8');
assert.ok(env.includes('VALORAE_PERSONAL_MODE=true'));
assert.ok(env.includes('VALORAE_DEFAULT_ASSET_VIEW=app'));

console.log('personal-maturity-v21-12-26 ok');
