import assert from 'node:assert/strict';
import { clearCache } from '../lib/core/cache.js';

clearCache();
const originalFetch = global.fetch;
const year = new Date().getUTCFullYear();

global.fetch = async (url) => {
  const u = String(url);
  if (u.includes('daily-evolution/IFIX')) {
    return new Response(`<html><body><h1>IFIX - ${year}</h1><table>
      <tr><th>Dia</th><th>Jun</th><th>Jul</th><th>Ago</th></tr>
      <tr><td>10</td><td></td><td>3.500,00</td><td></td></tr>
      <tr><td>11</td><td></td><td></td><td>3.520,00</td></tr>
    </table></body></html>`, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
  return new Response('', { status: 404 });
};

try {
  const { fetchB3IndexDailyEvolution } = await import('../lib/market/b3-index-history.js');
  const result = await fetchB3IndexDailyEvolution('IFIX', { years: 1, bypassCache: true, limit: 20 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.points.map(p => p.date), [`${year}-07-10`, `${year}-08-11`]);
  assert.equal(result.points.at(-1).close, 3520);
  console.log('b3-index-empty-cell-alignment-v656: ok');
} finally {
  clearCache();
  global.fetch = originalFetch;
}
