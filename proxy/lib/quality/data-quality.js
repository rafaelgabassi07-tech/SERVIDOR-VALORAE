import { SOURCE_PROVIDERS, SCHEMA_CATALOG, VALORAE_CATALOG_VERSION } from '../catalogs/valorae-catalogs.js';

function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).replace(/R\$|BRL|US\$|USD/gi, '').replace(/%/g, '').replace(/\s+/g, '').replace(/\(([^)]+)\)/, '-$1').replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function get(obj, path) {
  return String(path).split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
}

function normalizedValue(asset = {}, key) {
  const n = asset.normalized?.[key];
  return n && typeof n === 'object' ? n.value : undefined;
}

export function buildAssetDataQualityMatrix(asset = {}) {
  const type = String(asset.type || '').toUpperCase();
  const critical = type === 'FII'
    ? ['dividendYield','pvp','valorPatrimonialCota','patrimonioLiquido','vacanciaFisica','ultimoRendimento']
    : ['precoAtual','dividendYield','pl','pvp','roe','valorDeMercado'];
  const fields = critical.map(field => {
    const value = normalizedValue(asset, field) ?? get(asset.results || {}, field) ?? get(asset.results?.indicadores || {}, field);
    const present = value !== undefined && value !== null && value !== '';
    const numeric = num(value);
    let confidence = Number(asset.normalized?.[field]?.confidence ?? (present ? 0.7 : 0));
    const warnings = [];
    if (!present) warnings.push('missing');
    if (present && numeric !== null) {
      if (/yield|dy/i.test(field) && (numeric < 0 || numeric > 40)) { warnings.push('yield-out-of-range'); confidence -= 0.25; }
      if (['pvp','pl','roe'].includes(field) && Math.abs(numeric) > 1000) { warnings.push('ratio-extreme'); confidence -= 0.25; }
      if (field === 'precoAtual' && numeric <= 0) { warnings.push('non-positive-price'); confidence -= 0.35; }
    }
    return { field, present, value, normalizedNumber: numeric, confidence: Math.max(0, Math.min(1, Math.round(confidence * 100) / 100)), warnings };
  });
  const present = fields.filter(f => f.present).length;
  const warnings = fields.flatMap(f => f.warnings.map(w => ({ field: f.field, warning: w })));
  const freshnessScore = asset.metrics?.generatedAt ? 85 : 60;
  const fieldConfidenceScore = fields.length ? Math.round(fields.reduce((s, f) => s + f.confidence, 0) / fields.length * 100) : 0;
  const completenessScore = fields.length ? Math.round(present / fields.length * 100) : 100;
  const score = Math.max(0, Math.min(100, Math.round(completenessScore * 0.45 + fieldConfidenceScore * 0.4 + freshnessScore * 0.15 - warnings.length * 3)));
  return { version: VALORAE_CATALOG_VERSION, score, grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D', completenessScore, fieldConfidenceScore, freshnessScore, fields, warnings };
}

function healthForProvider(health = {}, name = '') {
  if (health[name]) return health[name];
  if (name === 'BCB') return health.BCB || health.BancoCentral || {};
  if (name === 'YahooChart') return health.YahooChart || health.YahooHistory || {};
  return {};
}

export function buildSourceReliabilityMatrix(runtime = {}, lastReport = {}) {
  const health = runtime.providers || {};
  return SOURCE_PROVIDERS.map(provider => {
    const h = healthForProvider(health, provider.name);
    const rawStatus = String(h.status || '').toLowerCase();
    const failures = Number(h.failures || 0);
    const sampleSize = Number(h.sampleSize || 0);
    const cooldownUntil = h.cooldownUntil || null;
    const status = cooldownUntil || rawStatus === 'degraded' || rawStatus === 'half-open'
      ? (cooldownUntil ? 'cooldown' : 'degraded')
      : rawStatus === 'healthy'
        ? 'healthy'
        : failures > 0
          ? 'degraded'
          : sampleSize > 0
            ? 'healthy'
            : 'untested';
    const confidence = status === 'cooldown' ? 0.35 : status === 'degraded' ? 0.6 : status === 'healthy' ? 0.9 : 0.72;
    return {
      ...provider,
      status,
      confidence,
      failures,
      successes: h.successes || 0,
      sampleSize,
      score: h.score ?? null,
      lastStatus: h.lastStatus ?? null,
      lastErrorType: h.lastErrorType || null,
      cooldownUntil,
      retryAfterMs: h.retryAfterMs || 0,
      lastReport: lastReport[provider.name] || null
    };
  });
}

export function schemaCatalog() {
  return { version: VALORAE_CATALOG_VERSION, schemas: SCHEMA_CATALOG };
}
