import assert from 'node:assert/strict';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';
import { quantityAtDate } from '../lib/portfolio/positions.js';

const parser = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyMarketPortfolioParsers.kt');
const agenda = readSiblingApkFile('app/src/main/java/com/example/domain/DividendAgendaCalculator.kt');
const evolution = readSiblingApkFile('app/src/main/java/com/example/domain/DividendEvolutionCalculator.kt');
const home = [
  readSiblingApkFile('app/src/main/java/com/example/app/portfolio/PortfolioHomeUi.kt'),
  readSiblingApkFile('app/src/main/java/com/example/app/portfolio/PortfolioHomeCardsUi.kt'),
  readSiblingApkFile('app/src/main/java/com/example/app/portfolio/PortfolioHomeSupportUi.kt'),
].filter(Boolean).join('\n');
const model = readSiblingApkFile('app/src/main/java/com/example/domain/model/ValoraePortfolioContracts.kt');

if (!parser || !agenda || !evolution || !home || !model) {
  console.log('dividend lifecycle cross-stack v405 skipped: APK pareado não configurado');
  process.exit(0);
}

assert.match(parser, /if \(onlyEligible && !event\.eligible\)/, 'APK deve filtrar aliases pessoais por elegibilidade');
assert.doesNotMatch(parser, /optBoolean\("eligible", true\)/, 'APK não pode presumir elegibilidade ausente');
assert.match(agenda, /isProvenPortfolioDividendEventForAgenda/, 'Minha Agenda exige posição comprovada na Data COM');
assert.match(evolution, /isProvenPortfolioDividendEventForAgenda/, 'Proventos pagos exige posição comprovada na Data COM');
assert.match(home, /restoredQuantityAtDate/, 'eventos restaurados da nuvem devem ser revalidados');
assert.match(home, /if \(quantityAtEligibility <= 0\.0\) return null/, 'nuvem não pode reintroduzir evento inelegível');
for (const field of ['grossValuePerShare', 'netValuePerShare', 'grossAmount', 'netAmount']) {
  assert.ok(model.includes(field), `APK deve preservar ${field}`);
}

assert.equal(quantityAtDate('PETR4', '2026-01-01', [{ ticker: 'PETR4', quantity: 10 }], [{ ticker: 'PETR4', side: 'BUY', quantity: 10, date: '2026-02-01' }]), 0);
console.log('dividend lifecycle cross-stack v405 OK');
