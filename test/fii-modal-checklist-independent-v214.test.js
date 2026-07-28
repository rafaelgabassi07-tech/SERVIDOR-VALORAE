import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v25-modal-source-repair');

const raw = _test.extractInvestidor10FiiBuyHoldChecklist('<main>Sem checklist público renderizado no HTML estático</main>', 'GGRC11');
assert.equal(raw.status, 'EMPTY');

const checklist = _test.ensureFiiBuyHoldChecklist({
  checklist: raw,
  ticker: 'GGRC11',
  html: '<section>O fundo foi constituído em 2014 e possui imóveis logísticos.</section>',
  quickMetrics: {
    dailyLiquidity: 1_250_000
  },
  infoItems: [
    { id: 'numero_cotistas', value: '34.500' },
    { id: 'valor_patrimonial', value: 'R$ 1,28 Bilhão' }
  ],
  propertyPortfolio: {
    totalProperties: 6,
    properties: Array.from({ length: 6 }, (_, index) => ({ id: `p${index + 1}` }))
  },
  vacancyHistory: {
    points: [
      { physicalVacancyPercent: 7.1, financialVacancyPercent: 6.4 },
      { physicalVacancyPercent: 8.2, financialVacancyPercent: 7.0 },
      { physicalVacancyPercent: 6.9, financialVacancyPercent: 5.8 }
    ]
  },
  dividendCharts: {
    events: [{ dataCom: '2021-01-01' }],
    yieldSeriesByFrequency: {
      monthly: Array.from({ length: 24 }, (_, index) => ({
        period: `${2024 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`,
        value: 9.2,
        yieldPercent: 9.2
      }))
    }
  }
});

assert.equal(checklist.status, 'OK');
assert.equal(checklist.items.length, 8);
assert.equal(checklist.passed, 8);
assert.equal(checklist.failed, 0);
assert.equal(checklist.unknown, 0);
assert.equal(checklist.items.find(item => item.id === 'financial_vacancy_below_10').status, 'PASSED');
assert.equal(checklist.diagnostics.portfolioIndependent, true);
assert.equal(checklist.diagnostics.derivation, 'calculated_by_valorae_from_investidor10_metrics');
assert.ok(checklist.subtitle.includes('Todos os 8 critérios canônicos'));
assert.deepEqual(checklist.diagnostics.missingCriterionIds, []);
assert.equal(checklist.diagnostics.hasAverageDy24m, true);
assert.equal(checklist.diagnostics.averageDy24mSampleCount, 24);

console.log('fii-modal-checklist-independent-v214 ok');
