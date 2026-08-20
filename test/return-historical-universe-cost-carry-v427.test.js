import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveHistoricalPortfolioValuation, reconcileReturnOpeningTransactions } from '../lib/portfolio/return-valuation.js';
import { modifiedDietzMonthlyReturnPercent, weightedPortfolioCashFlows } from '../lib/portfolio/return-calculation.js';
import { filterPayloadByAssetClass } from '../lib/portfolio/mobile-history-contracts.js';
import { portfolioInceptionDate, normalizeTransactions } from '../lib/portfolio/positions.js';

const monthStart = Date.UTC(2024, 0, 1);
const monthEnd = Date.UTC(2024, 0, 31, 23, 59, 59, 999);
const bucket = { quantity: 10, costBasis: 250 };

const market = resolveHistoricalPortfolioValuation([
  { millis: Date.UTC(2024, 0, 30), close: 31.5 }
], monthStart, monthEnd, bucket, true);
assert.equal(market.close, 31.5);
assert.equal(market.partial, false);
assert.equal(market.mode, 'MARKET_CLOSE');

const strictMissing = resolveHistoricalPortfolioValuation([], monthStart, monthEnd, bucket, false);
assert.equal(strictMissing.close, 0, 'fora do Retorno, ausência de cotação continua sem valuation artificial');

const staleReal = resolveHistoricalPortfolioValuation([
  { millis: Date.UTC(2023, 11, 28), close: 24.25 }
], monthStart, monthEnd, bucket, true);
assert.equal(staleReal.close, 24.25, 'lacuna mensal deve preservar o último fechamento real anterior');
assert.equal(staleReal.partial, true);
assert.equal(staleReal.mode, 'LAST_REAL_CLOSE_CARRY');

const carried = resolveHistoricalPortfolioValuation([], monthStart, monthEnd, bucket, true);
assert.equal(carried.close, 25, 'Retorno preserva somente a componente sem cotação pelo custo contábil');
assert.equal(carried.partial, true);
assert.equal(carried.mode, 'COST_BASIS_CARRY');


const flowStart = Date.UTC(2024, 5, 1);
const flowEnd = Date.UTC(2024, 5, 30, 23, 59, 59, 999);
const liquidation = weightedPortfolioCashFlows([
  { millis: Date.UTC(2024, 5, 5), quantity: -10, price: 14 }
], flowStart, flowEnd, { beginningHasCapital: true, endingHasCapital: false });
assert.equal(liquidation.withdrawals, 140);
assert.equal(liquidation.weightedNetCashFlow, 0, 'venda que encerra a carteira ocorre no fim do período efetivo, sem colapsar o denominador');
const liquidationReturn = modifiedDietzMonthlyReturnPercent({
  beginningMarketValue: 120,
  endingMarketValue: 0,
  withdrawals: liquidation.withdrawals,
  weightedNetCashFlow: liquidation.weightedNetCashFlow
});
assert.ok(Math.abs(liquidationReturn - 16.6666667) < 0.001, 'liquidação total mede ganho realizado, não centenas de por cento artificiais');

const reentry = weightedPortfolioCashFlows([
  { millis: Date.UTC(2025, 3, 10), quantity: 5, price: 20 }
], Date.UTC(2025, 3, 1), Date.UTC(2025, 3, 30, 23, 59, 59, 999), { beginningHasCapital: false, endingHasCapital: true });
assert.equal(reentry.contributions, 100);
assert.equal(reentry.weightedNetCashFlow, 100, 'primeira compra/reentrada usa peso integral a partir do início real da exposição');
const reentryReturn = modifiedDietzMonthlyReturnPercent({
  beginningMarketValue: 0,
  endingMarketValue: 118,
  contributions: reentry.contributions,
  weightedNetCashFlow: reentry.weightedNetCashFlow
});
assert.ok(Math.abs(reentryReturn - 18) < 0.001, 'reentrada mede retorno desde a compra, sem extrapolar para o mês civil inteiro');

