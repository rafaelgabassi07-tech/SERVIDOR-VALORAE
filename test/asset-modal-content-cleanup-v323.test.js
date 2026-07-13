import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test as stock } from '../lib/analysis/stock-modal-contract.js';
import { _test as runtime } from '../lib/analysis/asset-modal-runtime.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../lib/analysis/asset-modal-runtime.js', import.meta.url), 'utf8');

// A seção foi desativada no producer: nenhuma URL dedicada é agendada e uma
// recuperação legada composta apenas por ela não dispara coleta profunda genérica.
assert.equal(stockSource.includes("addTask('shareholdingPosition'"), false);
assert.equal(stockSource.includes('shareholdingPosition: investidor10?.shareholdingPosition'), false);
const disabledTarget = stock.stockSectionRecoveryTargets({
  recovery: true,
  knownMissingSections: 'shareholdingPosition'
});
assert.deepEqual([...disabledTarget.sections], []);
assert.equal(stock.stockApiKeyNeededForTargets('shareholdingPosition', disabledTarget), false);

const readiness = stock.buildStockModalSectionReadiness({
  investidor10: {
    shareholdingPosition: { rows: [{ shareholder: 'Controlador' }], status: 'OK' }
  }
});
assert.equal(readiness.sections.some(section => section.id === 'shareholdingPosition'), false);
assert.equal(readiness.totalCount, 5);

// O bloco desativado não altera qualidade, completude ou utilidade do cache.
const emptyQuality = runtime.modalPayloadQualityProfile({}, 'stock');
const shareholdingOnlyQuality = runtime.modalPayloadQualityProfile({
  shareholdingPosition: { rows: [{ shareholder: 'Controlador' }] }
}, 'stock');
assert.deepEqual(shareholdingOnlyQuality, emptyQuality);
assert.equal(runtimeSource.includes("['shareholdingPosition'"), false);
assert.equal(runtimeSource.includes("shareholdingPosition: ['shareholdingPosition']"), false);

const modalUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetDetailsModalUi.kt');
const fiiPortfolioUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalFiiPortfolioUi.kt');
const comparisonUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalDividendsChartsComparisonUi.kt');
const mergePolicy = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalMergePolicy.kt');
if (modalUi && fiiPortfolioUi && comparisonUi && mergePolicy) {
  assert.equal(/\bStockShareholdingPositionSection\s*\(/.test(modalUi), false);
  assert.equal(fiiPortfolioUi.includes('Lista de imóveis ainda não disponível para este FII'), false);
  assert.equal(comparisonUi.includes('AssetIndexQuoteStrip(comparison.indexQuotes'), false);
  assert.ok(mergePolicy.includes('setOf("shareholdingPosition")'));
}

console.log('asset-modal-content-cleanup-v323 ok');
