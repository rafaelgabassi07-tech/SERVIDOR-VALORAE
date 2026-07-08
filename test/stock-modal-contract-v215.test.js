import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

assert.equal(_test.STOCK_MODAL_VERSION, '26.asset-modal.stock.v55');

const html = `
<html><body>
  <h1>PETR4 Petrobras</h1>
  <section>
    <div>Cotação R$ 37,92 - 0,26%</div>
    <div>VARIAÇÃO (12M) 27,09%</div>
    <div>P/L 4,54</div>
    <div>P/VP 1,10</div>
    <div>DY 7,76%</div>
  </section>
</body></html>`;

const quick = _test.extractInvestidor10StockQuickMetrics(html, 'PETR4');
assert.equal(quick.priceDisplay, 'R$ 37,92');
assert.equal(quick.price, 37.92);
assert.equal(quick.variation12mDisplay, '27,09%');
assert.equal(quick.variation12mPercent, 27.09);
assert.equal(quick.pl, 4.54);
assert.equal(quick.pvp, 1.10);
assert.equal(quick.dy, 7.76);


const fundamentalsHtml = `
<html><body>
  <h2>INDICADORES FUNDAMENTALISTAS PETR4</h2>
  <div>CONFIRA OS FUNDAMENTOS DAS AÇÕES PETR4</div>
  <div>Sem comparativos</div>
  <div>P/L 4,54</div><div>P/receita (PSR) 0,98</div><div>P/VP 1,0</div><div>Dividend Yield 7,76%</div>
  <div>Payout 38,6%</div><div>Margem Líquida 21,60%</div><div>Margem Bruta 47,36%</div><div>Margem Ebit 28,88%</div>
  <div>Margem Ebitda 46,35%</div><div>EV/Ebitda 3,65</div><div>EV/ebit 5,6</div><div>P/Ebitda 2,12</div>
  <div>P/Ebit 3,40</div><div>P/Ativo 0,39</div><div>P/Cap.Giro -10,05</div><div>P/Ativo Circ. Liq. -0,44</div>
  <div>VPA 34,4</div><div>LPA 8,35</div><div>Giro Ativos 0,40</div><div>ROE 24,17%</div>
  <div>ROIC 12,5%</div><div>ROA 8,67%</div><div>Dívida Líquida / Patrimônio 0,73</div><div>Dívida Líquida / Ebitda 1,40</div>
  <div>Dívida Líquida / Ebit 2,25</div><div>Dívida Bruta / Patrimônio 0,83</div><div>Patrimônio / Ativos 0,36</div><div>Passivos / Ativos 0,64</div>
  <div>Liquidez Corrente 0,74</div><div>CAGR Receitas 5 anos 12,83%</div><div>CAGR Lucros 5 anos 77,66%</div>
</body></html>`;
const fundamentals = _test.extractInvestidor10StockFundamentalIndicators(fundamentalsHtml, 'PETR4');
assert.equal(fundamentals.status, 'OK');
assert.equal(fundamentals.items.length, 31);
assert.equal(fundamentals.comparator.selected, 'Sem comparativos');
assert.equal(fundamentals.groups.length, 5);
assert.equal(fundamentals.items.find(item => item.id === 'psr').value, '0,98');
assert.equal(fundamentals.items.find(item => item.id === 'margem_ebit').value, '28,88%');
assert.equal(fundamentals.items.find(item => item.id === 'margem_ebitda').value, '46,35%');
assert.equal(fundamentals.items.find(item => item.id === 'divida_liquida_patrimonio').value, '0,73');
assert.equal(fundamentals.items.find(item => item.id === 'cagr_lucros_5_anos').numericValue, 77.66);

