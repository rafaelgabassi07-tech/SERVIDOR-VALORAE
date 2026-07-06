import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('lib/analysis/stock-modal-contract.js', 'utf8');
assert.ok(source.includes('/api/balancos/indicadores/table/'), 'Proxy deve buscar endpoint real de tabela de indicadores do Investidor10');
assert.ok(source.includes('/api/balancos/indicadores/chart/'), 'Proxy deve buscar endpoint real de gráfico de indicadores do Investidor10');
assert.ok(source.includes("addTask('historicoIndicadores'"), 'endpoints de indicadores devem alimentar rawJson.historicoIndicadores');

console.log('stock-modal-historical-indicators-endpoints-v261 ok');
