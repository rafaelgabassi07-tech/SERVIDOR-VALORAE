import assert from 'node:assert/strict';
import fs from 'node:fs';

const engine = fs.readFileSync('lib/Valorae-engine.js', 'utf8');

assert.match(engine, /VALORAE_ANALYSIS_PAGE_VERSION/);
assert.match(engine, /faithful-sections-full-fundamentals-no-synthetic-values/);
assert.match(engine, /assetAnalysisPage/);

for (const requiredActionSection of [
  'Receitas e lucros',
  'Lucro x cotação',
  'Evolução de patrimônio',
  'Balanço patrimonial',
  'Regiões onde gera receita',
  'Negócios que geram receita',
  'Comparação com índices',
  'Informações sobre a empresa'
]) {
  assert.ok(engine.includes(requiredActionSection), `seção de Ação ausente: ${requiredActionSection}`);
}

for (const requiredFiiSection of [
  'Informações sobre o FII',
  'Histórico de indicadores fundamentalistas',
  'Comparando com outros FIIs',
  'Distribuições nos últimos 12 meses',
  'Informações sobre valor patrimonial',
  'Lista de imóveis',
  'Distribuição de ativos do fundo'
]) {
  assert.ok(engine.includes(requiredFiiSection), `seção de FII ausente: ${requiredFiiSection}`);
}

assert.doesNotMatch(engine, /synthetic fallback|fake chart|mock chart/i);

console.log('Asset analysis page contract test OK.');

assert.match(engine, /rowsFromAnyAnalysisValue/);
assert.match(engine, /rows: resolved.rows/);
assert.match(engine, /rowsFromGenericObject/);