const historical = _test.buildStockHistoricalIndicators({
  '5y': {
    columns: ['Atual', '2025', '2024', '2023', '2022', '2021'],
    rows: [
      { label: 'P/L', values: { Atual: '4,54', '2025': '3,61', '2024': '12,74', '2023': '3,85', '2022': '1,68', '2021': '3,44' } },
      { label: 'P/Receita (PSR)', values: { Atual: '0,98', '2025': '0,80', '2024': '0,95', '2023': '0,94', '2022': '0,49', '2021': '0,81' } },
      { label: 'Dividend Yield', values: { Atual: '7,78%', '2025': '10,49%', '2024': '21,49%', '2023': '19,33%', '2022': '67,99%', '2021': '19,85%' } }
    ]
  },
  '10y': {
    columns: ['Atual', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016'],
    rows: [
      { label: 'P/L', values: { Atual: '4,54', '2025': '3,61', '2024': '12,74', '2023': '3,85', '2022': '1,68', '2021': '3,44', '2020': '5,00', '2019': '9,00', '2018': '7,50', '2017': '8,10', '2016': '6,80' } }
    ]
  }
}, 'PETR4');
assert.equal(historical.status, 'OK');
assert.deepEqual(historical.periods, ['5y', '10y']);
assert.equal(historical.selectedPeriod, '5y');
assert.equal(historical.columns[0], 'Atual');
assert.equal(historical.rows.length, 3);
assert.equal(historical.tablesByPeriod['10y'].rows.length, 1);
assert.equal(historical.rows[0].label, 'P/L');


const checklistHtml = `
<html><body>
  <h2>CHECKLIST DO INVESTIDOR BUY AND HOLD SOBRE PETR4</h2>
  <div class="checked">Empresa com mais de 5 anos de Bolsa</div>
  <div class="unchecked">Empresa nunca deu prejuízo (ano fiscal)</div>
  <div class="checked">Empresa com lucro nos últimos 20 trimestres (5 anos)</div>
  <div class="checked">Empresa pagou +5% de dividendos/ano nos últimos 5 anos</div>
  <div class="checked">Empresa possui ROE acima de 10%</div>
  <div class="checked">Empresa possui dívida menor que patrimônio</div>
  <div class="checked">Empresa apresentou crescimento de receita nos últimos 5 anos</div>
  <div class="checked">Empresa apresentou crescimento de lucros nos últimos 5 anos</div>
  <div class="checked">Empresa possui liquidez diária acima de US$ 2M</div>
  <div class="checked">Empresa é bem avaliada pelos usuários do Investidor10</div>
  <p>Esta ferramenta de checklist é fornecida apenas para fins informativos e não constitui recomendação de investimento.</p>
  <h2>Histórico de Dividendos - PETR4</h2>
</body></html>`;
const stockChecklist = _test.extractInvestidor10StockBuyHoldChecklist(checklistHtml, 'PETR4', { fundamentalIndicators: fundamentals, historicalIndicators: historical });
assert.equal(stockChecklist.status, 'OK');
assert.equal(stockChecklist.items.length, 10);
assert.equal(stockChecklist.items.find(item => item.id === 'never_loss_fiscal').passed, false);
assert.equal(stockChecklist.items.find(item => item.id === 'dividends_5y_above_5').passed, true);
assert.equal(stockChecklist.items.find(item => item.id === 'roe_above_10').passed, true);
assert.equal(stockChecklist.passed, 9);
assert.equal(stockChecklist.failed, 1);
assert.match(stockChecklist.disclaimer, /fins informativos/i);


const dividendsHtml = `
<html><body>
  <h2>Histórico de Dividendos - PETR4</h2>
  <h3>DY atual: 7,76%</h3>
  <h3>DY médio em 5 anos: 27,83%</h3>
  <div>ARaste o quadro para ver mais dados</div>
  <div>tipo data com pagamento valor</div>
  <div>JSCP 01/06/2026 20/08/2026 0,35048636</div>
  <div>JSCP 01/06/2026 21/09/2026 0,35048636</div>
  <div>Dividendos 22/12/2025 20/03/2026 0,29642144</div>
  <div>Rend. Trib. 22/04/2026 22/06/2026 0,02038398</div>
  <h2>COMPARADOR DE AÇÕES</h2>
</body></html>`;
const dividendEvents = _test.extractStockDividendEventsFromHtml(dividendsHtml, 'PETR4');
assert.equal(dividendEvents.length, 4);
assert.equal(dividendEvents[0].type, 'JSCP');
assert.equal(dividendEvents[0].dataCom, '2026-06-01');
assert.equal(dividendEvents[2].valueDisplay, '0,29642144');
const dividendHistory = _test.buildStockDividendHistoryPayload({
  ticker: 'PETR4',
  html: dividendsHtml,
  canonical: {
    company: {
      dividendYieldHistory: [
        { year: 2025, value: 10.49, label: '2025' },
        { year: 2024, value: 21.49, label: '2024' }
      ]
    }
  },
  quickMetrics: { price: 37.92, dy: 7.76, dyDisplay: '7,76%' },
  fundamentalIndicators: fundamentals
});
assert.equal(dividendHistory.status, 'OK');
assert.equal(dividendHistory.currentDyDisplay, '7,76%');
assert.equal(dividendHistory.averageDy5yDisplay, '27,83%');
assert.equal(dividendHistory.events.length, 4);
assert.equal(dividendHistory.yieldSeriesByFrequency.yearly.length, 2);
assert.equal(dividendHistory.dividendSeriesByFrequency.yearly.length >= 1, true);

const radar = _test.buildStockDividendRadarPayload({ ticker: 'PETR4', dividendHistory });
assert.equal(radar.status, 'OK');
assert.equal(radar.months.find(month => month.key === 'jun').activeDateCom, true);
assert.equal(radar.months.find(month => month.key === 'ago').activePayment, true);
assert.equal(radar.defaultMode, 'dateCom');

const payoutChart = _test.buildStockPayoutChartPayload({
  ticker: 'PETR4',
  canonical: { financial: { revenueProfit: [
    { year: 2024, netProfit: 36700000000 },
    { year: 2025, netProfit: 109000000000 }
  ], payoutHistory: [{ year: 2024, value: 278.99 }, { year: 2025, value: 43.02 }] } },
  historicalIndicators: {
    rows: [
      { label: 'Payout', values: { Atual: '38,46%', '2025': '43,02%', '2024': '278,99%' } },
      { label: 'Dividend Yield', values: { Atual: '7,78%', '2025': '10,49%', '2024': '21,49%' } }
    ]
  },
  dividendHistory
});
assert.equal(payoutChart.status, 'OK');
assert.equal(payoutChart.points.find(point => point.label === '2024').payoutPercent, 278.99);
assert.equal(payoutChart.points.at(-1).label, 'Últ 12M');

const revenueProfitChart = _test.buildStockRevenueProfitChartPayload({
  ticker: 'PETR4',
  canonical: { financial: { revenueProfit: [
    { year: 2024, netRevenue: 490000000000, netProfit: 36000000000 },
    { year: 2025, netRevenue: 497550000000, netProfit: 110610000000 }
  ] } }
});
assert.equal(revenueProfitChart.status, 'OK');
assert.equal(revenueProfitChart.points.length, 2);
assert.equal(revenueProfitChart.points[0].netRevenueDisplay, '490,00B');
assert.equal(revenueProfitChart.points[1].netIncomeDisplay, '110,61B');

const profitQuoteChart = _test.buildStockProfitQuoteChartPayload({
  ticker: 'PETR4',
  canonical: { financial: { profitVsQuote: [
    { year: 2022, quote: 24.5, profit: 189000000000 },
    { year: 2025, quote: 37.9, profit: 110610000000 }
  ] } }
});
assert.equal(profitQuoteChart.status, 'OK');
assert.equal(profitQuoteChart.points.length, 2);
assert.equal(profitQuoteChart.points[0].quoteDisplay, 'R$ 24,50');
assert.equal(profitQuoteChart.points[0].netIncomeDisplay, '189,00B');

const resultsStatement = _test.buildStockResultsStatementPayload({
  ticker: 'PETR4',
  canonical: { financial: { incomeStatement: [
    { year: 2025, netRevenue: 497550000000, cost: -260550000000, grossProfit: 237000000000, netProfit: 110610000000, ebitda: 230020000000, ebit: 145630000000, tax: -39990000000, grossDebt: 384030000000, netDebt: 333420000000, grossMargin: 47.63, ebitdaMargin: 46.23, netMargin: 22.13, roe: 26.49, roic: 13.21 },
    { year: 2024, netRevenue: 490830000000, cost: -244370000000, grossProfit: 246460000000, netProfit: 37010000000, ebitda: 173610000000, ebit: 137200000000, tax: -17720000000, grossDebt: 373470000000, netDebt: 326820000000, grossMargin: 50.21, ebitdaMargin: 35.37, netMargin: 7.46, roe: 10, roic: 16.16 }
  ] } }
});
assert.equal(resultsStatement.status, 'OK');
assert.equal(resultsStatement.rows.length, 14);
assert.equal(resultsStatement.rows.find(row => row.label === 'Receita Líquida - (R$)').values['2025'], '497,55B');
assert.equal(resultsStatement.rows.find(row => row.label === 'ROE - (%)').values['2024'], '10,00 %');


const balanceSheetStatement = _test.buildStockBalanceSheetStatementPayload({
  ticker: 'PETR4',
  canonical: { financial: { balanceSheet: [
    { year: 2025, totalAssets: 1220000000000, currentAssets: 140030000000, nonCurrentAssets: 607430000000, totalLiabilities: 1220000000000, currentLiabilities: 198370000000, nonCurrentLiabilities: 1080000000000, equity: 417590000000 },
    { year: 2024, totalAssets: 1120000000000, currentAssets: 135100000000, nonCurrentAssets: 989590000000, totalLiabilities: 1120000000000, currentLiabilities: 194100000000, nonCurrentLiabilities: 562480000000, equity: 367510000000 }
  ] } }
});
assert.equal(balanceSheetStatement.status, 'OK');
assert.equal(balanceSheetStatement.title, 'Balanço Patrimonial PETR4');
assert.equal(balanceSheetStatement.rows.find(row => row.label === 'ATIVO TOTAL - (R$)').values['2025'], '1.220,00B');
assert.equal(balanceSheetStatement.rows.find(row => row.label === 'Patrimônio Líquido Consolidado - (R$)').values['2024'], '367,51B');

const announcementsHtml = `
<html><body>
  <h2>COMUNICADOS DO PETR4</h2>
  <div><span>Outros Comunicados Não Considerados Fatos Relevantes - Comunicado ao Mercado</span><span>Data de Divulgação: 01/07/2026</span><a href="/acoes/link_comunicado/PETR4/12345/">Abrir</a></div>
  <div><span>Conselho de Administração - Reunião da Administração</span><span>Data de Divulgação: 30/06/2026</span><a href="https://example.com/documento.pdf">Abrir</a></div>
  <h2>Notícias sobre Petrobras</h2>
</body></html>`;
const announcements = _test.extractInvestidor10StockAnnouncements(announcementsHtml, 'PETR4');
assert.equal(announcements.status, 'OK');
assert.equal(announcements.items.length, 2);
assert.equal(announcements.items[0].dateDisplay, '01/07/2026');
assert.equal(announcements.items[0].documentKind, 'pdf');
assert.equal(announcements.items[1].pdfUrl, 'https://example.com/documento.pdf');

const equityEvolutionChart = _test.buildStockEquityEvolutionChartPayload({
  ticker: 'PETR4',
  canonical: { financial: {
    equityEvolution: [
      { year: 2024, netWorth: 370000000000, netRevenue: 490830000000, netProfit: 37010000000 },
      { year: 2025, netWorth: 410000000000, netRevenue: 497550000000, netProfit: 110610000000 }
    ]
  } }
});
assert.equal(equityEvolutionChart.status, 'OK');
assert.equal(equityEvolutionChart.kind, 'equity_evolution');
assert.equal(equityEvolutionChart.points[0].netWorthDisplay, '370,00B');
assert.equal(equityEvolutionChart.tertiarySeriesLabel, 'Lucro Líquido');



const peerHtml = `
<html><body>
  <h2>COMPARADOR DE AÇÕES</h2>
  <div>ARRASTE O QUADRO PARA VER MAIS DADOS</div>
  <div>PETR4 4,54 1,10 24,17% 7,76% R$ 518,36 B 21,60%</div>
  <div>PRIO3 17,73 1,72 9,72% 0,00% R$ 45,91 B 14,65%</div>
  <div>VBBR3 11,89 1,64 13,8% 5,23% R$ 35,7 B 1,56%</div>
  <h2>COMPARAÇÃO DE PETR4 COM ÍNDICES</h2>
</body></html>`;
const stockPeers = _test.extractInvestidor10StockPeerComparison(peerHtml, 'PETR4', quick, fundamentals);
assert.equal(stockPeers.status, 'OK');
assert.equal(stockPeers.rows.length, 3);
assert.equal(stockPeers.rows[0].ticker, 'PETR4');
assert.equal(stockPeers.rows[0].isReference, true);
assert.equal(stockPeers.columns.length, 6);
assert.equal(stockPeers.rows[2].dividendYieldDisplay, '5,23%');

const noisyPeerHtml = `
<html><body>
  <nav>Ferramentas Comparador de Ações Comparador de FIIs Notícias Ranking</nav>
  <h2>INDICADORES FUNDAMENTALISTAS VALE3</h2>
  <div>P/L 7,22 P/VP 1,30</div>
  <h2>COMPARADOR DE AÇÕES</h2>
  <div>ARRASTE O QUADRO PARA VER MAIS DADOS P/L P/VP ROE DY Valor de Mercado Margem Líquida</div>
  <div>VALE3 7,22 1,30 18,90% 7,00% R$ 392,00 B 21,00%</div>
  <div>GGBR4 8,10 0,80 12,00% 6,00% R$ 15,00 B 9,00%</div>
  <div>CSNA3 5,70 0,62 10,50% 3,10% R$ 8,50 B 6,20%</div>
  <h2>COMPARAÇÃO DE VALE3 COM ÍNDICES</h2>
</body></html>`;
const noisyPeers = _test.extractInvestidor10StockPeerComparison(noisyPeerHtml, 'VALE3', {}, fundamentals);
assert.equal(noisyPeers.status, 'OK');
assert.equal(noisyPeers.rows.length, 3);
assert.equal(noisyPeers.rows[0].ticker, 'VALE3');
assert.equal(noisyPeers.rows[0].isReference, true);
assert.equal(noisyPeers.rows[1].ticker, 'GGBR4');
assert.equal(noisyPeers.diagnostics.policy, 'no_static_substitution');



const rows = _test.returnsRowsFromInvestidor10Profitability({
  profitability: {
    periods: ['1 mês', '3 meses', '1 ano', '2 anos', '5 anos', '10 anos'],
    nominal: [
      { period: '1 mês', valuePercent: -8.58, raw: '-8,58%' },
      { period: '3 meses', valuePercent: -19.26, raw: '-19,26%' },
      { period: '1 ano', valuePercent: 27.09, raw: '27,09%' }
    ],
    real: [
      { period: '1 mês', valuePercent: -8.58, raw: '-8,58%' },
      { period: '3 meses', valuePercent: -19.73, raw: '-19,73%' },
      { period: '1 ano', valuePercent: 21.96, raw: '21,96%' }
    ]
  }
});
assert.equal(rows.length, 3);
assert.equal(rows[0].key, '1_mes');
assert.equal(rows[2].label, '1 ano');
assert.equal(rows[2].returnDisplay, '27,09%');
assert.equal(rows[2].realReturnDisplay, '21,96%');

const summary = _test.chartSummary([
  { close: 10 },
  { close: 12 },
  { close: 11 }
]);
assert.equal(summary.points, 3);
assert.equal(summary.variationPercent, 10);


const notStock = await import('../lib/analysis/stock-modal-contract.js').then(mod => mod.buildStockModalContract({ ticker: 'BOVA11', timeoutMs: 3500 }));
assert.equal(notStock.status, 'NOT_STOCK');
assert.equal(notStock.assetType, 'ETF');

console.log('stock-modal-contract-v215 ok');


const aboutHtml = `
<html><body>
  <section>
    <h2>SOBRE A EMPRESA PETROLEO BRASILEIRO S.A. PETROBRAS</h2>
    <p>A Petróleo Brasileiro S.A. ou Petrobras é uma empresa petrolífera brasileira que atua no setor e subsetor de petróleo gás e biocombustíveis.</p>
    <p>Uma das maiores empresas do mundo de petróleo, gás natural e derivados, a Petrobras é responsável pela exploração, produção, refino e comercialização de petróleo e derivados.</p>
    <h3>História e quando foi criada a Petrobras</h3>
    <p>A Petrobras foi fundada em 1953, no Rio de Janeiro, sob o governo de Getúlio Vargas.</p>
    <h3>Informações Adicionais</h3>
    <p>A empresa Petrobras está listada na B3 com um valor de mercado de R$ 518,36 Bilhões.</p>
  </section>
</body></html>`;
const profile = _test.extractStockCompanyProfile(aboutHtml, 'PETR4', 'Petrobras');
assert.equal(profile.status, 'OK');
assert.equal(profile.sections.length >= 2, true);
assert.equal(profile.sections[0].title, 'Sobre a empresa');

const revenueHtml = `
<html><body>
  <h2>REGIÕES ONDE PETROBRAS GERA RECEITA</h2>
  <div>2025 Brasil R$ 89,95 Bilhões 71% China R$ 13,67 Bilhões 11% Ásia R$ 6,19 Bilhões 5% Europa R$ 5,25 Bilhões 4% Américas R$ 5,13 Bilhões 4% Total (trimestral) R$ 127,37 Bilhões</div>
  <h2>NEGÓCIOS QUE GERAM RECEITA PARA PETROBRAS</h2>
  <div>2025 Diesel R$ 38,36 Bilhões 30% Petróleo R$ 34,52 Bilhões 27% Gasolina R$ 17,62 Bilhões 14% Óleo combustível R$ 7,36 Bilhões 6% Querosene de aviação (QAV) R$ 6,32 Bilhões 5% Total (trimestral) R$ 127,37 Bilhões</div>
</body></html>`;
const regionBreakdown = _test.buildStockRevenueBreakdownPayload({ html: revenueHtml, ticker: 'PETR4', name: 'Petrobras' }, 'region');
assert.equal(regionBreakdown.status, 'OK');
assert.equal(regionBreakdown.items[0].label, 'Brasil');
assert.equal(regionBreakdown.items[0].percent, 71);
assert.equal(regionBreakdown.totalAmountDisplay, 'R$ 127,37 Bilhões');
const businessBreakdown = _test.buildStockRevenueBreakdownPayload({ html: revenueHtml, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(businessBreakdown.status, 'OK');
assert.equal(businessBreakdown.items[0].label, 'Diesel');
assert.equal(businessBreakdown.items[0].percentDisplay, '30%');


const shareholdingHtml = `
<html><body>
  <h2>POSIÇÃO ACIONÁRIA DA PETR4</h2>
  <div>Acionista % ON % PN % Total</div>
  <div>OUTROS 40.77 67.21 52.03</div>
  <div>UNIÃO FEDERAL 50.26 0.00 29.02</div>
  <div>BNDES PARTICIPAÇÕES - BNDESPAR 0.00 16.53 6.98</div>
  <div>GQG PARTNERS LLC 5.03 6.38 5.60</div>
  <div>BLACKROCK INC 3.94 7.20 5.32</div>
  <div>BANCO NACIONAL DE DESENVOLVIMENTO ECONÔMICO E SOCIAL - BNDES 0.00 2.48 1.05</div>
  <h2>Receitas e Lucros</h2>
</body></html>`;
const shareholding = _test.buildStockShareholdingPayload({ html: shareholdingHtml, ticker: 'PETR4' });
assert.equal(shareholding.status, 'OK');
assert.equal(shareholding.rows.length, 6);
assert.equal(shareholding.columns.length, 4);
assert.equal(shareholding.rows[1].shareholder, 'UNIÃO FEDERAL');
assert.equal(shareholding.rows[1].onPercent, 50.26);
assert.equal(shareholding.rows[1].pnPercentDisplay, '0,00%');
assert.equal(shareholding.rows[4].totalPercentDisplay, '5,32%');

const shareholdingFallback = _test.buildStockShareholdingPayload({ ticker: 'PETR4' });
assert.equal(shareholdingFallback.status, 'EMPTY');
assert.equal(shareholdingFallback.rows.length, 0);


const wrongTickerHtml = `<html><body><h1>PETR4 Petrobras</h1><div>PETR4 Cotação R$ 37,92 -0,26%</div></body></html>`;
const wrongQuick = _test.extractInvestidor10StockQuickMetrics(wrongTickerHtml, 'VALE3');
assert.equal(wrongQuick.priceDisplay || '', '');

const peerFallback = _test.extractInvestidor10StockPeerComparison('', 'BBAS3', { pl: 8.2, plDisplay: '8,20', pvp: 0.9, pvpDisplay: '0,90', dy: 7.1, dyDisplay: '7,10%' }, fundamentals);
assert.equal(peerFallback.status, 'EMPTY');
assert.equal(peerFallback.rows.length, 0);

const revenueApiPayload = _test.buildStockRevenueBreakdownPayload({
  ticker: 'TEST3',
  name: 'Teste',
  canonical: { revenueBreakdowns: { region: { totalAmountDisplay: 'R$ 10,00 Bilhões', data: [{ name: 'Brasil', y: 71, valorDisplay: 'R$ 7,10 Bilhões' }, { name: 'China', y: 11, valorDisplay: 'R$ 1,10 Bilhão' }] } } }
}, 'region');
assert.equal(revenueApiPayload.status, 'OK');
assert.equal(revenueApiPayload.items[0].label, 'Brasil');
assert.equal(revenueApiPayload.totalAmountDisplay, 'R$ 10,00 Bilhões');

const valeRevenueHtml = `
<html><body>
  <h2>REGIÕES ONDE VALE GERA RECEITA</h2>
  <div>2025 Brasil R$ 20,00 Bilhões 55% China R$ 10,00 Bilhões 28% Europa R$ 3,50 Bilhões 10% Total (trimestral) R$ 36,00 Bilhões</div>
  <h2>NEGÓCIOS QUE GERAM RECEITA PARA VALE</h2>
  <div>2025 Minério de ferro R$ 25,00 Bilhões 70% Níquel R$ 5,00 Bilhões 14% Cobre R$ 4,00 Bilhões 11% Total (trimestral) R$ 36,00 Bilhões</div>
</body></html>`;
const valeRegionBreakdown = _test.buildStockRevenueBreakdownPayload({ html: valeRevenueHtml, ticker: 'VALE3', name: 'Vale' }, 'region');
assert.equal(valeRegionBreakdown.status, 'OK');
assert.equal(valeRegionBreakdown.items[0].label, 'Brasil');
assert.equal(valeRegionBreakdown.items[0].percent, 55);
const valeBusinessBreakdown = _test.buildStockRevenueBreakdownPayload({ html: valeRevenueHtml, ticker: 'VALE3', name: 'Vale' }, 'business');
assert.equal(valeBusinessBreakdown.status, 'OK');
assert.equal(valeBusinessBreakdown.items[0].label, 'Minério de ferro');
assert.equal(valeBusinessBreakdown.items[0].percent, 70);


const embeddedRevenuePayload = _test.buildStockRevenueBreakdownPayload({
  ticker: 'TEST3',
  name: 'Teste',
  canonical: { embedded: { revenueGeography: { labels: ['Brasil', 'China'], series: [71, 11], totalAmountDisplay: 'R$ 20,00 Bilhões' } } }
}, 'region');
assert.equal(embeddedRevenuePayload.status, 'OK');
assert.equal(embeddedRevenuePayload.items[0].label, 'Brasil');
assert.equal(embeddedRevenuePayload.items[0].percent, 71);
assert.equal(embeddedRevenuePayload.totalAmountDisplay, 'R$ 20,00 Bilhões');

const embeddedBusinessPayload = _test.buildStockRevenueBreakdownPayload({
  ticker: 'TEST3',
  name: 'Teste',
  canonical: { embedded: { revenueSegment: { xAxis: { categories: ['Minério', 'Níquel'] }, series: [{ data: [70, 14] }] } } }
}, 'business');
assert.equal(embeddedBusinessPayload.status, 'OK');
assert.equal(embeddedBusinessPayload.items[0].label, 'Minério');
assert.equal(embeddedBusinessPayload.items[0].percent, 70);

const shareholdingHtmlApi = `<section><h2>Posição acionária da TEST3</h2><table><tr><th>Acionista</th><th>% ON</th><th>% PN</th><th>% Total</th></tr><tr><td>OUTROS</td><td>40.77</td><td>67.21</td><td>52.03</td></tr><tr><td>UNIÃO FEDERAL</td><td>50.26</td><td>0.00</td><td>29.02</td></tr></table></section>`;
const shareholdingApi = _test.buildStockShareholdingPayload({ html: shareholdingHtmlApi, ticker: 'TEST3' });
assert.equal(shareholdingApi.status, 'OK');
assert.equal(shareholdingApi.rows.length, 2);
assert.equal(shareholdingApi.rows[1].shareholder, 'UNIÃO FEDERAL');

const valeHistorical = _test.buildStockHistoricalIndicators({
  '5y': {
    columns: ['Atual', '2025', '2024'],
    rows: [
      { label: 'P/L', values: { Atual: '7,22', '2025': '8,10', '2024': '6,90' } },
      { label: 'P/VP', values: { Atual: '1,30', '2025': '1,42', '2024': '1,20' } },
      { label: 'Dividend Yield', values: { Atual: '7,00%', '2025': '6,20%', '2024': '8,10%' } }
    ]
  }
}, 'VALE3');
assert.equal(valeHistorical.status, 'OK');
assert.equal(valeHistorical.rows[0].label, 'P/L');
assert.equal(valeHistorical.rows[2].values['2024'], '8,10%');

const valeShareholdingHtml = `
<html><body>
  <h2>POSIÇÃO ACIONÁRIA DA VALE3</h2>
  <div>Acionista % ON % PN % Total</div>
  <div>OUTROS 61.10 0.00 61.10</div>
  <div>BLACKROCK INC 6.22 0.00 6.22</div>
  <h2>Receitas e Lucros</h2>
</body></html>`;
const valeShareholding = _test.buildStockShareholdingPayload({ html: valeShareholdingHtml, ticker: 'VALE3' });
assert.equal(valeShareholding.status, 'OK');
assert.equal(valeShareholding.rows.length, 2);
assert.equal(valeShareholding.rows[1].shareholder, 'BLACKROCK INC');
assert.equal(valeShareholding.rows[1].onPercentDisplay, '6,22%');
