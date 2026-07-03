import assert from 'node:assert/strict';
import { _test } from '../routes/_router.js';

assert.equal(_test.routeMethod('/portfolio/returns'), 'POST');
assert.equal(_test.routeMethod('/portfolio/equilibrium'), 'POST');
assert.equal(_test.routeMethod('/dividends/batch'), 'POST');
assert.equal(_test.routeMethod('/sync'), 'POST');
assert.equal(_test.routeMethod('/analysis'), 'GET');
assert.equal(_test.routeMethod('/asset'), 'GET');
assert.ok(_test.openApiOperationForRoute('/portfolio/returns').post, 'OpenAPI deve declarar POST para rotas com body');
assert.ok(_test.openApiOperationForRoute('/analysis').get, 'OpenAPI deve preservar GET para consulta de análise');
