import assert from 'node:assert/strict';
import { buildPeerCatalogEntries, describePeerCompatibility, normalizePeerGroup } from '../lib/catalogs/asset-peers.js';

assert.equal(normalizePeerGroup('Seguradoras'), 'seguros');
assert.equal(normalizePeerGroup('Bolsa e infraestrutura de mercado'), 'infraestrutura-mercado');
assert.equal(normalizePeerGroup('Recebíveis imobiliários'), 'fii-recebiveis');

const banks = buildPeerCatalogEntries('BBAS3', { max: 10 });
assert.ok(banks.peers.some(item => item.ticker === 'ITUB4'), 'BBAS3 deve sugerir ITUB4 como par bancário');
assert.ok(banks.peers.every(item => item.peerGroup === banks.base.peerGroup), 'Sugestões devem ficar no mesmo peerGroup do ativo-base');

const strong = describePeerCompatibility('BBAS3', 'ITUB4');
assert.equal(strong.comparable, true);
assert.equal(strong.comparisonMode, 'decision');
assert.equal(strong.confidence, 'HIGH');

const sectorOnly = describePeerCompatibility('BBAS3', 'BBSE3');
assert.equal(sectorOnly.comparable, false);
assert.equal(sectorOnly.comparisonMode, 'informative');
assert.equal(sectorOnly.confidence, 'LOW_SECTOR_ONLY');

console.log('Analysis comparison decision v103 test OK.');
