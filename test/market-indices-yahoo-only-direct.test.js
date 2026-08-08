import assert from 'node:assert/strict';
const requests = [];
const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;

const indexIds = { IFIX: 22, IDIV: 8, SMLL: 6 };
const indexById = Object.fromEntries(Object.entries(indexIds).map(([code, id]) => [String(id), code]));
const base = { IFIX: 3800, IDIV: 12600, SMLL: 2130 };

global.fetch = async (url) => {
  const textUrl = String(url);
  requests.push(textUrl);
  if (textUrl.includes('finance.yahoo.com')) {
    return new Response(JSON.stringify({ chart: { result: null, error: { description: 'rate-limited in test' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const direct = textUrl.match(/investidor10\.com\.br\/api\/indices\/cotacoes\/(\d+)\/3650/);
  if (direct) {
    const code = indexById[direct[1]];
    const value = base[code];
    return new Response(JSON.stringify([
      { last_update: '01/06/2026', points: value - 50 },
      { last_update: '01/07/2026', points: value }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('sistemaswebb3-listados.b3.com.br')) {
    throw new Error(`B3 fallback não deve ser chamado para IFIX/IDIV/SMLL quando a fonte do comparador responde: ${textUrl}`);
  }
  if (textUrl.includes('api.bcb.gov.br')) {
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response('', { status: 404 });
};

try {
  const { fetchIndicesSnapshot } = await import('../lib/market/indices.js');
  const payload = await fetchIndicesSnapshot({ symbols: { IFIX: 'IFIX.SA', IDIV: 'IDIV.SA', SMLL: 'SMLL.SA' }, bypassCache: true });
  assert.equal(payload.ok, true, 'fonte real do comparador deve recuperar o ticker quando Yahoo falha');
  for (const name of ['IFIX', 'IDIV', 'SMLL']) {
    const row = payload.indices.find(item => item.name === name);
    assert.equal(row?.ok, true, `${name} deve usar a mesma fonte real do comparador como contingência`);
    assert.ok(Number(row?.price) > 0, `${name} deve expor valor real recuperado`);
    assert.match(String(row?.source || ''), /Investidor10.*mesma fonte do comparador/i, `${name} deve registrar paridade de fonte`);
    assert.equal(row?.staleFallback, false, `${name} não pode usar snapshot estático inventado`);
  }
  assert.equal(requests.some(url => url.includes('sistemaswebb3-listados.b3.com.br')), false, 'B3 não deve ser necessário se a fonte do comparador respondeu');
  console.log('Market indices comparison-source fallback test OK.');
} finally {
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
