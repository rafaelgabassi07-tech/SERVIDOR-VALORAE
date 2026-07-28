import assert from 'node:assert/strict';
import { routeManifest, _test } from '../routes/_router.js';

assert.equal(_test.routeMethod('/portfolio/returns'), 'POST');
assert.equal(_test.routeMethod('/portfolio/equilibrium'), 'POST');
assert.equal(_test.routeMethod('/dividends/batch'), 'POST');
assert.equal(_test.routeMethod('/sync'), 'POST');
assert.equal(_test.routeMethod('/asset'), 'GET');
assert.equal(_test.routeMethod('/asset/modal'), 'GET');
assert.ok(_test.openApiOperationForRoute('/portfolio/returns').post, 'OpenAPI deve declarar POST para rotas com body');
assert.ok(_test.openApiOperationForRoute('/asset/modal').get, 'OpenAPI deve declarar GET para o modal sob demanda');
assert.equal(routeManifest().routes.includes('/analysis'), false);
assert.equal(routeManifest().routes.includes('/asset/analysis'), false);
