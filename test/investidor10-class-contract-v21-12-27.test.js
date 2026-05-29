import assert from 'node:assert/strict';
import { buildAssetClassContract, buildAssetGroupView, buildAssetSourceMapView, buildFiiChecklistView } from '../lib/quality/asset-class-contract.js';
import { buildUniversalNormalized } from '../lib/normalizers/universal.js';
import { routeManifest } from '../routes/_router.js';

const stockPayload = {
  ticker: 'PETR4',
  type: 'ACAO',
  status: 'OK',
  results: {
    precoAtual: 'R$ 32,10',
    indicadores: {
      pl: '5,2',
      pvp: '1,1',
      psr: '1,4',
      roe: '22,5%',
      roic: '18,1%',
      roa: '9,9%',
      margemLiquida: '16,4%',
      margemBruta: '48,0%',
      dividendYield: '8,3%',
      payout: '42%'
    },
    informacoesEmpresa: {
      valorDeMercado: 'R$ 450 bi',
      valorDeFirma: 'R$ 520 bi',
      patrimonioLiquido: 'R$ 390 bi',
      liquidezMediaDiaria: 'R$ 900 mi',
      freeFloat: '55%',
      tagAlong: '100%',
      dividaLiquida: 'R$ 80 bi',
      dividaBruta: 'R$ 110 bi',
      disponibilidade: 'R$ 30 bi'
    },
    sections: {
      demonstrativos: { receitasLucros: { series: [1, 2, 3] }, lucroCotacao: { series: [1] } },
      comparador: { pares: [{ ticker: 'VALE3' }] }
    }
  }
};
stockPayload.normalized = buildUniversalNormalized(stockPayload);
stockPayload.appPayload = { metrics: { canonical: stockPayload.normalized, aliases: {} } };
const stockContract = buildAssetClassContract(stockPayload);
assert.equal(stockContract.assetType, 'stock');
assert.equal(stockContract.sourceModel, 'stock-as-company');
assert.ok(stockContract.groups.valuation.present >= 4, 'stock valuation should be populated');
assert.ok(stockContract.groups.profitability.present >= 4, 'stock profitability should be populated');
assert.ok(stockContract.groups.dividends.present >= 2, 'stock dividends should be populated');
assert.ok(stockContract.fieldConfidence.pl.present, 'P/L confidence should exist');
assert.ok(buildAssetGroupView({ ...stockPayload, assetClassContract: stockContract }, 'valuation').fields.pl);

const fiiPayload = {
  ticker: 'HGLG11',
  type: 'FII',
  status: 'OK',
  results: {
    precoAtual: 'R$ 160,00',
    dividendYield: '9,1%',
    pvp: '0,95',
    informacoesFundo: {
      numeroCotistas: '320 mil',
      cotasEmitidas: '30 mi',
      segmentoFii: 'Logística',
      tipoFundo: 'Tijolo',
      mandato: 'Renda',
      tipoGestao: 'Ativa',
      taxaAdministracao: '0,6% a.a.'
    },
    sections: {
      listaImoveis: [{ nome: 'Galpão A', estado: 'SP', abl: '100.000 m²' }],
      comunicados: [{ titulo: 'Relatório Gerencial' }]
    },
    vacanciaFisica: '4,2%',
    vacanciaFinanceira: '2,0%',
    valorPatrimonialTotal: 'R$ 4,8 bi',
    valorPatrimonial: 'R$ 155,10',
    ultimoRendimento: 'R$ 1,10',
    yield12m: '9,1%'
  }
};
fiiPayload.normalized = buildUniversalNormalized(fiiPayload);
fiiPayload.appPayload = { metrics: { canonical: fiiPayload.normalized, aliases: {} } };
const fiiContract = buildAssetClassContract(fiiPayload);
assert.equal(fiiContract.assetType, 'fii');
assert.equal(fiiContract.sourceModel, 'fii-as-fund');
assert.ok(fiiContract.groups.income.present >= 3, 'FII income should be populated');
assert.ok(fiiContract.groups.profile.present >= 3, 'FII profile should be populated');
assert.ok(fiiContract.groups.patrimonial.present >= 2, 'FII patrimonial should be populated');
assert.ok(buildFiiChecklistView({ ...fiiPayload, assetClassContract: fiiContract }).checks.length >= 6);
assert.ok(buildAssetSourceMapView({ ...fiiPayload, assetClassContract: fiiContract }).fieldConfidence.pvp);

const manifest = routeManifest();
for (const path of ['/asset/valuation', '/asset/source-map', '/fii/income', '/fii/checklist']) {
  assert.ok(manifest.routes.includes(path), `route manifest should include ${path}`);
}

console.log('investidor10 class contract v21.12.27 ok');
