import assert from 'node:assert/strict';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';

function yahooResponse(timestamps, closes, regularMarketPrice = closes.at(-1)) {
  return new Response(JSON.stringify({
    chart: {
      result: [{
        meta: {
          currency: 'BRL',
          timezone: 'America/Sao_Paulo',
          regularMarketPrice,
          chartPreviousClose: closes.at(-2) || closes.at(-1)
        },
        timestamp: timestamps,
        indicators: {
          quote: [{
            close: closes,
            open: closes,
            high: closes,
            low: closes,
            volume: closes.map(() => 1000)
          }]
        }
      }],
      error: null
    }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

// O ponto recebido do APK representa a posição/cotação atual e não pode ser removido
// pelo saneamento de borda, mesmo quando a fonte remota ficou muito distante.
{
  const now = Math.floor(Date.now() / 1000);
  const timestamps = [now - 7200, now - 6300, now - 5400, now - 4500];
  globalThis.fetch = async () => yahooResponse(timestamps, [100, 101, 102, 103], 103);

  const result = await buildPortfolioHistory([
    { ticker: 'LIVE3', quantity: 1, averagePrice: 90, currentPrice: 400 }
  ], { range: '1d', interval: '5m', timeoutMs: 1000, maxConcurrency: 1 });

  assert.equal(result.ok, true);
  assert.equal(result.series.at(-1).source, 'currentPrice');
  assert.equal(result.series.at(-1).totalValue, 400);
  assert.equal(result.summary.lastValue, 400);
  assert.ok(result.remotePointCount >= 3);
}

// Uma importação parcial de transações não significa que a carteira nasceu na primeira
// linha importada. O estoque inicial deve ser inferido da posição atual e preservado.
{
  const day = 24 * 60 * 60;
  const todayUtc = Math.floor(Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z') / 1000);
  const timestamps = [todayUtc - 10 * day, todayUtc - 8 * day, todayUtc - 6 * day];
  globalThis.fetch = async () => yahooResponse(timestamps, [100, 110, 115], 115);

  const result = await buildPortfolioHistory([
    { ticker: 'OPEN3', quantity: 10, averagePrice: 100, currentPrice: 120, firstPurchaseAt: 0 }
  ], {
    range: '1mo',
    interval: '1d',
    timeoutMs: 1000,
    maxConcurrency: 1,
    transactions: [{
      ticker: 'OPEN3',
      timestamp: timestamps[1],
      operation: 'COMPRA',
      quantity: 5,
      price: 100,
      grossValue: 500
    }]
  });

  assert.equal(result.ok, true);
  assert.ok(result.reconciledTransactionTickers.includes('OPEN3'));
  assert.equal(result.series[0].totalValue, 500, '5 cotas anteriores ao histórico importado devem existir no primeiro ponto');
  assert.equal(result.series[0].positions.OPEN3, 500);
  const purchaseDate = new Date(timestamps[1] * 1000).toISOString().slice(0, 10);
  const purchaseRow = result.series.find(row => String(row.date).slice(0, 10) === purchaseDate);
  assert.ok(purchaseRow, 'deve manter o ponto da compra conhecida');
  assert.equal(purchaseRow.totalValue, 1100, 'após a compra conhecida a quantidade deve chegar às 10 cotas atuais');
  assert.equal(purchaseRow.transactionReconciled, true);
  assert.equal(result.summary.lastValue, 1200);
  assert.equal(result.historyCoveragePercent, 100);
}

// O mesmo raciocínio precisa funcionar quando o arquivo parcial contém apenas uma venda.
{
  const day = 24 * 60 * 60;
  const todayUtc = Math.floor(Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z') / 1000);
  const timestamps = [todayUtc - 12 * day, todayUtc - 9 * day, todayUtc - 5 * day];
  globalThis.fetch = async () => yahooResponse(timestamps, [50, 55, 58], 58);

  const result = await buildPortfolioHistory([
    { ticker: 'SALE3', quantity: 8, averagePrice: 50, currentPrice: 60, firstPurchaseAt: 0 }
  ], {
    range: '1mo',
    interval: '1d',
    timeoutMs: 1000,
    maxConcurrency: 1,
    transactions: [{
      ticker: 'SALE3',
      timestamp: timestamps[1],
      operation: 'SAÍDA',
      quantity: 2,
      price: 55,
      grossValue: 110
    }]
  });

  assert.ok(result.reconciledTransactionTickers.includes('SALE3'));
  assert.equal(result.series[0].totalValue, 500, 'antes da venda devem existir 10 cotas reconciliadas');
  const saleDate = new Date(timestamps[1] * 1000).toISOString().slice(0, 10);
  const saleRow = result.series.find(row => String(row.date).slice(0, 10) === saleDate);
  assert.ok(saleRow);
  assert.equal(saleRow.totalValue, 440, 'a saída conhecida deve reduzir a posição para as 8 cotas atuais');
  assert.equal(result.summary.lastValue, 480);
}

console.log('portfolio-price-chart-integrity-v316 ok');
