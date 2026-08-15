import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test as runtime } from '../lib/analysis/asset-modal-runtime.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const metricZeroSections = Object.fromEntries(runtime.stockModalSections({
  metrics: [{ id: 'vacancy', numericValue: 0, value: '0%' }]
}));
assert.equal(metricZeroSections.metrics, true, 'zero numérico explícito deve ser dado resolvido');

const fiiSections = Object.fromEntries(runtime.fiiModalSections({
  peerComparison: {
    rows: [
      { ticker: 'AAA11', dividendYield: 0, pvp: 0.93, fundType: 'Tijolo', segment: 'Logística' },
      { ticker: 'BBB11', dividendYieldDisplay: '9,2%', pvpDisplay: '0,98', fundType: 'Tijolo', segment: 'Logística' }
    ]
  }
}));
assert.equal(fiiSections.peerComparison, true, 'comparador FII útil não pode depender de patrimônio por cota');

const dividendSections = Object.fromEntries(runtime.stockModalSections({
  dividendHistory: { events: [{ date: '2026-01-01', value: 1 }] },
  dividendRadar: { status: 'PARTIAL', months: [{ activePayment: true, paymentCount: 1 }] },
  payoutChart: { points: [{ period: '2025', value: 40 }] }
}));
assert.equal(dividendSections.dividends, true, 'radar parcial com dados reais deve resolver o grupo de dividendos');

const source = fs.readFileSync(new URL('../lib/analysis/asset-modal-runtime.js', import.meta.url), 'utf8');
assert.match(source, /function hasResolvedNumericValue\(value\)/);
assert.match(source, /function hasUsefulFiiPeerComparison\(peerComparison = \{\}\)/);
assert.doesNotMatch(source, /hasFiiPeerPatrimonialCoverage/);
assert.match(source, /\['OK', 'PARTIAL'\]\.includes\(String\(payload\.dividendRadar\?\.status/);

const loader = readSiblingApkFile('app/src/main/java/com/example/ui/shared/asset/AssetModalProgressiveLoader.kt', { optional: true });
const details = readSiblingApkFile('app/src/main/java/com/example/ui/shared/asset/AssetDetailsModalUi.kt', { optional: true });
const readiness = readSiblingApkFile('app/src/main/java/com/example/ui/shared/asset/AssetModalSectionReadiness.kt', { optional: true });
if (loader && details && readiness) {
  assert.match(loader, /AssetModalLateArrivalSettlementDelaysMs = listOf\(850L, 2_100L\)/);
  assert.match(loader, /criticalMissing \+ settlementMissing/);
  assert.match(details, /recoveryContextOverride = settlementContext/);
  assert.match(readiness, /FiiAssetModalSection\.PeerComparison -> peerComparison\.hasUsefulPeerComparison\(\)/);
}

console.log('asset-modal-maturity-hardening-v425 ok');
