import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const payload = {
  ticker: 'HGLG11',
  symbol: 'HGLG11',
  assetClass: 'FII',
  price: 160.25,
  dividendYield: 8.4,
  pvp: 0.95,
  segmento: 'Logística',
  liquidezMediaDiaria: 'R$ 3,2 mi',
  fiiInfo: {
    cotistas: '450.000',
    cotasEmitidas: '35.000.000',
    valorPatrimonialPorCota: 'R$ 168,00'
  },
  fiiPortfolio: {
    vacancia: '7,2%',
    estados: [{ estado: 'SP', percentual: '61%' }]
  }
};

const portfolioPage = buildAnalysisPageResponse(payload, { ticker: 'HGLG11', surface: 'portfolio_asset_modal' });
assert.equal(portfolioPage.consumerSurface.id, 'portfolio_asset_modal');
assert.equal(portfolioPage.consumerContract.activeSurfaceId, 'portfolio_asset_modal');
assert.ok(portfolioPage.consumerContract.surfaces.some(surface => surface.id === 'portfolio_asset_modal' && surface.selected));
assert.ok(portfolioPage.consumerContract.surfaces.some(surface => surface.id === 'ranking_asset_modal'));
assert.ok(portfolioPage.consumerContract.surfaces.find(surface => surface.id === 'portfolio_asset_modal').readySectionIds.includes('summary'));

const rankingPage = buildAnalysisPageResponse({ ...payload, ticker: 'BBAS3', symbol: 'BBAS3', assetClass: 'ACAO' }, { ticker: 'BBAS3', consumer: 'ranking_asset_modal' });
assert.equal(rankingPage.consumerSurface.id, 'ranking_asset_modal');
assert.equal(rankingPage.consumerContract.activeSurfaceId, 'ranking_asset_modal');
assert.ok(rankingPage.consumerContract.surfaces.some(surface => surface.id === 'ranking_asset_modal' && surface.selected));
assert.ok(rankingPage.consumerContract.uiPolicy.hideTechnicalDiagnosticsOnMainScreen);
assert.ok(rankingPage.consumerContract.uiPolicy.neverRenderSyntheticData);

console.log('Analysis modal connection v57 test OK.');
