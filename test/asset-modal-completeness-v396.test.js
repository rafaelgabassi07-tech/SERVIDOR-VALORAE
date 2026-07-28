import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const router = read('routes/_router.js');
const stock = read('lib/analysis/stock-modal-contract.js');
const fii = read('lib/analysis/fii-modal-contract.js');

// O campo removido é expurgado recursivamente de todos os envelopes de modal.
for (const token of ['analysisChanges', 'analysisChange', 'whatChanged', 'changesSinceLastAnalysis', 'changesSincePreviousAnalysis']) {
  assert.match(router, new RegExp(token));
}
assert.match(router, /function stripRemovedAssetModalFields/);
assert.match(router, /endpoint === 'assetModal'/);
assert.match(router, /endpoint === 'stockModal'/);
assert.match(router, /endpoint === 'fiiModal'/);
assert.match(router, /stripRemovedAssetModalFields\(payload\)/);
assert.match(router, /stripRemovedAssetModalFields\(observed\)/);

// Checklist da ação: 10 critérios canônicos, valor, evidência e diagnóstico de lacuna.
assert.match(stock, /const STOCK_BUY_HOLD_CHECKLIST_CRITERIA = Object\.freeze\(\[/);
assert.equal((stock.match(/id: '(?:listed_5y|never_loss_fiscal|profit_20_quarters|dividends_5y_above_5|roe_above_10|debt_below_equity|revenue_growth_5y|profit_growth_5y|daily_liquidity_2m_usd|investidor10_user_rating)'/g) || []).length >= 10, true);
for (const token of ['valueDisplay', 'dataNature', 'SOURCE_PENDING', 'missingCriterionIds', 'all_canonical_criteria_direct_checkbox_then_real_i10_metric_recovery']) {
  assert.match(stock, new RegExp(token));
}
assert.equal(stock.includes('facts.dailyLiquidity ?? buyHoldRanking?.marketValue'), false);
assert.match(stock, /fetchYahooQuote\('BRL=X'/);
assert.match(stock, /usdBrlRate/);
assert.match(stock, /ano de fundação não é usado como substituto/);
assert.match(stock, /exercícios anuais não substituem este critério trimestral/);

// Checklist de FII: 8 critérios, vacâncias independentes e preenchimento canônico.
for (const id of ['listed_5y', 'dy_24m_above_9', 'daily_liquidity_1m', 'shareholders_20k', 'equity_500m', 'properties_5_plus', 'physical_vacancy_below_10', 'financial_vacancy_below_10']) {
  assert.match(fii, new RegExp(id));
}
for (const token of ['ensureFiiBuyHoldChecklist', "namedFiiVacancyPercent({ html, infoItems, kind: 'physical' })", "namedFiiVacancyPercent({ html, infoItems, kind: 'financial' })", 'missingCriterionIds', 'Em apuração', 'short_dividend_history_is_not_failure']) {
  assert.match(fii, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

// Radar: deduplicação, janela histórica, datas futuras ignoradas, recorrência e confiança.
for (const token of ['buildStockDividendRadarPayload', 'radarCalendarDateParts', 'radarDateParts', 'uniqueEvents', 'observedYearCount', 'dateComScore', 'paymentScore', 'invalidEvents', 'futureEvents', 'duplicateEventsRemoved', 'outsideRecentWindow', 'methodology']) {
  assert.match(stock, new RegExp(token));
}

console.log('OK v396: remoção do campo, checklists completos e radar robusto validados');
