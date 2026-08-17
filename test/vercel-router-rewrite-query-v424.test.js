import assert from 'node:assert/strict';
import { _test } from '../api/router.js';

{
  const req = {
    url: '/api/router',
    query: { path: 'v1/news', limit: '20', symbols: ['PETR4', 'VALE3'] },
  };
  _test.rewrite(req);
  const parsed = new URL(req.url, 'https://valorae.local');
  assert.equal(parsed.pathname, '/api/v1/news');
  assert.equal(parsed.searchParams.get('limit'), '20');
  assert.deepEqual(parsed.searchParams.getAll('symbols'), ['PETR4', 'VALE3']);
  assert.equal(Object.prototype.hasOwnProperty.call(req.query, 'path'), false);
}

{
  const req = {
    url: '/api/router?path=v1%2Fasset%2Fmodal&ticker=PETR4&stage=fast',
    query: { path: 'v1/asset/modal', ticker: 'PETR4', stage: 'fast' },
  };
  _test.rewrite(req);
  const parsed = new URL(req.url, 'https://valorae.local');
  assert.equal(parsed.pathname, '/api/v1/asset/modal');
  assert.equal(parsed.searchParams.get('ticker'), 'PETR4');
  assert.equal(parsed.searchParams.get('stage'), 'fast');
  assert.equal(parsed.searchParams.getAll('ticker').length, 1, 'query da URL não deve ser duplicada com req.query');
}

{
  const req = { url: '/api/v1/ready', query: {} };
  _test.rewrite(req);
  assert.equal(req.url, '/api/v1/ready', 'requisição direta sem rewrite deve permanecer intacta');
}

assert.equal(_test.normalizePath('/api/v1/news'), 'v1/news');
assert.equal(_test.normalizePath(['v1', 'asset', 'modal']), 'v1/asset/modal');

console.log('vercel-router-rewrite-query-v424 ok');
