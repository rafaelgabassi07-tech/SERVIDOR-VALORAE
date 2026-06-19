import assert from 'node:assert/strict';
import { buildPeerCatalogEntries, describePeerCompatibility, normalizePeerGroup } from '../lib/catalogs/asset-peers.js';

const petro = buildPeerCatalogEntries('PETR4', { max: 12 });
assert.equal(petro.base.peerGroup, 'petroleo-gas');
assert.ok(petro.peers.length > 0, 'PETR4 deve ter pares visuais para cards');
assert.ok(petro.peers.every(item => item.peerGroup === petro.base.peerGroup), 'cards v83 não podem misturar peerGroup');
assert.ok(petro.peers.every(item => item.ticker && item.segment && item.sector), 'cards v83 precisam de ticker, segmento e setor');

const compat = describePeerCompatibility('PETR4', 'PRIO3');
assert.equal(compat.comparable, true);
assert.equal(compat.message.includes('mesmo grupo'), true);

const cross = describePeerCompatibility('PETR4', 'BBAS3');
assert.equal(cross.comparable, false);
assert.equal(cross.samePeerGroup, false);

assert.equal(normalizePeerGroup('Petróleo, Gás e Biocombustíveis'), 'petroleo-gas');
assert.equal(normalizePeerGroup('Recebíveis imobiliários'), 'fii-recebiveis');

console.log('Analysis comparison visual v83 test OK.');
