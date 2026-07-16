import { createHash } from 'node:crypto';

export const VALORAE_BASELINE_CONTRACT_VERSION = '2026.07.14-checkpoint106-v1';
export const VALORAE_BASELINE_POLICY_VERSION = 'no-regression-field-continuity-v1';

export const VALORAE_REFERENCE_ASSET_MATRIX = Object.freeze({
  stocksOn: ['VALE3', 'WEGE3', 'BBAS3'],
  stocksPn: ['PETR4', 'ITUB4'],
  units: ['SANB11', 'TAEE11'],
  fiisBrick: ['HGLG11', 'KNRI11'],
  fiisPaper: ['MXRF11', 'KNCR11'],
  etfs: ['BOVA11', 'IVVB11'],
  bdrs: ['AAPL34', 'MSFT34'],
  indices: ['IBOV', 'IFIX', 'IDIV', 'SMLL'],
});

const ENDPOINT_BASELINES = Object.freeze({
  analysis: {
    aliases: ['/analysis', '/asset/analysis'],
    requiredPaths: ['endpoint', 'contract', 'ticker', 'sections', 'summary'],
    continuityPaths: ['sections', 'sourceCoverage', 'dataQuality', 'summary', 'consumerContract', 'missingSignals'],
    identityPaths: ['ticker', 'assetType'],
  },
  asset: {
    aliases: ['/asset'],
    requiredPaths: ['ticker', 'status', 'results'],
    continuityPaths: ['results', 'normalized', 'appMobileSnapshot', 'appPayload', 'appSyncEnvelope', 'appResponseIntegrity'],
    identityPaths: ['ticker', 'type'],
  },
  assetModal: {
    aliases: ['/asset/modal'],
    requiredPaths: ['contract', 'ticker', 'status'],
    continuityPaths: ['header', 'sections', 'delivery', 'sources', 'sourceCoverage', 'warnings'],
    identityPaths: ['ticker', 'assetType', 'stage'],
  },
  stockModal: {
    aliases: ['/asset/stock-modal', '/asset/action-modal', '/acao/modal'],
    requiredPaths: ['contract', 'ticker', 'status'],
    continuityPaths: [
      'header', 'quoteChart', 'summary', 'fundamentalIndicators', 'companyProfile', 'companyInformation',
      'dividendHistory', 'revenueProfitChart', 'profitQuoteChart', 'historicalIndicators', 'businessRevenue',
      'payoutChart', 'indexComparison', 'peerComparison', 'checklist', 'announcements', 'delivery'
    ],
    identityPaths: ['ticker', 'stage'],
  },
  fiiModal: {
    aliases: ['/asset/fii-modal', '/fii/modal'],
    requiredPaths: ['contract', 'ticker', 'status'],
    continuityPaths: [
      'header', 'chart', 'summary', 'information', 'metrics', 'historicalIndicators', 'dividendHistory',
      'dividendCharts', 'indexComparison', 'peerComparison', 'checklist', 'propertyPortfolio', 'vacancyHistory',
      'patrimonialInfo', 'announcements', 'delivery'
    ],
    identityPaths: ['ticker', 'stage'],
  },
  portfolioReturns: {
    aliases: ['/portfolio/returns', '/portfolio/return', '/portfolio/performance'],
    requiredPaths: ['status', 'contractVersion', 'summary', 'series', 'monthlyTable', 'highlights'],
    continuityPaths: ['summary', 'series', 'monthlyTable', 'highlights', 'benchmarks', 'benchmarkSeries', 'diagnostics'],
    identityPaths: ['range', 'assetFilter'],
  },
  portfolioHistory: {
    aliases: ['/portfolio/history'],
    requiredPaths: ['ok', 'version', 'series'],
    continuityPaths: ['series', 'summary', 'coverage', 'historyCoveragePercent', 'missingHistoryTickers'],
    identityPaths: ['range', 'interval'],
  },
  mobileSync: {
    aliases: ['/mobile/bootstrap', '/mobile/practical-sync', '/mobile/portfolio-sync', '/portfolio/insights-bundle'],
    requiredPaths: ['status'],
    continuityPaths: ['portfolio', 'analysis', 'history', 'dividends', 'rankings', 'appMobileSnapshot', 'appPayload'],
    identityPaths: ['userId', 'deviceId'],
  },
});

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function clone(value) {
  if (value === undefined) return undefined;
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function getPath(source, path) {
  return String(path || '').split('.').filter(Boolean).reduce((value, key) => value == null ? undefined : value[key], source);
}

export function setPath(target, path, value) {
  const parts = String(path || '').split('.').filter(Boolean);
  if (!parts.length || parts.some(part => DANGEROUS_KEYS.has(part))) return false;
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[parts.at(-1)] = clone(value);
  return true;
}

export function isContractValuePresent(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function typeName(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function normalizeEndpoint(endpoint = '') {
  const clean = String(endpoint || '')
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/api(?:\/v[12])?/i, '')
    .split('?')[0]
    .replace(/\/+$/, '') || '/';
  for (const [id, spec] of Object.entries(ENDPOINT_BASELINES)) {
    if (spec.aliases.includes(clean)) return id;
  }
  return clean.replace(/^\//, '').replaceAll('/', '-') || 'unknown';
}

export function baselineForEndpoint(endpoint = '') {
  const id = normalizeEndpoint(endpoint);
  return { id, ...(ENDPOINT_BASELINES[id] || { aliases: [endpoint], requiredPaths: [], continuityPaths: [], identityPaths: [] }) };
}

function stableShape(value, depth = 0) {
  if (depth > 10) return '[max-depth]';
  if (Array.isArray(value)) {
    const sample = value.find(item => item !== undefined && item !== null);
    return { type: 'array', sample: sample === undefined ? null : stableShape(sample, depth + 1) };
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableShape(value[key], depth + 1)]));
  }
  return typeName(value);
}

