import assert from 'node:assert/strict';
import { applyPayloadView } from '../lib/quality/views.js';

const sample = {
  schemaVersion: 'asset-test',
  version: '21.12.0',
  status: 'OK',
  partial: false,
  ticker: 'MXRF11',
  type: 'FII',
  cacheStatus: 'UNIT',
  warnings: [],
  results: { nome: 'MXRF11' },
  normalized: {
    precoAtual: { value: 10.25, display: 'R$ 10,25', unit: 'BRL' },
    dividendYield: { value: 12.4, display: '12,40%', unit: '%' },
    pvp: { value: 0.96, display: '0,96', unit: 'ratio' },
    valorPatrimonialCota: { value: 10.66, display: 'R$ 10,66', unit: 'BRL' },
    patrimonioLiquido: { value: 3000000000, display: 'R$ 3 bi', unit: 'BRL' },
    liquidezMediaDiaria: { value: 12000000, display: 'R$ 12 mi', unit: 'BRL' },
    numeroCotistas: { value: 1200000, display: '1,2 mi', unit: 'number' },
    cotasEmitidas: { value: 280000000, display: '280 mi', unit: 'number' },
    vacanciaFisica: { value: 0, display: '0%', unit: '%' },
    yield12m: { value: 12.4, display: '12,40%', unit: '%' },
    tipoFundo: { value: undefined, display: 'Papel', unit: 'text' },
  },
  appMobileSnapshot: { ticker: 'MXRF11', type: 'FII', quote: { price: 10.25, dividendYield: 12.4 }, metrics: { precoAtual: 10.25, dividendYield: 12.4, pvp: 0.96 }, charts: [] },
  appPayload: {
    ticker: 'MXRF11',
    type: 'FII',
    status: 'OK',
    quote: { ticker: 'MXRF11', type: 'FII', name: 'MXRF11', price: 10.25, dividendYield: 12.4 },
    metrics: { count: 10, canonical: { precoAtual: { value: 10.25 }, dividendYield: { value: 12.4 }, pvp: { value: 0.96 }, numeroCotistas: { value: 1200000 }, cotasEmitidas: { value: 280000000 } } },
    dividends: { count: 1, history: [{ dataCom: '01/05/2026', dataPagamento: '10/05/2026', valor: 0.10 }] },
    charts: { count: 0, series: [] },
  },
  appSyncEnvelope: { decision: 'replace_snapshot' },
  appResponseIntegrity: { ok: true, renderSafe: true, cacheSafe: true, score: 95 },
  metrics: { generatedAt: '2026-05-30T00:00:00.000Z', extractionCompleteness: 92 },
};

const appView = applyPayloadView(sample, 'app');
assert.equal(appView.view, 'app');
assert.ok(appView.officialAppContractVersion.includes('21.12.54'));
assert.equal(appView.results.precoAtual, 10.25);
assert.equal(appView.results.price, 10.25);
assert.equal(appView.results.indicadores.dividendYield, 12.4);
assert.equal(appView.results.indicadores.yield12m, 12.4);
assert.equal(appView.results.informacoesFundo.numeroCotistas, 1200000);
assert.equal(appView.results.informacoesFundo.cotistas, 1200000);
assert.equal(appView.results.informacoesFundo.cotasEmitidas, 280000000);
assert.equal(appView.results.valorPatrimonial.valorPatrimonial, 10.66);
assert.equal(appView.results.financialSummary.patrimonioLiquido, 3000000000);
assert.equal(appView.results.indicadoresAvancados.p_vp, 0.96);
assert.equal(appView.normalized.precoAtual.value, 10.25);
assert.deepEqual(appView.legacyAppCompat.preferredRoots, ['appMobileSnapshot', 'appPayload']);
assert.ok(appView.payloadViewProfile.legacyMirroredRoots.includes('normalized'));
assert.ok(appView.normalizedSummary.fields.includes('numeroCotistas'));

console.log('apk-total-contract-v21-12-54 ok');
