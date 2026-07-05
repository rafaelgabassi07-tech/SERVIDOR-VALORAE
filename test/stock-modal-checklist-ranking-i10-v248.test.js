import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const rankingText = `
Ranking de Ações Buy and Hold
Ativos Pontuação Buy And Hold P/L P/VP Dividend Yield DY Médio 5 anos Variação 5 Anos Variação 30d Variação 12m Preço Atual Preço-teto de Bazin Upside Bazin Preço Justo de Graham Upside Graham ROE Margem Líquida Valor de Mercado Patrimônio Líquido Lucro Receita Cresc. Receita 5 anos Cresc. Lucro 5 anos Caixas Dívida Bruta / Patrimônio Setor Subsetor Segmento
#1 CMIG4 Cemig 100 6,52 1,09 11,59% 12,31% 165,42% 1,57% 6,55% R$ 11,03 R$ 25,46 130,83% R$ 19,59 77,58% 16,75% 11,15% 36,00 B 28,89 B 4,84 B 43,37 B 11,13% 11,33% 1,79 B 0,68 Utilidade Pública Energia Elétrica Energia Elétrica
#2 LOGG3 Log 100 6,18 0,66 24,57% 8,10% 33,55% -5,03% 62,49% R$ 28,30 R$ 37,96 34,14% R$ 66,25 134,09% 10,75% 155,03% 2,49 B 3,74 B 411,15 M 259,51 M 11,94% 20,58% 50,44 M 0,59 Financeiro Exploração de Imóveis Exploração de Imóveis
`;

const ranking = _test.parseStockBuyHoldRankingRowFromPlain(rankingText, 'CMIG4');
assert.equal(ranking.score, 100);
assert.equal(ranking.dyAverage5y, 12.31);
assert.equal(ranking.roe, 16.75);
assert.equal(ranking.cagrRevenue5y, 11.13);
assert.equal(ranking.cagrProfit5y, 11.33);
assert.equal(ranking.grossDebtEquity, 0.68);

const checklistHtml = `
<section>
  <h2>Checklist do investidor buy and hold sobre CMIG4</h2>
  <div>Empresa com mais de 5 anos de Bolsa</div>
  <div>Empresa nunca deu prejuízo (ano fiscal)</div>
  <div>Empresa com lucro nos últimos 20 trimestres (5 anos)</div>
  <div>Empresa pagou +5% de dividendos/ano nos últimos 5 anos</div>
  <div>Empresa possui ROE acima de 10%</div>
  <div>Empresa possui dívida menor que patrimônio</div>
  <div>Empresa apresentou crescimento de receita nos últimos 5 anos</div>
  <div>Empresa apresentou crescimento de lucros nos últimos 5 anos</div>
  <div>Empresa possui liquidez diária acima de US$ 2M</div>
  <div>Empresa é bem avaliada pelos usuários do Investidor10</div>
  <p>Esta ferramenta de checklist é fornecida apenas para fins informativos e não constitui recomendação de investimento.</p>
</section>
`;
const checklist = _test.extractInvestidor10StockBuyHoldChecklist(checklistHtml, 'CMIG4', { buyHoldRanking: { ...ranking, status: 'OK' } });
assert.equal(checklist.total, 10);
assert.equal(checklist.passed, 10);
assert.equal(checklist.unknown, 0);
assert.ok(checklist.items.every(item => item.passed === true));
assert.equal(checklist.diagnostics.rankingScore, 100);

const companyFactsHtml = `
DADOS SOBRE A EMPRESA
Ano de estreia na bolsa: 1971
Liquidez Média Diária R$ 157,62 Milhões R$ 157.619.000
`;
const facts = _test.extractStockChecklistCompanyFacts(companyFactsHtml);
assert.equal(facts.debutYear, 1971);
assert.equal(facts.dailyLiquidity, 157619000);

const partial = _test.deriveStockChecklistStatusFromInvestidor10({
  criterionId: 'roe_above_10',
  fundamentalIndicators: { items: [{ id: 'roe', value: '16,75%', numericValue: 16.75 }] }
});
assert.equal(partial.passed, true);
assert.equal(partial.source, 'Investidor10 indicadores fundamentalistas');

console.log('stock-modal-checklist-ranking-i10-v248 ok');
