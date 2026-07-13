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
      { vacancyPercent: 7.1 },
      { vacancyPercent: 8.2 },
      { vacancyPercent: 6.9 }
    ]
  },
  dividendCharts: {
    averageDy5y: 8.45,
    events: [{ dataCom: '2021-01-01' }]
  }
});

assert.equal(checklist.status, 'OK');
assert.equal(checklist.items.length, 8);
assert.equal(checklist.passed, 7);
assert.equal(checklist.failed, 0);
assert.equal(checklist.unknown, 1);
assert.equal(checklist.items.find(item => item.id === 'financial_vacancy_below_10').status, 'UNKNOWN');
assert.equal(checklist.diagnostics.portfolioIndependent, true);
assert.equal(checklist.diagnostics.derivation, 'calculated_by_valorae_from_investidor10_metrics');
assert.ok(checklist.subtitle.includes('sem depender da carteira'));

console.log('fii-modal-checklist-independent-v214 ok');
