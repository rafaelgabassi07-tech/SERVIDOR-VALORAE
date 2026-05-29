import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getServerMetricsSnapshot } from '../lib/observability/server-metrics.js';
import { routeManifest, dispatchRoute } from '../routes/_router.js';

const RELEASE = '21.12.39-full-project-audit-hardening';
const forbiddenTopLevelArtifacts = ['fix_modal.cjs','update.cjs','update_menu.cjs','head.html','formatted.css','ui-styles.css','test.js'];

for (const file of forbiddenTopLevelArtifacts) {
  assert.equal(fs.existsSync(file), false, `artifact must not be shipped at project root: ${file}`);
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const sw = fs.readFileSync('public/service-worker.js', 'utf8');
const serverHtml = fs.readFileSync('public/server.html', 'utf8');
const indexHtml = fs.readFileSync('public/index.html', 'utf8');
const integrationManifestRoute = fs.readFileSync('routes/integration/manifest.js', 'utf8');

assert.equal(pkg.version, '21.12.0', 'package.version remains stable core semver');
assert.equal(pkg.valorae.releasePatch, RELEASE);
assert.equal(metadata.releasePatch, RELEASE);
assert.equal(metadata.latestInternalPatch, RELEASE);
assert.equal(manifest.version, '21.12.39');
assert.match(sw, /valorae-proxy-server-v21-12-39/);
assert.match(serverHtml, /21\.12\.39-full-project-audit-hardening/);
assert.match(indexHtml, /21\.12\.39-full-project-audit-hardening/);
assert.match(serverHtml, /v21\.12\.39 UI/);
assert.match(integrationManifestRoute, /21\.12\.39-full-project-audit-integration-manifest/);
assert.match(integrationManifestRoute, /releasePatch: '21\.12\.39-full-project-audit-hardening'/);

const combined = [JSON.stringify(metadata), sw, serverHtml, indexHtml].join('\n');
assert.doesNotMatch(combined, /MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API/);
assert.doesNotMatch(combined, /valorae-proxy-server-v21-12-37/);
assert.doesNotMatch(combined, /v21\.12\.37 UI/);

const routes = routeManifest().routes;
for (const required of ['/server/metrics', '/server/tests', '/integration/manifest', '/release/readiness', '/scrape', '/asset']) {
  assert.ok(routes.includes(required), `route manifest must include ${required}`);
}

const metrics = getServerMetricsSnapshot();
assert.equal(metrics.releasePatch, RELEASE);
assert.match(metrics.version, /21\.12\.39/);


class MiniRes {
  constructor() { this.statusCode = 200; this.headers = new Map(); this.body = ''; this.writableEnded = false; }
  setHeader(k, v) { this.headers.set(String(k).toLowerCase(), String(v)); }
  getHeader(k) { return this.headers.get(String(k).toLowerCase()); }
  status(code) { this.statusCode = code; return this; }
  send(body = '') { return this.end(body); }
  end(chunk = '') { this.body += String(chunk || ''); this.writableEnded = true; return this; }
}
async function callScrape(url) {
  const req = { url, method: 'GET', query: {}, headers: { host: 'localhost', 'user-agent': 'full-project-v21-12-39' }, socket: { remoteAddress: '127.0.0.39' } };
  const res = new MiniRes();
  await dispatchRoute(req, res);
  return { res, json: JSON.parse(res.body || '{}') };
}
{
  const { res, json } = await callScrape('/api/scrape');
  assert.equal(res.statusCode, 400);
  assert.equal(json.code, 'MISSING_TARGET_URL');
  assert.equal(json.expectedValidationError, true);
}
{
  const { res, json } = await callScrape('/api/scrape?url=http%3A%2F%2Fexample.com&selector=h1&timeoutMs=500');
  assert.equal(res.statusCode, 400);
  assert.equal(json.code, 'INVALID_TARGET_URL_PROTOCOL');
  assert.equal(json.expectedValidationError, true);
  assert.match(json.hint, /https:\/\//);
}

console.log('full-project-audit-v21-12-39 OK');
