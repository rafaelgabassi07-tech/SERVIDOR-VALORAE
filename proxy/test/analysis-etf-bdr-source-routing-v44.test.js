import assert from 'node:assert/strict';
import { classifyTicker, investidor10PageTypes, statusInvestPageTypes, statusInvestType } from '../lib/core/tickers.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

assert.equal(classifyTicker('BOVA11'), 'ETF', 'BOVA11 não pode ser classificado como FII; a fonte correta da Análise é /etfs/bova11/');
assert.equal(classifyTicker('AAPL34'), 'BDR', 'AAPL34 não pode cair como ação local comum; a fonte correta da Análise é /bdrs/aapl34/');
assert.equal(classifyTicker('HGLG11'), 'FII', 'FIIs reais terminados em 11 continuam como FII');
assert.equal(classifyTicker('PETR4'), 'ACAO', 'ações locais comuns continuam como AÇÃO');

assert.deepEqual(investidor10PageTypes('BOVA11').slice(0, 2), ['etfs', 'fiis'], 'ETF deve tentar Investidor10 /etfs antes de qualquer fallback');
assert.deepEqual(investidor10PageTypes('AAPL34').slice(0, 1), ['bdrs'], 'BDR deve tentar Investidor10 /bdrs primeiro');
assert.deepEqual(statusInvestPageTypes('BOVA11').slice(0, 1), ['etfs'], 'ETF deve tentar StatusInvest /etfs primeiro');
assert.deepEqual(statusInvestPageTypes('AAPL34').slice(0, 1), ['bdrs'], 'BDR deve tentar StatusInvest /bdrs primeiro');
assert.equal(statusInvestType('BOVA11'), 'acao', 'contrato legado de proventos permanece binário para não quebrar rotas antigas');

const etfResponse = buildAnalysisPageResponse({ ticker: 'BOVA11', assetClass: classifyTicker('BOVA11') }, { ticker: 'BOVA11' });
assert.equal(etfResponse.assetType, 'ETF', 'AnalysisPageResponse precisa preservar ETF como tipo do ativo');
assert.ok(!etfResponse.sections.some(section => section.id === 'fii_details' || section.id === 'fii_checklist'), 'ETF não pode receber blocos de FII no APK');
assert.ok(!etfResponse.sections.some(section => section.id === 'financial_statements' || section.id === 'ownership' || section.id === 'revenue_breakdown'), 'ETF não pode receber blocos próprios de empresa/FII sem fonte aplicável');
assert.ok(!etfResponse.missingSignals.some(signal => ['financial_statements','ownership','revenue_breakdown','fii_details','fii_checklist'].includes(signal.id)), 'ETF não deve sinalizar como erro blocos que não se aplicam ao tipo ETF');

const bdrResponse = buildAnalysisPageResponse({ ticker: 'AAPL34', assetClass: classifyTicker('AAPL34') }, { ticker: 'AAPL34' });
assert.equal(bdrResponse.assetType, 'BDR', 'AnalysisPageResponse precisa preservar BDR como tipo do ativo');
assert.ok(bdrResponse.sections.some(section => section.id === 'financial_statements'), 'BDR deve manter bloco de demonstrativos quando houver série real da fonte');

console.log('Analysis ETF/BDR source routing v44 test OK.');
