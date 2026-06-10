import fs from 'node:fs';
import assert from 'node:assert/strict';
import { RELEASE } from '../lib/core/release.js';
import { routeManifest } from '../routes/_router.js';

const html = fs.readFileSync('public/server.html', 'utf8');
const sw = fs.readFileSync('public/service-worker.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));

assert.equal(RELEASE.version, '21.13.2');
assert.equal(RELEASE.cacheName, 'valorae-proxy-server-v21-13-2');
assert.ok(html.includes('/api/v1/monitor/summary'));
assert.ok(html.includes('/api/v1/monitor/self-test'));
assert.ok(html.includes('/api/v1/mobile/portfolio-sync'));
assert.ok(html.includes('navigator.serviceWorker.register'));
assert.ok(sw.includes('self.skipWaiting'));
assert.ok(sw.includes('self.clients.claim'));
assert.equal(manifest.name, 'VALORAE Proxy Monitor');
assert.equal(manifest.scope, '/');
assert.ok(routeManifest().routes.includes('/monitor/summary'));
assert.ok(routeManifest().routes.includes('/monitor/self-test'));
console.log('VALORAE Proxy monitor audit v21.13.2 OK');
