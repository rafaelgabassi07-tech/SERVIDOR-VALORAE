import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getServerMetricsSnapshot } from '../lib/observability/server-metrics.js';
import { routeManifest } from '../routes/_router.js';

const RELEASE = JSON.parse(fs.readFileSync('metadata.json', 'utf8')).releasePatch;
const PUBLIC_VERSION = RELEASE.match(/^21\.12\.\d+/)?.[0] || '21.12.56';
const CACHE_VERSION = PUBLIC_VERSION.replaceAll('.', '-');
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
assert.equal(manifest.version, PUBLIC_VERSION);
assert.ok(sw.includes(`valorae-proxy-server-v${CACHE_VERSION}`));
assert.match(serverHtml, /21\.12\.48-monitor-responsive-settings-theme/);
assert.match(indexHtml, /21\.12\.48-monitor-responsive-settings-theme/);
assert.ok(serverHtml.includes(`v${PUBLIC_VERSION} UI`));
assert.ok(integrationManifestRoute.includes(`${RELEASE}-integration-manifest`));
assert.ok(integrationManifestRoute.includes(`releasePatch: '${RELEASE}'`));

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
assert.match(metrics.version, /21\.12\.(40|41|42|43|44|45|46|47|48|49|50|51|52|54|55|56)/);

console.log('full-project-audit-v21-12-39/42 OK');