const openingLedger = reconcileReturnOpeningTransactions(
  [{ ticker: 'OPEN3', quantity: 10, avgPrice: 100, firstPurchaseDate: '2024-01-05' }],
  [{ ticker: 'OPEN3', quantity: 5, price: 110, date: '2024-02-10', millis: Date.UTC(2024, 1, 10), isSell: false }]
);
assert.equal(openingLedger.reconciliations.length, 1, 'ledger parcial precisa ganhar somente o estoque de abertura faltante');
assert.equal(openingLedger.reconciliations[0].quantity, 5);
assert.equal(openingLedger.reconciliations[0].price, 100);
assert.equal(openingLedger.reconciliations[0].date, '2024-01-05');
assert.equal(openingLedger.transactions.reduce((sum, tx) => sum + Number(tx.quantity || 0), 0), 10, 'ledger reconciliado precisa terminar na quantidade atual');

const completeLedger = reconcileReturnOpeningTransactions(
  [{ ticker: 'FULL3', quantity: 10, avgPrice: 100, firstPurchaseDate: '2024-01-05' }],
  [{ ticker: 'FULL3', quantity: 10, price: 100, date: '2024-01-05', millis: Date.UTC(2024, 0, 5), isSell: false }]
);
assert.equal(completeLedger.reconciliations.length, 0, 'ledger completo não pode receber compra artificial');

const positions = [{ ticker: 'NEW3', quantity: 5, firstPurchaseDate: '2025-04-10', assetClass: 'ACAO' }];
const transactions = [
  { ticker: 'OLD3', quantity: 10, price: 10, date: '2022-02-03', side: 'BUY', assetClass: 'ACAO' },
  { ticker: 'OLD3', quantity: 10, price: 14, date: '2024-06-05', side: 'SELL', assetClass: 'ACAO' },
  { ticker: 'NEW3', quantity: 5, price: 20, date: '2025-04-10', side: 'BUY', assetClass: 'ACAO' }
];
assert.equal(portfolioInceptionDate(positions, transactions), '2022-02-03', 'início deve vir do primeiro ativo histórico, mesmo já vendido');
const all = filterPayloadByAssetClass({ positions, transactions }, 'ALL');
assert.equal(all.transactions.length, 3, 'Todos deve preservar operações de ativos encerrados');
const stocks = filterPayloadByAssetClass({ positions, transactions }, 'ACOES');
assert.equal(stocks.transactions.length, 3, 'filtro Ações deve preservar ações históricas vendidas');
assert.deepEqual([...new Set(normalizeTransactions(stocks.transactions).map(t => t.ticker))].sort(), ['NEW3', 'OLD3']);

const source = fs.readFileSync(new URL('../lib/portfolio/analysis.js', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../lib/portfolio/return-engine-v5.js', import.meta.url), 'utf8');
assert.match(source, /transactions\.map\(t => t\.ticker\)/, 'universo de preço deve vir do ledger histórico, não só das posições atuais');
assert.match(source, /allowHistoricalCostBasisCarry: false/, 'Retorno v5 deve desativar cost carry contábil para não fabricar rentabilidade sem cotação real');
assert.match(source, /partialValuationMonths/, 'meses parciais precisam ser diagnosticáveis');
assert.match(source, /closedHistoricalTickers/, 'contrato precisa diagnosticar ativos históricos encerrados');
assert.match(source, /portfolioStartDate/, 'Retorno deve declarar a data real de início da carteira');
assert.match(engine, /modifiedDietzMonthlyReturnPercent/, 'primeiro mês participa da rentabilidade desde a primeira compra no motor v5');
assert.match(engine, /capitalExposed === false/, 'mês sem capital não pode ser emitido como retorno');
assert.match(source, /weightedPortfolioCashFlows/, 'Retorno usa janela efetiva de exposição em aporte, reentrada e liquidação');
assert.match(source, /cdiRequested && \(cdi\.status !== 'OK' \|\| !cdiUsableInChart\)/, 'CDI não solicitado não pode marcar o Retorno como parcial');
assert.match(source, /ipcaRequested && ipca\.status !== 'OK'/, 'IPCA não solicitado não pode marcar o Retorno como parcial');

console.log('return historical universe + cost carry v427 OK');
