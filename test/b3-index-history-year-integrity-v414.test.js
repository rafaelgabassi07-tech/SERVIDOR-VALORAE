import assert from 'node:assert/strict';

const originalFetch = global.fetch;
const originalDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
delete process.env.VALORAE_DISABLE_EXTERNAL;

const currentYear = new Date().getUTCFullYear();
const previousYear = currentYear - 1;
const requests = [];

function table(year, first = '3.900,00', second = '3.950,00') {
  return `<html><body><h1>IFIX - ${year}</h1><table>
    <tr><th>Dia</th><th>Jan</th><th>Fev</th><th>Mar</th></tr>
    <tr><td>10</td><td>${first}</td><td></td><td></td></tr>
    <tr><td>11</td><td></td><td>${second}</td><td></td></tr>
  </table></body></html>`;
}

global.fetch = async (url) => {
  const u = String(url);
  requests.push(u);
  if (!u.includes('daily-evolution/IFIX')) return new Response('', { status: 404 });
  if (u.includes(`year=${previousYear}`)) return new Response(table(previousYear, '3.700,00', '3.750,00'), { status: 200, headers: { 'Content-Type': 'text/html' } });
  if (u.includes(`ano=${previousYear}`)) return new Response(table(currentYear), { status: 200, headers: { 'Content-Type': 'text/html' } });
  return new Response(table(currentYear), { status: 200, headers: { 'Content-Type': 'text/html' } });
};

try {
  const { fetchB3IndexDailyEvolution } = await import('../lib/market/b3-index-history.js');
  const result = await fetchB3IndexDailyEvolution('IFIX', { years: 2, bypassCache: true, limit: 20 });
  assert.equal(result.ok, true);
  assert.equal(result.points.some(p => p.date.startsWith(`${currentYear}-`)), true, 'ano atual deve existir');
  assert.equal(result.points.some(p => p.date.startsWith(`${previousYear}-`)), true, 'ano anterior deve vir da resposta explicitamente compatível');
  assert.equal(requests.some(u => u.includes(`year=${previousYear}`)), true, 'ano histórico deve usar URL explícita');
  const previousCanonical = requests.find(u => u.includes('daily-evolution/IFIX') && !u.includes(`year=${previousYear}`) && !u.includes(`ano=${previousYear}`) && !u.includes(`year=${currentYear}`) && !u.includes(`ano=${currentYear}`));
  assert.ok(previousCanonical, 'rota canônica deve ser usada para o ano atual');

  // Uma página que declara outro ano não pode ser relabelada silenciosamente.
  const badDiagnostics = result.diagnostics.filter(d => d.year === previousYear && d.declaredYear && d.declaredYear !== previousYear);
  assert.equal(badDiagnostics.every(d => d.parsed === 0 && d.yearCompatible === false), true);
  console.log('b3-index-history-year-integrity-v414: ok');
} finally {
  global.fetch = originalFetch;
  if (originalDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = originalDisableExternal;
}
