import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function between(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0 && end > start, `Unable to extract ${startNeedle}`);
  return source.slice(start, end);
}
const strip = value => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim();
const normalize = value => strip(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const decode = value => String(value ?? '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const parseBrNumber = value => {
  const text = String(value ?? '').replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  if (!text || !/[0-9]/.test(text)) return NaN;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
};

const fiiSource = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
const fiiCode = between(fiiSource, 'function extractInvestidor10FiiChecklistMarkup', 'function extractInvestidor10FiiBuyHoldChecklist');
const fiiContext = {
  FII_BUY_HOLD_CHECKLIST_CRITERIA: [
    { id: 'listed_5y', label: 'FII com mais de 5 anos listado em Bolsa', variants: [], help: 'years' },
    { id: 'dy_24m_above_9', label: 'Dividend Yield médio dos últimos 24 meses acima de 9%', variants: [], help: 'dy' },
    { id: 'daily_liquidity_1m', label: 'Liquidez média diária acima de R$ 1 milhão', variants: [], help: 'liq' },
  ],
  cleanInvestidor10InfoValue: strip,
  htmlToPlainText: strip,
  normalizeLooseText: normalize,
  decodeHtmlEntities: decode,
  detectChecklistPassed: () => undefined,
};
vm.createContext(fiiContext);
vm.runInContext(`${fiiCode}; this.extract = extractInvestidor10FiiChecklistMarkup;`, fiiContext);
const fiiHtml = `<section id="checklist">
  <div class="checklist-item"><div><input disabled id="years" checked type="checkbox"></div><div><label>FII com mais de 5 anos listado em Bolsa</label></div></div>
  <div class="checklist-item"><div><input id="dy" type="checkbox" disabled></div><div><label>Dividend Yield médio dos últimos 24 meses acima de 9%</label></div></div>
  <div class="checklist-item" aria-checked="true"><div><span>ok</span></div><div><label>Liquidez média diária acima de R$ 1 milhão</label></div></div>
</section>`;
const fiiResult = fiiContext.extract(fiiHtml, 'TEST11');
assert.equal(fiiResult.items.length, 3);
assert.equal(Array.from(fiiResult.items, item => String(item.passed)).join(','), 'true,false,true');

const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const stockCode = between(stockSource, 'function extractInvestidor10StockChecklistMarkup', 'function stockChecklistFundamentalNumber');
const stockContext = {
  STOCK_BUY_HOLD_CHECKLIST_CRITERIA: [
    { id: 'listed_5y', label: 'Empresa com mais de 5 anos de bolsa', variants: [], help: 'years' },
    { id: 'positive_profit', label: 'Lucro líquido positivo', variants: [], help: 'profit' },
  ],
  cleanText: strip,
  htmlToPlainText: strip,
  normalizeLooseText: normalize,
  decodeHtmlEntities: decode,
  detectStockChecklistPassed: () => undefined,
};
vm.createContext(stockContext);
vm.runInContext(`${stockCode}; this.extract = extractInvestidor10StockChecklistMarkup;`, stockContext);
const stockHtml = `<section id="checklist">
  <div class="checklist-item"><div><input checked disabled type="checkbox"></div><div><label>Empresa com mais de 5 anos de bolsa</label></div></div>
  <div class="checklist-item"><div><input disabled type="checkbox"></div><div><label>Lucro líquido positivo</label></div></div>
</section>`;
const stockResult = stockContext.extract(stockHtml, 'TEST3');
assert.equal(stockResult.items.length, 2);
assert.equal(Array.from(stockResult.items, item => String(item.passed)).join(','), 'true,false');

const vacancyCode = between(fiiSource, 'function namedFiiVacancyPercent', 'function countFiiProperties');
const vacancyContext = { normalizeLooseText: normalize, parseBrNumber, htmlToPlainText: strip };
vm.createContext(vacancyContext);
vm.runInContext(`${vacancyCode}; this.extractVacancy = namedFiiVacancyPercent;`, vacancyContext);
assert.equal(vacancyContext.extractVacancy({ infoItems: [{ label: 'Vacância física', value: '7,5%' }], kind: 'physical' }), 7.5);
assert.equal(vacancyContext.extractVacancy({ html: '{"financialVacancy":"4.2"}', kind: 'financial' }), 4.2);
assert.equal(vacancyContext.extractVacancy({ html: '<p>Vacância financeira média dos últimos 12 meses abaixo de 10%</p>', kind: 'financial' }), null);
console.log('checklist parser exact-source harness ok');
