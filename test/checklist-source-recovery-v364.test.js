import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function between(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0 && end > start, `Unable to extract ${startNeedle}`);
  return source.slice(start, end);
}

const normalize = value => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();
const strip = value => String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const parseBrNumber = value => {
  const raw = String(value ?? '').match(/[+-]?\d+(?:[.,]\d+)?/)?.[0] || '';
  if (!raw) return NaN;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
};
const finiteNumberOrNull = value => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);

const stockSource = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');
const stockStateCode = between(stockSource, 'function explicitCheckboxStateNearWindowCenter', 'function extractStockChecklistDisclaimer');
const stockStateContext = { normalizeLooseText: normalize };
vm.createContext(stockStateContext);
vm.runInContext(`${stockStateCode}; this.detect = detectStockChecklistPassed;`, stockStateContext);
assert.equal(stockStateContext.detect('<input disabled checked type="checkbox"> Empresa com mais de 5 anos de Bolsa', '', 'listed_5y'), true);
assert.equal(stockStateContext.detect('<input disabled type="checkbox"> Empresa nunca deu prejuízo', '', 'never_loss_fiscal'), false);

const fiiSource = fs.readFileSync(new URL('../lib/analysis/fii-modal-contract.js', import.meta.url), 'utf8');
const fiiStateCode = between(fiiSource, 'function explicitFiiCheckboxStateNearWindowCenter', 'function extractChecklistDisclaimer');
const fiiStateContext = { normalizeLooseText: normalize };
vm.createContext(fiiStateContext);
vm.runInContext(`${fiiStateCode}; this.detect = detectChecklistPassed;`, fiiStateContext);
assert.equal(fiiStateContext.detect('FII com mais de 5 anos', 0, 10, '<input disabled checked type="checkbox"> FII com mais de 5 anos'), true);
assert.equal(fiiStateContext.detect('Dividend Yield médio', 0, 10, '<input disabled type="checkbox"> Dividend Yield médio'), false);

const ratingCode = between(stockSource, 'function extractStockChecklistCompanyFacts', 'function stockFinancialPointNetIncome');
const ratingContext = {
  htmlToPlainText: strip,
  cleanText: strip,
  parseBrNumber,
  compactMoneyFromDisplay: () => null,
  finiteNumberOrNull
};
vm.createContext(ratingContext);
vm.runInContext(`${ratingCode}; this.extractFacts = extractStockChecklistCompanyFacts;`, ratingContext);
const ratingTen = ratingContext.extractFacts('Nota dos usuários: 6,0/10');
assert.equal(ratingTen.userRating, 6);
assert.equal(ratingTen.userRatingScale, 10);
assert.equal(ratingTen.userRatingNormalized5, 3);
const ratingFive = ratingContext.extractFacts('Média de avaliações dos usuários: 4,2/5');
assert.equal(ratingFive.userRatingNormalized5, 4.2);

console.log('checklist source recovery handles disabled checkboxes and rating scales');

const deriveCode = between(stockSource, 'function deriveStockChecklistStatusFromInvestidor10', 'function parseBrDateToIso');
const deriveContext = {
  finiteNumberOrNull,
  extractStockChecklistCompanyFacts: html => html === 'FOUNDING_ONLY'
    ? { debutYear: null, foundingYear: 1980, dailyLiquidity: null, dailyLiquidityDisplay: '', userRatingNormalized5: null }
    : html === 'LIQUIDITY_11M'
      ? { debutYear: null, foundingYear: null, dailyLiquidity: 11_000_000, dailyLiquidityDisplay: 'R$ 11,0 milhões', userRatingNormalized5: null }
      : { debutYear: null, foundingYear: null, dailyLiquidity: null, dailyLiquidityDisplay: '', userRatingNormalized5: null },
  stockChecklistProfitEvidence: canonical => canonical?.profitEvidence || { annual: [], quarterlyCount: 0, annualCount: 0, last20QuarterlyPositive: null, last5AnnualPositive: null },
  stockChecklistFundamentalNumber: () => null,
  formatNumber: value => String(value),
  formatPercent: value => `${value}%`,
  formatCompactMoney: value => `R$ ${value}`
};
vm.createContext(deriveContext);
vm.runInContext(`${deriveCode}; this.derive = deriveStockChecklistStatusFromInvestidor10;`, deriveContext);
assert.equal(deriveContext.derive({ criterionId: 'listed_5y', html: 'FOUNDING_ONLY' }).passed, null, 'Ano de fundação não pode substituir estreia em Bolsa');
assert.equal(deriveContext.derive({
  criterionId: 'profit_20_quarters',
  canonical: { profitEvidence: { annual: [{ netIncome: 1 }, { netIncome: 2 }, { netIncome: 3 }, { netIncome: 4 }, { netIncome: 5 }], quarterlyCount: 0, annualCount: 5, last20QuarterlyPositive: null, last5AnnualPositive: true } }
}).passed, null, 'Cinco anos anuais não provam vinte trimestres lucrativos');
assert.equal(deriveContext.derive({ criterionId: 'daily_liquidity_2m_usd', html: 'LIQUIDITY_11M' }).passed, null, 'Limiar em USD não pode ser decidido sem câmbio');
assert.equal(deriveContext.derive({ criterionId: 'daily_liquidity_2m_usd', html: 'LIQUIDITY_11M', usdBrlRate: 5 }).passed, true, 'Liquidez deve usar o limiar convertido pelo USD/BRL recebido');
assert.equal(deriveContext.derive({ criterionId: 'listed_5y', buyHoldRanking: { status: 'OK', score: 0 } }).passed, null, 'Score agregado zero não deve reprovar todos os critérios individualmente');

const listingCode = between(fiiSource, 'function fiiListingEvidenceFromSources', 'function averageVacancyPercent');
const listingContext = { htmlToPlainText: strip };
vm.createContext(listingContext);
vm.runInContext(`${listingCode}; this.listingEvidence = fiiListingEvidenceFromSources;`, listingContext);
const currentYear = new Date().getFullYear();
assert.equal(listingContext.listingEvidence(`Fundo constituído em ${currentYear - 2}`, null).passed, false, 'Ano explícito recente pode reprovar');
assert.equal(listingContext.listingEvidence('', { events: [{ dataCom: `${currentYear - 2}-01-10` }] }).passed, null, 'Histórico curto de eventos não prova fundo recente');
assert.equal(listingContext.listingEvidence('', { events: [{ dataCom: `${currentYear - 6}-01-10` }] }).passed, true, 'Histórico longo de eventos prova ao menos cinco anos');

const vacancyCode = between(fiiSource, 'function namedFiiVacancyPercent', 'function countFiiProperties');
const vacancyContext = { normalizeLooseText: normalize, parseBrNumber, htmlToPlainText: strip };
vm.createContext(vacancyContext);
vm.runInContext(`${vacancyCode}; this.namedVacancy = namedFiiVacancyPercent;`, vacancyContext);
const vacancyHtml = 'Vacância física 4,5% | Vacância financeira 7,25%';
assert.equal(vacancyContext.namedVacancy({ html: vacancyHtml, kind: 'physical' }), 4.5, 'Vacância física deve ser extraída separadamente');
assert.equal(vacancyContext.namedVacancy({ html: vacancyHtml, kind: 'financial' }), 7.25, 'Vacância financeira deve ser extraída separadamente');

console.log('checklist recovery avoids false decisions from founding year, annual proxies, fixed FX and truncated FII history');
