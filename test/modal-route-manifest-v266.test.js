import assert from 'node:assert/strict';
import { routeManifest, _test } from '../routes/_router.js';

const routes = routeManifest().routes;
for (const route of ['/asset/fii-modal', '/fii/modal', '/asset/stock-modal', '/asset/action-modal', '/acao/modal']) {
  assert.ok(routes.includes(route), `routeManifest precisa listar ${route}`);
}
assert.equal(_test.routeMethod('/asset/fii-modal'), 'GET');
assert.equal(_test.routeMethod('/asset/stock-modal'), 'GET');

console.log('modal-route-manifest-v266 ok');
