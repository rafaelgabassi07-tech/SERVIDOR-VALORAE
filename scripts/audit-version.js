import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const expectedCore = String(pkg.version || '');
const expectedPublic = String(pkg.valorae?.publicVersion || '');
const expectedPatch = String(pkg.valorae?.releasePatch || '');
const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const sw = fs.readFileSync('public/service-worker.js', 'utf8');
const coreRelease = fs.readFileSync('lib/core/release.js', 'utf8');
const currentRelease = fs.readFileSync('lib/release/current.js', 'utf8');
const nvmrc = fs.readFileSync('.nvmrc', 'utf8').trim();
const serverMetrics = fs.readFileSync('lib/observability/server-metrics.js', 'utf8');

assert.equal(pkg.version, expectedCore);
assert.equal(pkg.valorae.coreVersion, expectedCore);
assert.equal(pkg.valorae.releasePatch, expectedPatch);
assert.equal(pkg.releasePatch, expectedPatch);
for (const block of [pkg.config, pkg.releaseMetadata]) {
  assert.equal(block.releasePatch, expectedPatch);
  assert.equal(block.publicVersion, expectedPublic);
  assert.equal(block.checkpoint, pkg.valorae.checkpoint);
  assert.equal(block.releaseLabel, pkg.valorae.releaseLabel);
}
assert.equal(metadata.version, expectedCore);
assert.equal(metadata.releasePatch, expectedPatch);
assert.equal(manifest.version, expectedPublic);
assert.ok(sw.includes(`v${expectedPublic.replaceAll('.', '-')}`));
assert.ok(coreRelease.includes(expectedPatch));
assert.ok(coreRelease.includes(`valorae-proxy-server-v${expectedPublic.replaceAll('.', '-')}`));
assert.ok(currentRelease.includes(`VALORAE_PUBLIC_VERSION = '${expectedPublic}'`));
assert.ok(currentRelease.includes(expectedPatch));
const expectedNodeMajor = String(pkg.engines?.node || '').match(/\d+/)?.[0];
assert.ok(expectedNodeMajor, 'package.json precisa declarar engines.node');
assert.equal(nvmrc, expectedNodeMajor, '.nvmrc precisa acompanhar package.json engines.node');
assert.ok(serverMetrics.includes(`Node.js ${expectedNodeMajor}`), 'monitor precisa exibir o runtime Node declarado');
assert.ok(!serverMetrics.includes('Node.js 20'), 'monitor não pode anunciar runtime obsoleto');

console.log('release audit OK:', expectedCore, expectedPatch);
