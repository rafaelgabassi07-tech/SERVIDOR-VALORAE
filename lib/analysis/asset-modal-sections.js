/**
 * Canonical section catalog for the progressive Ação/FII modal contract.
 *
 * Keep these IDs aligned with ValoraeAssetModalQuality.kt in the Android client. Public delivery
 * metadata must use only these canonical IDs; aliases are accepted only on incoming requests.
 */
export const STOCK_MODAL_CRITICAL_SECTIONS = Object.freeze([
  'historicalIndicators',
  'revenueProfitChart',
  'profitQuoteChart',
  'equityEvolutionChart',
  'indexComparison',
  'announcements'
]);

export const STOCK_MODAL_RECOVERABLE_SECTIONS = Object.freeze([
  'quote',
  'chart',
  'metrics',
  'historicalIndicators',
  'revenueProfitChart',
  'profitQuoteChart',
  'equityEvolutionChart',
  'indexComparison',
  'announcements',
  'fundamentalIndicators',
  'checklist',
  'payoutChart',
  'dividends',
  'peerComparison',
  'company',
  'revenueBreakdown',
  'financialStatements',
  'returns'
]);

export const FII_MODAL_CRITICAL_SECTIONS = Object.freeze([
  'historicalIndicators',
  'patrimonialInfo',
  'indexComparison',
  'announcements'
]);

export const FII_MODAL_RECOVERABLE_SECTIONS = Object.freeze([
  'quote',
  'chart',
  'metrics',
  'historicalIndicators',
  'patrimonialInfo',
  'indexComparison',
  'announcements',
  'peerComparison',
  'checklist',
  'distributions12m',
  'dividendCharts',
  'aboutFund',
  'propertyPortfolio',
  'information',
  'returns'
]);

export function canonicalModalSections(family = '') {
  return String(family).toLowerCase() === 'fii'
    ? [...FII_MODAL_RECOVERABLE_SECTIONS]
    : [...STOCK_MODAL_RECOVERABLE_SECTIONS];
}

export function criticalModalSections(family = '') {
  return String(family).toLowerCase() === 'fii'
    ? [...FII_MODAL_CRITICAL_SECTIONS]
    : [...STOCK_MODAL_CRITICAL_SECTIONS];
}
