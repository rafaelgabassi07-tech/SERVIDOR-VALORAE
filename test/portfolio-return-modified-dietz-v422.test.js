import assert from 'node:assert/strict';
import { modifiedDietzMonthlyReturnPercent } from '../lib/portfolio/return-calculation.js';

const approx = (actual, expected, epsilon = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} ≈ ${expected}`);
};

// Sem fluxo externo: retorno simples de mercado.
approx(modifiedDietzMonthlyReturnPercent({ beginningMarketValue: 10_000, endingMarketValue: 10_500 }), 5);

// Aporte de R$ 90 mil no meio do mês: o aporte não pode virar performance da carteira.
// Capital médio aproximado = 10k + 45k; ganho econômico = 2k => 3,63636%.
approx(modifiedDietzMonthlyReturnPercent({
  beginningMarketValue: 10_000,
  endingMarketValue: 102_000,
  contributions: 90_000,
  weightedNetCashFlow: 45_000
}), 2000 / 55_000 * 100);

// Aporte no fim do período fica pouco tempo exposto e, portanto, tem peso baixo.
approx(modifiedDietzMonthlyReturnPercent({
  beginningMarketValue: 100_000,
  endingMarketValue: 151_000,
  contributions: 50_000,
  weightedNetCashFlow: 2_000
}), 1000 / 102_000 * 100);

// Proventos são performance; não são tratados como aporte novo.
approx(modifiedDietzMonthlyReturnPercent({
  beginningMarketValue: 100_000,
  endingMarketValue: 100_000,
  dividends: 1_000
}), 1);

// Liquidação total ao fim do período preserva o resultado realizado.
approx(modifiedDietzMonthlyReturnPercent({
  beginningMarketValue: 10_000,
  endingMarketValue: 0,
  withdrawals: 11_000,
  weightedNetCashFlow: 0
}), 10);

console.log('portfolio-return-modified-dietz-v422 ok');
