import assert from 'node:assert/strict';
import { _test, getInvestidor10AnalysisRankingCatalog } from '../lib/market/analysis-rankings-i10.js';

function stockHtml(headers, rows, title = 'Ranking de Ações com Maiores Valor de Mercado') {
  return `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<td>${i===0?`<a href="/acoes/${String(v).toLowerCase()}/">${v}</a>`:v}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}
function fiiHtml(headers, rows, title) {
  return `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<td>${i===0?`<a href="/fiis/${String(v).toLowerCase()}/">${v}</a>`:v}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}

{
  const html = stockHtml(
    ['Ativos','Valor de Mercado','P/VP','Dividend Yield','Margem Líquida','Preço Atual','Variação 12m'],
    [['PETR4','500,20 B','1,22','9,31%','12,40%','R$ 40,87','18,20%'],['ITUB4','390,10 B','2,01','8,90%','25,10%','R$ 40,75','22,00%']],
  );
  const parsed = _test.parseSemanticRankingHtml(html, 'STOCK_MARKET_CAP', 40);
  assert.equal(parsed.identityOk, true);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].ticker, 'PETR4');
  assert.equal(parsed.items[0].marketCap, 500.2e9);
  assert.equal(parsed.items[0].primaryMetricDisplay, '500,20 B');
  assert.equal(parsed.items[0].dividendYield, 9.31);
}

// Mudança de ordem das colunas não pode quebrar o contrato.
{
  const html = stockHtml(
    ['Ativos','Dividend Yield','Preço Atual','Valor de Mercado','P/VP','Variação 12m','Margem Líquida'],
    [['PETR4','9,31%','R$ 40,87','500,20 B','1,22','18,20%','12,40%'],['ITUB4','8,90%','R$ 40,75','390,10 B','2,01','22,00%','25,10%']],
  );
  const parsed = _test.parseSemanticRankingHtml(html, 'STOCK_MARKET_CAP', 40);
  assert.equal(parsed.items[0].marketCap, 500.2e9);
  assert.equal(parsed.items[0].price, 40.87);
  assert.equal(parsed.items[0].pvp, 1.22);
}

{
  const html = stockHtml(
    ['Ativos','Margem Líquida','P/L','P/VP','Dividend Yield','Valor de Mercado','ROE'],
    [['ITSA4','203,02%','8,73','1,64','9,84%','148,86 B','18,83%'],['EQPA3','153,38%','0,61','2,10','8,39%','11,73 B','345,77%']],
    'Ranking de Ações com Maiores Margens Líquidas',
  );
  const parsed = _test.parseSemanticRankingHtml(html, 'STOCK_NET_MARGIN', 40);
  assert.equal(parsed.items[0].primaryMetricValue, 203.02);
  assert.equal(parsed.items[0].marketCap, 148.86e9);
}

{
  const html = fiiHtml(
    ['Ativos','P/VP','Patrimônio Líquido','Dividend Yield','Liquidez Diária','Variação 12m','Segmento'],
    [['CACR11','0,15','478,17 M','71,43%','624,47 K','-80,95%','Híbrido'],['HCTR11','0,16','2,22 B','21,26%','616,27 K','-18,27%','Papel']],
    'Ranking de FIIs de Menores P/VP',
  );
  const parsed = _test.parseSemanticRankingHtml(html, 'FII_PVP_LOW', 40);
  assert.equal(parsed.items[0].pvp, 0.15);
  assert.equal(parsed.items[0].netWorth, 478.17e6);
  assert.equal(parsed.items[0].dailyLiquidity, 624.47e3);
  assert.equal(parsed.items[0].variation12m, -80.95);
}

{
  const html = fiiHtml(
    ['Ativos','Patrimônio Líquido','P/VP','Dividend Yield','Liquidez Diária','Variação 12m','Segmento'],
    [['KNCR11','10,97 B','1,04','13,45%','20,47 M','18,83%','Títulos e Valores Mobiliários'],['HGLG11','7,60 B','0,88','9,03%','14,58 M','5,11%','Logístico']],
    'Ranking de FIIs Mais Buscados',
  );
  const parsed = _test.parseSemanticRankingHtml(html, 'FII_MOST_SEARCHED', 40);
  assert.equal(parsed.items[0].ticker, 'KNCR11');
  assert.equal(parsed.items[0].primaryMetricDisplay, '#1');
  assert.equal(parsed.items[1].primaryMetricDisplay, '#2');
}

{
  assert.equal(_test.parsePtNumber('10,97 B'), 10.97e9);
  assert.equal(_test.parsePtNumber('624,47 K'), 624.47e3);
  assert.equal(_test.parsePtNumber('-80,95%'), -80.95);
  assert.equal(_test.parsePtNumber('R$ 13,22'), 13.22);
}

{
  const catalog = getInvestidor10AnalysisRankingCatalog();
  assert.equal(catalog.items.length, 10);
  assert.ok(catalog.items.some(item => item.id === 'FII_12M_GAIN'));
  assert.ok(catalog.items.some(item => item.id === 'STOCK_NET_MARGIN'));
}


{
  const html = fiiHtml(
    ['Ativos','Patrimônio Líquido','P/VP','Dividend Yield','Liquidez Diária'],
    [['KNIP11','7,10 B','1,01','11,02%','4,50 M'],['KNCR11','10,97 B','1,04','13,45%','20,47 M'],['HGLG11','7,60 B','0,88','9,03%','14,58 M']],
    'Ranking de FIIs de Maiores Valor Patrimonial',
  );
  const parsed = _test.parseSemanticRankingHtml(html, 'FII_NET_WORTH', 40);
  assert.equal(parsed.identityOk, true);
  assert.equal(parsed.items[0].netWorth, 7.10e9);
}

{
  const html = fiiHtml(
    ['Ativos','Liquidez Diária','Patrimônio Líquido','P/VP','Dividend Yield'],
    [['MXRF11','35,20 M','4,10 B','1,00','12,10%'],['KNCR11','20,47 M','10,97 B','1,04','13,45%'],['HGLG11','14,58 M','7,60 B','0,88','9,03%']],
    'Ranking de FIIs de Maiores Liquidez',
  );
  const parsed = _test.parseSemanticRankingHtml(html, 'FII_LIQUIDITY', 40);
  assert.equal(parsed.identityOk, true);
  assert.equal(parsed.items[0].dailyLiquidity, 35.20e6);
}

console.log('analysis-rankings-i10-v629: ok');
