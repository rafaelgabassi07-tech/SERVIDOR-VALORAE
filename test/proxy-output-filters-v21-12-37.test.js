import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('public/server.html', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');

assert.equal(server, index, 'index.html deve espelhar server.html');

for (const needle of [
  '21.12.37-proxy-output-filter-restore',
  'Status HTTP · todos',
  '2xx · sucesso',
  '3xx · cache/redireção',
  '4xx · erro do cliente',
  '5xx · erro do servidor',
  'Qualquer erro ≥400',
  'Parciais / 206',
  'Cache / 304',
  'Raiz do payload · todas',
  'Contrato app/mobile',
  'Qualidade / guardrails',
  'Mercado / financeiro',
  'Performance / cache / fonte',
  'appMobileSnapshot',
  'appResponseIntegrity',
  'engineRuntimeProfiler',
  'engineLaunchGate',
  'Mais antigos',
  'Menos bytes',
  'Menor latência',
  'Status HTTP maior',
  'Rota A→Z',
  'Ticker A→Z',
  'Mais raízes JSON',
  'Mais pontos de gráfico',
  'Mais alertas de campos',
  'function feedRoots(e)',
  'function matchesStatusFilter(e,filter)',
  'function matchesPayloadFilter(e,filter)',
  'function sortFeed(arr,sort=\'recent\')',
  'window.valoraeMonitorFilterCatalog = filterCatalog',
  'window.valoraeMonitorFeedRoots = feedRoots',
  "const statusOptions = merge(catalog.status",
  "const payloadOptions = merge(catalog.payload",
  "const sortOptions = catalog.sort",
  "updateFilterOptions();applyFilters();",
  "if(window._rebuildCustomSelects)window._rebuildCustomSelects()",
]) {
  assert.ok(server.includes(needle), `server.html precisa conter ${needle}`);
}

assert.match(server, /<select id="feedStatus">[\s\S]*group:2xx[\s\S]*group:error[\s\S]*429[\s\S]*504[\s\S]*<\/select>/, 'Status HTTP deve ter filtros por família, erro e códigos comuns');
assert.match(server, /<select id="feedPayload">[\s\S]*root:app[\s\S]*root:quality[\s\S]*chartSeries[\s\S]*payloadBudget[\s\S]*engineLaunchGate[\s\S]*<\/select>/, 'Raiz do payload deve ter grupos e raízes oficiais');
assert.match(server, /<select id="feedSort">[\s\S]*recent[\s\S]*old[\s\S]*bytesAsc[\s\S]*latencyAsc[\s\S]*roots[\s\S]*issues[\s\S]*<\/select>/, 'Ordenação deve ter opções avançadas');

console.log('proxy-output-filters-v21-12-37 ok');
