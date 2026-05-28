import assert from 'node:assert/strict';
import { buildUniversalNormalized } from '../lib/normalizers/universal.js';
import { buildAppConsumerPayload } from '../lib/quality/app-consumer-payload.js';
import { applyPayloadView, resolvePayloadView } from '../lib/quality/views.js';

const payload = {
  ticker: 'HGLG11',
  type: 'FII',
  status: 'OK',
  results: {
    nome: 'CSHG Logística',
    cotacao: { preço: 'R$ 158,45', 'Variação Dia': '-0,82%' },
    indicadores: {
      'D.Y': '9,87%',
      'P/VP': '0,94',
      'Último Rendimento': 'R$ 1,10',
    },
    informacoesFundo: {
      'Patrimônio Líquido': 'R$ 4,2 bi',
      'Vacância Física': '5,4%',
    },
    informacoesEmpresa: {
      'Liquidez Média Diária': 'R$ 8,5 mi',
    },
  },
  panelReadiness: { panels: [{ key: 'quote', ready: true, completenessPercent: 100 }] },
  sourceReport: { primarySource: 'mock', sourcesUsed: ['mock'] },
};

payload.normalized = buildUniversalNormalized(payload);
assert.equal(payload.normalized.precoAtual.value, 158.45);
assert.equal(payload.normalized.variacaoDay.value, -0.82);
assert.equal(payload.normalized.dividendYield.value, 9.87);
assert.equal(payload.normalized.pvp.value, 0.94);
assert.equal(payload.normalized.ultimoRendimento.value, 1.1);
assert.equal(payload.normalized.patrimonioLiquido.value, 4_200_000_000);
assert.equal(payload.normalized.vacanciaFisica.value, 5.4);
assert.equal(payload.normalized.liquidezMediaDiaria.value, 8_500_000);
assert.equal(payload.normalized._meta.aliasFallbacks, true);

payload.appPayload = buildAppConsumerPayload(payload);
assert.equal(payload.appPayload.quote.price, 158.45);
assert.equal(payload.appPayload.metrics.canonical.dividendYield.value, 9.87);
assert.equal(payload.appPayload.metrics.canonical.patrimonioLiquido.unit, 'BRL');

assert.equal(resolvePayloadView('watchlist').resolved, 'compact');
assert.equal(resolvePayloadView('list').resolved, 'compact');
const compact = applyPayloadView({ ...payload, chartSeries: { series: [{ key: 'long', points: Array.from({ length: 30 }, (_, i) => ({ x: i, y: i })) }] }, appMobileSnapshot: { ok: true }, appSyncEnvelope: { ok: true } }, 'watchlist');
assert.equal(compact.view, 'compact');
assert.equal(compact.payloadViewProfile.requested, 'watchlist');
assert.equal(compact.payloadViewProfile.resolved, 'compact');
assert.equal(compact.chartSeries, undefined);

console.log('field-alias-mobile-compact-v21-12-12 ok');
