import assert from 'node:assert/strict';
import { buildPeerCatalogEntries } from '../lib/catalogs/asset-peers.js';

const petro = buildPeerCatalogEntries('PETR4', { max: 10 });
assert.equal(petro.base.ticker, 'PETR4');
assert.ok(petro.peers.some(item => item.ticker === 'PETR3'), 'PETR4 deve sugerir PETR3 como mesmo setor');
assert.ok(petro.peers.some(item => item.ticker === 'PRIO3'), 'PETR4 deve sugerir PRIO3 como petróleo/gás');
assert.ok(!petro.peers.some(item => item.ticker === 'BBAS3'), 'PETR4 não deve sugerir banco');
assert.ok(petro.peers.every(item => item.peerGroup === petro.base.peerGroup), 'todos os pares devem ficar no mesmo peerGroup');

const fii = buildPeerCatalogEntries('HGLG11', { max: 10 });
assert.ok(fii.peers.some(item => item.ticker === 'XPLG11'), 'HGLG11 deve sugerir FII logístico');
assert.ok(!fii.peers.some(item => item.ticker === 'MXRF11'), 'HGLG11 não deve sugerir FII de recebíveis');

const unknown = buildPeerCatalogEntries('ZZZZ3', { max: 10 });
assert.equal(unknown.base, null);
assert.deepEqual(unknown.peers, []);

console.log('Analysis sector peers v81 test OK.');
