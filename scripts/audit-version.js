import assert from 'node:assert/strict';
import fs from 'node:fs';

const expectedCore = '21.12.0';
const expectedPublic = '21.12.326';
const expectedPatch = '21.12.326-full-modal-portfolio-history-alignment-v297';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const sw = fs.readFileSync('public/service-worker.js', 'utf8');

assert.equal(pkg.version, expectedCore);
assert.equal(pkg.valorae.coreVersion, expectedCore);
assert.equal(pkg.valorae.releasePatch, expectedPatch);
assert.equal(metadata.version, expectedCore);
assert.equal(metadata.releasePatch, expectedPatch);
assert.equal(manifest.version, expectedPublic);
assert.ok(sw.includes('v21-12-326'));    

console.log('release audit OK:', expectedCore, expectedPatch);
