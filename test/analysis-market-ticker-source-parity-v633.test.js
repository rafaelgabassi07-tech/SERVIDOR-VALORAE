import assert from 'node:assert/strict';
import fs from 'node:fs';

const indices = fs.readFileSync(new URL('../lib/market/indices.js', import.meta.url), 'utf8');
const fiiComparator = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');

for (const code of ['IBOV', 'IFIX', 'IDIV', 'SMLL']) {
  assert.match(fiiComparator, new RegExp(`code: '${code}'`), `${code} deve existir no comparador`);
  assert.match(indices, /COMPARISON_DIRECT_INDEXES = new Set\(\['IBOV', 'IFIX', 'IDIV', 'SMLL'\]\)/, 'ticker deve compartilhar o conjunto de índices diretos do comparador');
}
assert.match(indices, /fetchInvestidor10DirectIndexHistory\(name/, 'ticker deve reutilizar histórico direto real do comparador');
assert.match(indices, /getCdiAccumulatedSeries\(12, 5200\)/, 'CDI deve usar série oficial já usada no ecossistema');
assert.match(indices, /getIpcaSeries\(12\)/, 'IPCA deve usar a mesma camada real usada pelos comparadores');
assert.match(indices, /USD:\s*'BRL=X'/, 'Dólar deve usar BRL=X');
assert.match(indices, /fetchYahooHistoryQuote/, 'Dólar e IVVB11 devem ter contingência pelo histórico real do Yahoo');
assert.match(indices, /IVVB11:\s*'IVVB11\.SA'/, 'IVVB11 deve usar símbolo real da B3/Yahoo');
console.log('Analysis market ticker source parity v633 test OK.');
