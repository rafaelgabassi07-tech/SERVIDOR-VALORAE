export const VALORAE_ASSET_LAUNCH_READINESS_VERSION = '21.12.27-investidor10-asset-readiness';

const GROUPS = {
  quote: ['precoAtual', 'price', 'currentPrice', 'variacaoDay', 'variacao12m'],
  valuation: ['pl', 'pvp', 'evEbitda', 'evEbit', 'pAtivo', 'vpa', 'lpa', 'valorDeMercado', 'marketCap'],
  dividends: ['dividendYield', 'dy', 'dyMedio5a', 'payout', 'ultimoRendimento', 'lastDividend', 'yield12m', 'totalDividendos12m'],
  profitability: ['roe', 'roic', 'roa', 'margemLiquida', 'margemBruta', 'margemEbit', 'margemEbitda', 'cagrReceitas5a', 'cagrLucros5a'],
  balance: ['patrimonioLiquido', 'ativosTotais', 'dividaLiquidaPatrimonio', 'dividaLiquidaEbitda', 'liquidezCorrente', 'valorPatrimonial', 'valorPatrimonialCota'],
  liquidity: ['liquidezMediaDiaria', 'liquidezDiaria', 'volume', 'freeFloat'],
  fii: ['vacanciaFisica', 'vacanciaFinanceira', 'numeroCotistas', 'cotasEmitidas', 'segmentoFii', 'tipoFundo', 'tipoGestao', 'mandato', 'taxaAdministracao'],
};

function keys(obj = {}) { return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj) : []; }
function hasValue(v) { return v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && Number.isNaN(v)); }
function metricValue(field) {
  if (field && typeof field === 'object' && 'value' in field) return field.value ?? field.display;
  return field;
}
function getMetric(payload = {}, key = '') {
  const canonical = payload.appPayload?.metrics?.canonical || {};
  const aliases = payload.appPayload?.metrics?.aliases || {};
  const normalized = payload.normalized || {};
  const alias = aliases[key];
  if (hasValue(canonical[key])) return canonical[key];
  if (alias && hasValue(canonical[alias])) return canonical[alias];
  if (hasValue(normalized[key])) return normalized[key];
  if (alias && hasValue(normalized[alias])) return normalized[alias];
  return undefined;
}

export function buildFundamentalsView(payload = {}) {
  const groups = {};
  for (const [groupName, groupKeys] of Object.entries(GROUPS)) {
    const fields = {};
    const missing = [];
    for (const key of groupKeys) {
      const value = getMetric(payload, key);
      if (hasValue(value)) fields[key] = value;
      else missing.push(key);
    }
    const present = keys(fields).length;
    groups[groupName] = {
      present,
      expected: groupKeys.length,
      completenessPercent: Math.round((present / groupKeys.length) * 100),
      fields,
      missing: missing.slice(0, 16),
    };
  }
  if (payload.assetClassContract?.groups) {
    const groups = payload.assetClassContract.groups;
    const totalPresent = Object.values(groups).reduce((n, g) => n + Number(g.present || 0), 0);
    const totalExpected = Object.values(groups).reduce((n, g) => n + Number(g.expected || 0), 0);
    return {
      version: VALORAE_ASSET_LAUNCH_READINESS_VERSION,
      ticker: payload.ticker,
      type: payload.type,
      status: payload.status,
      partial: Boolean(payload.partial),
      completenessPercent: totalExpected ? Math.round((totalPresent / totalExpected) * 100) : 0,
      canonicalMetricCount: keys(payload.appPayload?.metrics?.canonical).length,
      normalizedMetricCount: keys(payload.normalized).filter(k => k !== '_meta').length,
      assetClassContract: {
        version: payload.assetClassContract.version,
        assetType: payload.assetClassContract.assetType,
        score: payload.assetClassContract.score,
        state: payload.assetClassContract.state,
        sourceModel: payload.assetClassContract.sourceModel,
      },
      groups,
      preferredMetricPath: 'assetClassContract.groups',
      fallbackMetricPath: 'appPayload.metrics.canonical|normalized',
      source: payload.appPayload?.source || payload.sourceReport,
      warnings: Array.isArray(payload.warnings) ? payload.warnings.slice(0, 10) : [],
    };
  }
  const canonicalCount = keys(payload.appPayload?.metrics?.canonical).length;
  const normalizedCount = keys(payload.normalized).filter(k => k !== '_meta').length;
  const totalPresent = Object.values(groups).reduce((n, g) => n + g.present, 0);
  const totalExpected = Object.values(groups).reduce((n, g) => n + g.expected, 0);
  return {
    version: VALORAE_ASSET_LAUNCH_READINESS_VERSION,
    ticker: payload.ticker,
    type: payload.type,
    status: payload.status,
    partial: Boolean(payload.partial),
    completenessPercent: totalExpected ? Math.round((totalPresent / totalExpected) * 100) : 0,
    canonicalMetricCount: canonicalCount,
    normalizedMetricCount: normalizedCount,
    groups,
    preferredMetricPath: 'appPayload.metrics.canonical',
    fallbackMetricPath: 'normalized',
    source: payload.appPayload?.source || payload.sourceReport,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.slice(0, 10) : [],
  };
}

