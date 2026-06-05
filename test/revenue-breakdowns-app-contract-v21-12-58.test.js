import assert from 'node:assert/strict';
import { buildAppConsumerPayload } from '../lib/quality/app-consumer-payload.js';
import { buildAppMobileSnapshot } from '../lib/quality/app-mobile-snapshot.js';
import { buildAssetClassContract } from '../lib/quality/asset-class-contract.js';

const payload = {
  ticker: 'WEGE3',
  type: 'ACAO',
  status: 'success',
  results: {
    revenueGeography: { labels: ['Brasil', 'Exterior'], series: [45, 55] },
    revenueSegment: { labels: ['Motores', 'Energia'], series: [60, 40] },
    sections: {
      empresa: {
        regioesReceita: { labels: ['Brasil', 'Exterior'], series: [45, 55] },
        negociosReceita: { labels: ['Motores', 'Energia'], series: [60, 40] },
      },
    },
  },
  chartSeries: { series: [] },
  normalized: {},
  metrics: { generatedAt: '2026-06-04T00:00:00.000Z' },
};

const appPayload = buildAppConsumerPayload(payload);
assert.equal(appPayload.charts.revenueBreakdowns.hasRegion, true);
assert.equal(appPayload.charts.revenueBreakdowns.hasBusiness, true);
assert.deepEqual(appPayload.charts.revenueGeography.labels, ['Brasil', 'Exterior']);
assert.deepEqual(appPayload.charts.revenueByBusiness.labels, ['Motores', 'Energia']);

const enriched = { ...payload, appPayload };
const mobile = buildAppMobileSnapshot(enriched);
assert.deepEqual(mobile.revenueBreakdowns.revenueGeography.labels, ['Brasil', 'Exterior']);
assert.deepEqual(mobile.revenueBreakdowns.revenueByBusiness.labels, ['Motores', 'Energia']);

const contract = buildAssetClassContract(enriched);
assert.equal(contract.groups.statements.fields.revenueGeography.present, true);
assert.equal(contract.groups.statements.fields.revenueByBusiness.present, true);
assert.equal(contract.groups.statements.fields.negociosReceita.present, true);

console.log('revenue-breakdowns-app-contract-v21-12-58 OK');
