import assert from 'node:assert/strict';
import { routeManifest, _test } from '../routes/_router.js';

const routes = routeManifest().routes;
assert.ok(routes.includes('/asset/modal'), 'routeManifest precisa listar a rota universal');
for (const route of ['/asset/fii-modal', '/fii/modal', '/asset/stock-modal', '/asset/action-modal', '/acao/modal']) {
  assert.equal(routes.includes(route), false, `${route} foi aposentada e não pode voltar ao contrato público`);
  assert.equal(_test.PRODUCTION_ROUTE_ALLOWLIST.has(route), false, `${route} não pode ser publicada em produção`);
}
assert.equal(_test.routeMethod('/asset/modal'), 'GET');
console.log('modal-route-manifest-v401 canonical-only ok');
