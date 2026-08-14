import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPeerCatalogEntries } from '../lib/catalogs/asset-peers.js';
import { modifiedDietzMonthlyReturnPercent } from '../lib/portfolio/return-calculation.js';

const analysisSource = fs.readFileSync(new URL('../lib/portfolio/analysis.js', import.meta.url), 'utf8');
const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');

const almost = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

// Aporte grande não pode ser interpretado como retorno da carteira.
const cashFlowAware = modifiedDietzMonthlyReturnPercent({
  beginningMarketValue: 10_000,
  endingMarketValue: 102_000,
  contributions: 90_000,
  weightedNetCashFlow: 45_000
});
almost(cashFlowAware, 2000 / 55000 * 100);
assert.ok(cashFlowAware < 5, 'aporte intermediário inflou o retorno');

assert.match(analysisSource, /weightedNetCashFlow/);
assert.match(analysisSource, /modifiedDietzMonthlyReturnPercent/);
assert.doesNotMatch(analysisSource, /adjustedEnd\s*=\s*point\.marketValue\s*\+\s*withdrawals\s*\+\s*dividends\s*-\s*contributions/);

// Comparador usa pares reais do catálogo apenas para escolher símbolos; métricas vêm das páginas reais.
const peerCatalog = buildPeerCatalogEntries('PETR4', { max: 6, includeBase: false });
assert.equal(peerCatalog.base?.ticker, 'PETR4');
assert.ok(peerCatalog.peers.length >= 2);
assert.ok(peerCatalog.peers.every(item => item.peerGroup === peerCatalog.base.peerGroup));

assert.match(stockSource, /recoverStockPeerComparisonFromRealPeers/);
assert.match(stockSource, /Promise\.allSettled\(candidates\.map/);
assert.match(stockSource, /fetcher\(url/);
assert.match(stockSource, /stockTickerIdentityOk/);
assert.match(stockSource, /stockPeerRowFromRealPage/);
assert.match(stockSource, /wantsPeerComparisonRecovery/);
assert.match(stockSource, /recoveryTarget\.sections\.has\('peerComparison'\)/);
assert.match(stockSource, /policy:\s*'html_comparator_then_live_peer_recovery'/);
assert.match(stockSource, /source:\s*'VALORAE peer catalog \+ Investidor10 ações'/);

console.log('apk-v674-return-stock-comparator-v422 ok');