export function buildCoverageView(payload = {}) {
  const fundamentals = buildFundamentalsView(payload);
  const app = payload.appPayload || {};
  const snapshot = payload.appMobileSnapshot || {};
  const chartCount = Number(app?.charts?.count || snapshot?.charts?.length || payload.chartSeries?.series?.length || 0);
  const dividendCount = Number(app?.dividends?.count || snapshot?.dividends?.items?.length || payload.results?.dividendos?.historico?.length || 0);
  const coverage = {
    quote: Boolean(app.quote?.price || snapshot.quote?.price || getMetric(payload, 'precoAtual')),
    fundamentals: fundamentals.completenessPercent >= 35,
    dividends: dividendCount > 0 || fundamentals.groups.dividends.present > 0,
    charts: chartCount > 0,
    sourceTrace: Boolean(payload.sourceReport || app.source),
    appContracts: Boolean(payload.appMobileSnapshot && payload.appPayload && payload.appSyncEnvelope && payload.appResponseIntegrity),
  };
  const score = Math.round(Object.values(coverage).filter(Boolean).length / Object.values(coverage).length * 100);
  return {
    version: VALORAE_ASSET_LAUNCH_READINESS_VERSION,
    ticker: payload.ticker,
    type: payload.type,
    status: payload.status,
    partial: Boolean(payload.partial),
    score,
    launchState: score >= 85 ? 'ready' : score >= 60 ? 'usable_partial' : 'needs_source_or_contract_work',
    coverage,
    counts: {
      metrics: fundamentals.canonicalMetricCount || fundamentals.normalizedMetricCount,
      charts: chartCount,
      dividends: dividendCount,
      warnings: Array.isArray(payload.warnings) ? payload.warnings.length : 0,
    },
    fundamentalsSummary: Object.fromEntries(Object.entries(fundamentals.groups).map(([k, v]) => [k, { present: v.present, expected: v.expected, completenessPercent: v.completenessPercent }])),
    renderSafety: {
      renderSafe: Boolean(payload.appResponseIntegrity?.renderSafe || payload.appDataContract?.renderSafe),
      cacheSafe: Boolean(payload.appResponseIntegrity?.cacheSafe || payload.appDataContract?.canReplacePreviousSnapshot),
      recommendation: payload.appResponseIntegrity?.recommendedAction || payload.appSyncEnvelope?.decision || (payload.partial ? 'render_partial' : 'render'),
    },
    missingCritical: payload.appDataContract?.uiGuards?.missingCritical || payload.appPayload?.blankShield?.missingCritical || [],
    source: payload.appPayload?.source || payload.sourceReport,
  };
}
