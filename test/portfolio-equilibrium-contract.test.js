import assert from 'node:assert/strict';
import { buildEquilibriumContract } from '../lib/portfolio/equilibrium-metadata.js';

const positions = [
  { ticker: 'GARE11', quantity: 10, avgPrice: 9, currentPrice: 10, assetClass: 'FII' },
  { ticker: 'SNAG11', quantity: 10, avgPrice: 8, currentPrice: 7, assetClass: 'FII' },
  { ticker: 'BTCI11', quantity: 10, avgPrice: 9, currentPrice: 6, assetClass: 'FII' },
  { ticker: 'GGRC11', quantity: 10, avgPrice: 9, currentPrice: 5, assetClass: 'FII' },
  { ticker: 'CMIG4', quantity: 10, avgPrice: 10, currentPrice: 10, assetClass: 'ACAO' },
  { ticker: 'ITSA4', quantity: 10, avgPrice: 10, currentPrice: 8, assetClass: 'ACAO' },
  { ticker: 'GRND3', quantity: 10, avgPrice: 10, currentPrice: 7, assetClass: 'ACAO' },
  { ticker: 'KLBN4', quantity: 10, avgPrice: 10, currentPrice: 6, assetClass: 'ACAO' }
];

const result = buildEquilibriumContract({ positions });
assert.equal(result.status, 'OK');
assert.deepEqual(result.tabs, ['Consolidado', 'Ações', 'FIIs']);
assert.deepEqual(result.consolidated.charts.map(c => c.id), ['position_by_asset', 'position_by_asset_type', 'foreign_exposure']);
assert.deepEqual(result.actions.charts.map(c => c.id), ['stocks_by_asset', 'stocks_by_segment', 'stocks_by_sector']);
assert.deepEqual(result.fiis.charts.map(c => c.id), ['fiis_by_asset', 'fiis_by_type', 'fiis_by_segment']);
assert.ok(result.actions.bySegment.some(x => x.label === 'Energia Elétrica'));
assert.ok(result.actions.bySector.some(x => x.label === 'Utilidade Pública'));
assert.ok(result.fiis.byType.some(x => x.label === 'Fundo de Papel'));
assert.ok(result.fiis.bySegment.some(x => x.label === 'Títulos e Valores Mobiliários'));
assert.ok(result.fiis.bySegment.some(x => x.label === 'Logístico / Indústria / Galpões'));

const onlyStocks = buildEquilibriumContract({ positions: positions.filter(p => p.assetClass === 'ACAO') });
assert.deepEqual(onlyStocks.tabs, ['Consolidado', 'Ações']);
const onlyFiis = buildEquilibriumContract({ positions: positions.filter(p => p.assetClass === 'FII') });
assert.deepEqual(onlyFiis.tabs, ['Consolidado', 'FIIs']);

console.log('Portfolio equilibrium contract test OK.');

const withClientMetadata = buildEquilibriumContract({ positions: [
  { ticker: 'ABCD3', quantity: 2, avgPrice: 10, currentPrice: 20, assetClass: 'ACAO', stockSegment: 'Software', stockSector: 'Tecnologia' },
  { ticker: 'KLBN11', quantity: 1, avgPrice: 10, currentPrice: 10, assetClass: '', stockSegment: 'Papel e Celulose', stockSector: 'Materiais Básicos' }
] });
assert.ok(withClientMetadata.actions.bySegment.some(x => x.label === 'Software'));
assert.ok(withClientMetadata.actions.bySector.some(x => x.label === 'Tecnologia'));
assert.ok(withClientMetadata.actions.byAsset.some(x => x.ticker === 'KLBN11'));
assert.deepEqual(withClientMetadata.tabs, ['Consolidado', 'Ações']);
