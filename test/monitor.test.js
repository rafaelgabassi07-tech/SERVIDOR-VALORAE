import assert from 'node:assert/strict';
import { routeManifest } from '../routes/_router.js';
const routes = routeManifest().routes;
assert.ok(routes.includes('/monitor/summary'));
assert.ok(routes.includes('/monitor/self-test'));
assert.ok(routes.includes('/server/summary'));
assert.ok(routes.includes('/server/self-test'));
