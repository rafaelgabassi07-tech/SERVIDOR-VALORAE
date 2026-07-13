import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v25-modal-source-repair');

const html = `
  <h2>INFORMAÇÕES SOBRE VALOR PATRIMONIAL</h2>
  O valor patrimonial é um item determinante para ser analisado antes de adquirir qualquer fundo imobiliário.
  VALOR PATRIMONIAL POR COTA R$ 11,03
  VALOR DA COTA R$ 9,73
  NÚMERO DE COTAS 214,25 Milhões
  P/VP 0,88
  VALOR PATRIMONIAL R$ 2,36 Bilhões
  <h2>MÉDIA DO TIPO E SEGMENTO</h2>
  Mesmo tipo e segmento
  Comparando o GGRC11 com a média dos indicadores dos FIIs de tipo (Fundo de Tijolo) e do segmento (Logístico / Indústria / Galpões).
  GGRC11 P/VP : 0,88 Comparação : 0,81
  GGRC11 DY (12M) : 12,33% Comparação : 7,35%
  Valor Patrimonial : 2,36 Bilhões Comparação : 336,25 Milhões
  Val. Patrimonial p/ Cota : R$ 11,03 Comparação : R$ 85,01
  <h2>NOTÍCIAS SOBRE GGRC11</h2>
`;

const payload = _test.buildFiiPatrimonialInfoPayload({
  html,
  ticker: 'GGRC11',
  quickMetrics: { priceDisplay: 'R$ 9,73', pvpDisplay: '0,88', dy12mDisplay: '12,33%' },
  infoItems: [
    { id: 'tipo_fundo', value: 'Fundo de Tijolo' },
    { id: 'segmento', value: 'Logístico / Indústria / Galpões' }
  ],
  canonical: {},
  peerComparison: { rows: [] }
});

assert.equal(payload.status, 'OK');
assert.equal(payload.bars.length, 2);
assert.equal(payload.bars[0].valueDisplay, 'R$ 11,03');
assert.equal(payload.bars[1].valueDisplay, 'R$ 9,73');
assert.equal(payload.metrics.length, 3);
assert.equal(payload.metrics.find(item => item.id === 'shares_count').valueDisplay, '214,25 Milhões');
assert.equal(payload.metrics.find(item => item.id === 'pvp').valueDisplay, '0,88');
assert.equal(payload.metrics.find(item => item.id === 'patrimonial_value').valueDisplay, 'R$ 2,36 Bilhões');
assert.equal(payload.segmentAverage.rows.length, 4);
assert.equal(payload.segmentAverage.rows.find(row => row.id === 'pvp').comparisonDisplay, '0,81');
assert.equal(payload.segmentAverage.rows.find(row => row.id === 'dy12m').comparisonDisplay, '7,35%');
assert.equal(payload.segmentAverage.rows.find(row => row.id === 'patrimonial_value').comparisonDisplay, '336,25 Milhões');
assert.equal(payload.segmentAverage.rows.find(row => row.id === 'patrimonial_value_per_share').comparisonDisplay, 'R$ 85,01');
assert.ok(payload.segmentAverage.description.includes('GGRC11'));

const fallback = _test.buildFiiPatrimonialInfoPayload({
  html: '',
  ticker: 'GGRC11',
  quickMetrics: { priceDisplay: 'R$ 9,73', pvpDisplay: '0,88', dy12mDisplay: '12,33%' },
  infoItems: [
    { id: 'valor_patrimonial_cota', value: 'R$ 11,03' },
    { id: 'valor_patrimonial', value: 'R$ 2,36 Bilhões' },
    { id: 'cotas_emitidas', value: '214,25 Milhões' },
    { id: 'tipo_fundo', value: 'Fundo de Tijolo' },
    { id: 'segmento', value: 'Logístico / Indústria / Galpões' }
  ],
  canonical: {},
  peerComparison: {
    rows: [
      { ticker: 'GGRC11', isReference: true, pvp: 0.88, dividendYield: 12.33, patrimonialValue: 2360000000 },
      { ticker: 'HGLG11', pvp: 0.90, dividendYield: 8.82, patrimonialValue: 7570000000 },
      { ticker: 'BTLG11', pvp: 1.00, dividendYield: 9.30, patrimonialValue: 7110000000 }
    ]
  }
});
assert.equal(fallback.status, 'OK');
assert.ok(fallback.segmentAverage.rows.find(row => row.id === 'pvp').comparisonDisplay);

console.log('fii-modal-patrimonial-info-v211 ok');
