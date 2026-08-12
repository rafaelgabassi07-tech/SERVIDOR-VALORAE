import assert from 'node:assert/strict';
const requests = [];
const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;

function b3Table(code) {
  const base = { IFIX: 3800, IDIV: 12600, SMLL: 2130 }[code];
  const previous = base - 10;
  const current = base;
  return `<table>
    <tr><th>Dia</th><th>Jun</th><th>Jul</th><th>Ago</th></tr>
    <tr><td>10</td><td></td><td>${String(previous).replace('.', ',')}</td><td></td></tr>
    <tr><td>11</td><td></td><td></td><td>${String(current).replace('.', ',')}</td></tr>
  </table>`;
}

global.fetch = async (url) => {
  const textUrl = String(url);
  requests.push(textUrl);
  if (textUrl.includes('finance.yahoo.com')) {
    return new Response(JSON.stringify({ chart: { result: null, error: { description: 'rate-limited in test' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (textUrl.includes('sistemaswebb3-listados.b3.com.br')) {
    const code = textUrl.match(/daily-evolution\/([A-Z0-9]+)/)?.[1] || 'IFIX';
    return new Response(b3Table(code), { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
  if (textUrl.includes('investidor10.com.br')) return new Response(JSON.stringify([{ last_update: '10/08/2026', points: 3700 }, { last_update: '11/08/2026', points: 3710 }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (textUrl.includes('api.bcb.gov.br')) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  return new Response('', { status: 404 });
};

try {
  const { fetchIndicesSnapshot } = await import('../lib/market/indices.js');
  const payload = await fetchIndicesSnapshot({ symbols: { IFIX: 'IFIX.SA', IDIV: 'IDIV.SA', SMLL: 'SMLL.SA' }, bypassCache: true });
  assert.equal(payload.ok, true, 'B3 oficial deve recuperar o ticker quando Yahoo direto falha');
  for (const name of ['IFIX', 'IDIV', 'SMLL']) {
    const row = payload.indices.find(item => item.name === name);
    assert.equal(row?.ok, true, `${name} deve usar B3 oficial como contingência primária`);
    assert.ok(Number(row?.price) > 0, `${name} deve expor fechamento real recuperado`);
    assert.match(String(row?.source || ''), /B3 Oficial/i, `${name} deve registrar a fonte oficial B3`);
    assert.equal(row?.official, true);
  }
  assert.equal(requests.some(url => url.includes('sistemaswebb3-listados.b3.com.br')), true, 'B3 deve ser consultada em paralelo com Yahoo para índices brasileiros');
  const firstB3 = requests.findIndex(url => url.includes('sistemaswebb3-listados.b3.com.br'));
  const firstI10 = requests.findIndex(url => url.includes('investidor10.com.br'));
  assert.ok(firstB3 >= 0, 'B3 deve ser tentada como contingência primária');
  assert.ok(firstI10 >= 0, 'IFIX/IDIV podem aquecer a contingência direta em paralelo para reduzir cold-start');
  console.log('Market indices official-B3 primary fallback test OK.');
} finally {
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
