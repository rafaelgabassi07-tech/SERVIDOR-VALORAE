import assert from 'node:assert/strict';
const requests = [];
const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;

global.fetch = async (url) => {
  const textUrl = String(url);
  requests.push(textUrl);
  if (textUrl.includes('finance.yahoo.com')) {
    return new Response(JSON.stringify({ chart: { result: null, error: { description: 'rate-limited in test' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('sistemaswebb3-listados.b3.com.br')) {
    throw new Error(`B3 fallback não deve ser chamado para IFIX/IDIV/SMLL: ${textUrl}`);
  }
  return new Response('', { status: 404 });
};

try {
  const { fetchIndicesSnapshot } = await import('../lib/market/indices.js');
  const payload = await fetchIndicesSnapshot({ symbols: { IFIX: 'IFIX.SA', IDIV: 'IDIV.SA', SMLL: 'SMLL.SA' }, bypassCache: true });
  assert.equal(payload.ok, true, 'last-known Yahoo snapshots should keep direct index snapshot usable');
  for (const name of ['IFIX', 'IDIV', 'SMLL']) {
    const row = payload.indices.find(item => item.name === name);
    assert.equal(row?.directIndexSymbol, true, `${name} must be a direct Yahoo index symbol`);
    assert.equal(row?.staleFallback, true, `${name} may only use last-known Yahoo fallback when live Yahoo fails`);
    assert.ok(String(row?.source || '').includes('Yahoo Finance Chart API'), `${name} source must remain Yahoo`);
  }
  assert.equal(requests.some(url => url.includes('sistemaswebb3-listados.b3.com.br')), false, 'B3 must not be called for direct Yahoo indexes');
  console.log('Market indices Yahoo-only direct snapshot test OK.');
} finally {
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
