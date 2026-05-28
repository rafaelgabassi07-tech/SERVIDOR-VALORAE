import { buildChartReadinessReport, parsePtBrNumberForChart } from './chart-readiness.js';
// Relatório barato chart-aware de precisão/extração para /scrape e /batch-scrape.
// Ajuda o app a decidir se os dados extraídos são confiáveis para cards e gráficos.
export const VALORAE_EXTRACTION_PRECISION_VERSION = '21.11.6-extraction-precision-financial-maturity';

function compact(value = '') { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function arr(value) { return Array.isArray(value) ? value : (value === undefined || value === null || value === '' ? [] : [value]); }

export function parsePtBrNumber(value) {
  return parsePtBrNumberForChart(value);
}

function looksNumeric(key = '', spec = {}) {
  const k = String(key || '').toLowerCase();
  const mode = String(spec?.extract || '').toLowerCase();
  return /number|numeric|percent/.test(mode) || /(preco|price|valor|cotacao|yield|dividend|dy|pvp|p\/vp|pl|p\/l|roe|roic|margem|vacancia|patrimonio|rendimento|percent|taxa|variacao)/i.test(k);
}

function selectorEntries(selectors = {}) {
  return selectors && typeof selectors === 'object' && !Array.isArray(selectors) ? Object.entries(selectors) : [];
}

function resultHasValue(value) {
  return arr(value).some(v => v !== undefined && v !== null && compact(v) !== '');
}

function inspectNumericValues(key, values, spec = {}) {
  if (!looksNumeric(key, spec)) return { expectedNumeric: false, parsed: [], suspicious: [] };
  const parsed = arr(values).slice(0, 12).map(v => ({ raw: compact(v), value: parsePtBrNumber(v) }));
  const suspicious = [];
  const lower = String(key).toLowerCase();
  for (const item of parsed) {
    if (item.value === null) suspicious.push({ key, reason: 'not_numeric', raw: item.raw });
    else if (/(preco|price|cotacao|valor)/i.test(lower) && item.value <= 0) suspicious.push({ key, reason: 'non_positive_value', value: item.value });
    else if (/(yield|dy|percent|taxa|roe|roic|margem|vacancia|variacao)/i.test(lower) && Math.abs(item.value) > 1000) suspicious.push({ key, reason: 'extreme_percent_or_ratio', value: item.value });
  }
  return { expectedNumeric: true, parsed, suspicious };
}

function chartReadiness(results = {}) {
  return buildChartReadinessReport(results);
}

export function buildExtractionPrecisionReport({ results = {}, selectors = {}, htmlLength = 0, strategy = 'unknown', warnings = [], sourceDrift = null } = {}) {
  const entries = selectorEntries(selectors);
  const expected = entries.length || Object.keys(results || {}).length;
  const matchedKeys = Object.keys(results || {}).filter(k => resultHasValue(results[k]));
  const missingKeys = entries.map(([k]) => k).filter(k => !resultHasValue(results[k]));
  const numeric = entries.length ? entries.map(([key, spec]) => ({ key, ...inspectNumericValues(key, results[key], spec) })).filter(x => x.expectedNumeric) : [];
  const numericSuspicious = numeric.flatMap(x => x.suspicious || []);
  const coveragePercent = expected ? Math.round((matchedKeys.length / expected) * 10000) / 100 : 100;
  const numericValid = numeric.reduce((sum, x) => sum + (x.parsed || []).filter(p => p.value !== null).length, 0);
  const numericTotal = numeric.reduce((sum, x) => sum + (x.parsed || []).length, 0);
  const numericScore = numericTotal ? Math.round((numericValid / numericTotal) * 100) : 100;
  const arrayFields = Object.values(results || {}).filter(Array.isArray).length;
  const emptyArrays = Object.values(results || {}).filter(v => Array.isArray(v) && v.length === 0).length;
  const shapeConsistencyScore = arrayFields ? Math.max(0, Math.round(((arrayFields - emptyArrays) / arrayFields) * 100)) : 100;
  const driftPenalty = sourceDrift?.sourceDrift ? 18 : 0;
  const warningPenalty = Math.min(20, (warnings || []).length * 4);
  const suspiciousPenalty = Math.min(28, numericSuspicious.length * 7);
  const chart = chartReadiness(results);
  const score = Math.max(0, Math.min(100, Math.round(coveragePercent * 0.48 + numericScore * 0.26 + chart.score * 0.12 + shapeConsistencyScore * 0.06 + (htmlLength ? 8 : 0) - driftPenalty - warningPenalty - suspiciousPenalty)));
  const confidence = Math.max(0, Math.min(1, Math.round((score / 100) * 1000) / 1000));
  return {
    version: VALORAE_EXTRACTION_PRECISION_VERSION,
    score,
    level: score >= 85 ? 'high' : score >= 70 ? 'medium' : score >= 50 ? 'low' : 'critical',
    coveragePercent,
    expectedKeys: expected,
    matchedKeys: matchedKeys.length,
    emptyKeys: missingKeys,
    numericScore,
    shapeConsistencyScore,
    numericFields: numeric.length,
    suspicious: numericSuspicious.slice(0, 12),
    parseStrategy: strategy,
    chartReadiness: chart,
    warnings: (warnings || []).slice(0, 8),
    sourceDrift: Boolean(sourceDrift?.sourceDrift),
    confidence,
    recommendations: [
      ...(missingKeys.length ? [`${missingKeys.length} campo(s) sem valor retornado.`] : []),
      ...(numericSuspicious.length ? ['Validar campos numéricos suspeitos antes de alimentar gráficos.'] : []),
      ...((chart.recommendations || []).slice(0, 3)),
    ],
  };
}
