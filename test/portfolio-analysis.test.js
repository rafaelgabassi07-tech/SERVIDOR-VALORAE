import assert from 'node:assert/strict';
import { buildPortfolioAnalysis } from '../lib/portfolio/analysis.js';

const analysis = buildPortfolioAnalysis({ positions: [
  { ticker: 'PETR4', quantity: 10, avgPrice: 20, currentPrice: 30, type: 'ACAO', sector: 'Petróleo' },
  { ticker: 'MXRF11', quantity: 100, avgPrice: 10, currentPrice: 10, type: 'FII' }
] });
assert.equal(analysis.allocationBySector.some(x => x.sector === 'Petróleo'), true);
assert.equal(analysis.allocationBySector.some(x => x.sector === 'Fundos Imobiliários'), true);
assert.equal(analysis.rebalance.every(x => x.action === 'OBSERVAR'), true);
assert.equal(analysis.rebalancePolicy.includes('Sem metas reais'), true);

const targeted = buildPortfolioAnalysis({
  positions: [{ ticker: 'PETR4', quantity: 10, avgPrice: 20, currentPrice: 30, type: 'ACAO' }],
  targetWeights: { PETR4: 50 }
});
assert.equal(targeted.rebalance[0].targetSource, 'payload-target-real');
assert.equal(targeted.rebalance[0].action, 'REDUZIR');
