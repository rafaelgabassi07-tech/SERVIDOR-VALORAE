import routerHandler from '../api/router.js';

function mockReq(url, query = {}) {
  return { method: 'GET', url, query, headers: { host: 'example.vercel.app', 'x-forwarded-proto': 'https', 'x-forwarded-for': '127.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } };
}
function mockRes() {
  return { statusCode: 200, body: '', headers: {}, writableEnded: false, setHeader(k,v){this.headers[k.toLowerCase()]=v}, getHeader(k){return this.headers[String(k).toLowerCase()]}, status(c){this.statusCode=c;return this}, send(b){this.body=String(b ?? '');this.writableEnded=true;return this}, end(b=''){this.body+=String(b ?? '');this.writableEnded=true;return this} };
}
async function call(req) { const res=mockRes(); await routerHandler(req,res); return { res, json: JSON.parse(res.body || '{}') }; }

const checks = [
  [mockReq('/api/router?path='), 200, (j) => j?.examples?.metrics === '/api/server/metrics'],
  [mockReq('/api/router?path=server/metrics'), 200, (j) => Boolean(j?.summary)],
  [mockReq('/api/router?path=server/tests&mode=quick'), 200, (j) => Boolean(j?.benchmark)],
  [mockReq('/api/router?path=cache/stats'), 200, (j) => Boolean(j?.caches)],
  [mockReq('/api/router?path=source/status'), 200, (j) => Array.isArray(j?.providers)],
  [mockReq('/api/router?path=deploy/status'), 200, (j) => Boolean(j?.build)],
  [mockReq('/api/router?path=ready'), 200, (j) => j?.status === 'READY'],
  [mockReq('/api/router?path=v1/ready'), 200, (j) => j?.status === 'READY'],
  [mockReq('/api/router?path=v1/manifest'), 200, (j) => Boolean(j?.routes)],
  [mockReq('/api/router?path=v1/env'), 200, (j) => Array.isArray(j?.rows) || Boolean(j?.runtime)],
  [mockReq('/api/router?path=v1/schema'), 200, (j) => Boolean(j?.schemas)],
  [mockReq('/api/router?path=v1/fields'), 200, (j) => Boolean(j?.endpoint === 'fields' || j?.fields || j?.stableAssetFields)],
  [mockReq('/api/router?path=v2/errors'), 200, (j) => Boolean(j?.errors || j?.data?.endpoint === 'errors')],
  [mockReq('/api/router?path=unknown'), 404, () => true],
];
for (const [req, expected, validate] of checks) {
  const { res, json } = await call(req);
  if (res.statusCode !== expected) throw new Error(`${req.url}: esperado ${expected}, veio ${res.statusCode}. Body: ${res.body.slice(0, 180)}`);
  if (validate && !validate(json)) throw new Error(`${req.url}: payload inválido. Body: ${res.body.slice(0, 260)}`);
}
console.log('Smoke OK: router único Vercel, metrics summary, tests benchmark, cache/source/status, ready v1/v2 e 404 interno.');