export function buildContractShapeSnapshot(payload = {}) {
  const shape = stableShape(payload);
  const serialized = JSON.stringify(shape);
  return {
    shape,
    sha256: createHash('sha256').update(serialized).digest('hex'),
  };
}

export function assessContractPayload(endpoint, payload = {}) {
  const baseline = baselineForEndpoint(endpoint);
  const missingRequired = baseline.requiredPaths.filter(path => !isContractValuePresent(getPath(payload, path)));
  const status = String(payload?.status || '').toUpperCase();
  const explicitError = Boolean(payload?.error) || status === 'ERROR' || status === 'FAILED';
  return {
    version: VALORAE_BASELINE_CONTRACT_VERSION,
    policyVersion: VALORAE_BASELINE_POLICY_VERSION,
    endpoint: baseline.id,
    requiredPaths: baseline.requiredPaths,
    continuityPaths: baseline.continuityPaths,
    missingRequired,
    ok: !explicitError && missingRequired.length === 0,
    canReplacePrevious: !explicitError && missingRequired.length === 0,
    shape: buildContractShapeSnapshot(payload),
  };
}

export function compareContractPayloads(endpoint, previous = {}, current = {}) {
  const baseline = baselineForEndpoint(endpoint);
  const losses = [];
  const typeChanges = [];
  for (const path of baseline.continuityPaths) {
    const before = getPath(previous, path);
    const after = getPath(current, path);
    if (isContractValuePresent(before) && !isContractValuePresent(after)) {
      losses.push({ path, beforeType: typeName(before), beforeCount: Array.isArray(before) ? before.length : undefined });
      continue;
    }
    if (isContractValuePresent(before) && isContractValuePresent(after) && typeName(before) !== typeName(after)) {
      typeChanges.push({ path, beforeType: typeName(before), afterType: typeName(after) });
    }
  }
  return {
    version: VALORAE_BASELINE_CONTRACT_VERSION,
    endpoint: baseline.id,
    losses,
    typeChanges,
    regression: losses.length > 0 || typeChanges.length > 0,
  };
}

export function preservePreviousContractFields(endpoint, previous = {}, current = {}) {
  const baseline = baselineForEndpoint(endpoint);
  const out = clone(current) || {};
  const comparison = compareContractPayloads(endpoint, previous, current);
  const recoveredPaths = [];
  for (const regression of [...comparison.losses, ...comparison.typeChanges]) {
    const previousValue = getPath(previous, regression.path);
    if (setPath(out, regression.path, previousValue)) recoveredPaths.push(regression.path);
  }
  const assessment = assessContractPayload(endpoint, out);
  out.contractBaseline = {
    version: VALORAE_BASELINE_CONTRACT_VERSION,
    policyVersion: VALORAE_BASELINE_POLICY_VERSION,
    endpoint: baseline.id,
    status: recoveredPaths.length ? 'RECOVERED_FROM_LAST_GOOD' : (assessment.ok ? 'COMPATIBLE' : 'INCOMPLETE'),
    regressionBlocked: recoveredPaths.length > 0,
    recoveredPaths,
    typeChanges: comparison.typeChanges,
    missingRequired: assessment.missingRequired,
    canReplacePrevious: assessment.canReplacePrevious,
  };
  if (recoveredPaths.length) {
    out.partial = true;
    out.contractBaseline.warning = 'Dados ausentes foram preservados do último payload compatível.';
  }
  return out;
}

export function attachContractBaseline(endpoint, payload = {}) {
  const out = clone(payload) || {};
  const assessment = assessContractPayload(endpoint, out);
  out.contractBaseline = {
    version: VALORAE_BASELINE_CONTRACT_VERSION,
    policyVersion: VALORAE_BASELINE_POLICY_VERSION,
    endpoint: assessment.endpoint,
    status: assessment.ok ? 'COMPATIBLE' : 'INCOMPLETE',
    regressionBlocked: false,
    recoveredPaths: [],
    missingRequired: assessment.missingRequired,
    canReplacePrevious: assessment.canReplacePrevious,
    shapeSha256: assessment.shape.sha256,
  };
  return out;
}

export function buildContractBaselineManifest() {
  return {
    status: 'OK',
    endpoint: 'contract/baseline',
    version: VALORAE_BASELINE_CONTRACT_VERSION,
    policyVersion: VALORAE_BASELINE_POLICY_VERSION,
    guarantees: {
      additiveChangesOnly: true,
      preserveLastGoodOnRegression: true,
      neverConvertTransportFailureToZero: true,
      promoteByFieldOrSection: true,
      rollbackByEndpoint: true,
    },
    referenceAssets: VALORAE_REFERENCE_ASSET_MATRIX,
    endpoints: Object.fromEntries(Object.entries(ENDPOINT_BASELINES).map(([id, spec]) => [id, { ...spec }])),
  };
}

export const _test = {
  ENDPOINT_BASELINES,
  normalizeEndpoint,
  stableShape,
  typeName,
};
