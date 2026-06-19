import assert from 'node:assert/strict';
import { buildPeerCatalogEntries, describePeerCompatibility } from '../lib/catalogs/asset-peers.js';

const petro = buildPeerCatalogEntries('PETR4', { max: 12 });
assert.equal(petro.base.ticker, 'PETR4');
assert.ok(petro.peers.some(item => item.ticker === 'PETR3'), 'PETR4 deve sugerir PETR3 como mesmo setor');
assert.ok(petro.peers.some(item => item.ticker === 'PRIO3'), 'PETR4 deve sugerir PRIO3 como petróleo/gás');
assert.ok(petro.peers.some(item => item.ticker === 'VBBR3'), 'PETR4 deve ter catálogo ampliado de petróleo/gás');
assert.ok(!petro.peers.some(item => item.ticker === 'BBAS3'), 'PETR4 não deve sugerir banco');
assert.ok(petro.peers.every(item => item.peerGroup === petro.base.peerGroup), 'todos os pares devem ficar no mesmo peerGroup');

const petroCompat = describePeerCompatibility('PETR4', 'PRIO3');
assert.equal(petroCompat.comparable, true, 'PETR4 e PRIO3 devem ser par setorial confirmado');
assert.equal(petroCompat.samePeerGroup, true);

const crossCompat = describePeerCompatibility('PETR4', 'BBAS3');
assert.equal(crossCompat.comparable, false, 'PETR4 e BBAS3 devem ser marcados como setores diferentes');
assert.equal(crossCompat.samePeerGroup, false);

const unknownCompat = describePeerCompatibility('PETR4', 'ZZZZ3');
assert.equal(unknownCompat.comparable, null, 'compatibilidade desconhecida não deve virar falso setor');
assert.equal(unknownCompat.baseKnown, true);
assert.equal(unknownCompat.targetKnown, false);

const fii = buildPeerCatalogEntries('HGLG11', { max: 10 });
assert.ok(fii.peers.some(item => item.ticker === 'XPLG11'), 'HGLG11 deve sugerir FII logístico');
assert.ok(!fii.peers.some(item => item.ticker === 'MXRF11'), 'HGLG11 não deve sugerir FII de recebíveis');

console.log('Analysis sector peers v82 test OK.');
