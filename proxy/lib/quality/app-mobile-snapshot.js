// Snapshot compacto e estável para APK/Web.
// Objetivo: entregar uma raiz pequena para primeira pintura, cache local e listas/watchlist
// sem obrigar o app a percorrer results/html/diagnósticos pesados.

import { createHash } from 'node:crypto';

export const VALORAE_APP_MOBILE_SNAPSHOT_VERSION = '21.12.9-app-mobile-snapshot';

const DEFAULT_METRIC_KEYS = [
  'precoAtual','variacaoDay','variacao12m','dividendYield','dyMedio5a','ultimoRendimento','totalDividendos12m',
  'pvp','pl','roe','roic','roa','payout','valorPatrimonialCota','patrimonioLiquido','valorDeMercado',
  'liquidezMediaDiaria','vacanciaFisica','yield1m','yield3m','yield6m','yield12m'
];

function present(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function asField(value) {
  if (!present(value)) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const raw = value.value ?? value.display;
    return {
      value: Number.isFinite(Number(value.value)) ? Number(value.value) : null,
      display: value.display ?? (raw == null ? null : String(raw)),
      unit: value.unit || null,
      source: value.source || null,
      confidence: typeof value.confidence === 'number' ? Math.max(0, Math.min(1, value.confidence)) : null,
    };
  }
  return {
    value: Number.isFinite(Number(value)) ? Number(value) : null,
    display: String(value),
    unit: null,
    source: 'valorae:primitive-fallback',
    confidence: 0.45,
  };
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    if (['generatedAt','runtime','debug','requestId','totalTimeMs'].includes(key)) return acc;
    acc[key] = stableSort(value[key]);
    return acc;
  }, {});
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(stableSort(value))).digest('hex').slice(0, 20);
}

function compactMetrics(payload = {}) {
  const canonical = payload.appPayload?.metrics?.canonical || payload.normalized || {};
  const out = {};
  const keys = [...new Set([...DEFAULT_METRIC_KEYS, ...Object.keys(canonical || {})])];
  for (const key of keys) {
    if (key === '_meta') continue;
    const field = asField(canonical[key]);
    if (field) out[key] = field;
    if (Object.keys(out).length >= 36) break;
  }
  return out;
}

function compactCharts(payload = {}) {
  const series = Array.isArray(payload.appPayload?.charts?.series) ? payload.appPayload.charts.series
    : Array.isArray(payload.chartSeries?.series) ? payload.chartSeries.series
    : [];
  return series.slice(0, 6).map((s, index) => {
    const points = Array.isArray(s.points) ? s.points : [];
    const sampled = samplePoints(points, 80).map(point => compactPoint(point));
    return {
      key: s.key || `series_${index + 1}`,
      name: s.name || s.key || `Série ${index + 1}`,
      kind: payload.appRenderContract?.chartTemplates?.[index]?.kind || inferKind(s),
      pointCount: Number(s.pointCount || points.length || 0),
      sampledPointCount: sampled.length,
      unit: s.unit || payload.appRenderContract?.chartTemplates?.[index]?.yUnit || null,
      points: sampled,
    };
  });
}

function samplePoints(points = [], limit = 80) {
  if (!Array.isArray(points) || points.length <= limit) return points;
  const step = Math.max(1, Math.ceil(points.length / limit));
  const sampled = [];
  for (let i = 0; i < points.length; i += step) sampled.push(points[i]);
  const last = points[points.length - 1];
  if (last && sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled.slice(0, limit);
}

function compactPoint(point = {}) {
  if (Array.isArray(point)) return point.slice(0, 6);
  if (!point || typeof point !== 'object') return point;
  const out = {};
  for (const key of ['x','y','date','label','value','open','high','low','close','volume']) {
    if (point[key] !== undefined) out[key] = point[key];
  }
  if (point.ohlc && typeof point.ohlc === 'object') out.ohlc = point.ohlc;
  return out;
}

function inferKind(series = {}) {
  const key = String(series.key || series.name || '').toLowerCase();
  if (/ohlc|candle/.test(key)) return 'candlestick';
  if (/volume|dividend|rendimento|provento|yield/.test(key)) return 'bar';
  return 'line';
}

function buildPanels(payload = {}) {
  const cards = Array.isArray(payload.appRenderContract?.cards) ? payload.appRenderContract.cards : [];
  const readiness = Array.isArray(payload.appPayload?.panels) ? payload.appPayload.panels : [];
  const readinessByKey = Object.fromEntries(readiness.map(p => [p.key, p]));
  return cards.map(card => ({
    key: card.key,
    state: card.state,
    ready: card.state === 'ready' || Boolean(readinessByKey[card.key]?.ready),
    completenessPercent: readinessByKey[card.key]?.completenessPercent ?? (card.state === 'ready' ? 100 : card.state === 'partial' ? 55 : 0),
    primaryPath: card.primaryPath || null,
  }));
}

function buildDividends(payload = {}) {
  const dividends = payload.appPayload?.dividends || {};
  const history = Array.isArray(dividends.history) ? dividends.history : [];
  return {
    dy: dividends.dy ?? null,
    dyDisplay: dividends.dyDisplay ?? null,
    lastIncome: dividends.lastIncome ?? null,
    lastIncomeDisplay: dividends.lastIncomeDisplay ?? null,
    historyCount: dividends.historyCount || history.length || 0,
    recentHistory: history.slice(0, 24),
  };
}


function buildRevenueBreakdowns(payload = {}) {
  const charts = payload.appPayload?.charts || {};
  return {
    revenueGeography: charts.revenueGeography || charts.regioesReceita || charts.revenueByRegion || charts.revenueBreakdowns?.geography || charts.revenueBreakdowns?.byRegion || charts.revenueBreakdowns?.regions || null,
    regioesReceita: charts.regioesReceita || charts.revenueGeography || charts.revenueByRegion || charts.revenueBreakdowns?.regioesReceita || charts.revenueBreakdowns?.geography || null,
    revenueByRegion: charts.revenueByRegion || charts.revenueGeography || charts.regioesReceita || charts.revenueBreakdowns?.byRegion || charts.revenueBreakdowns?.regions || null,
    geography: charts.revenueBreakdowns?.geography || charts.revenueGeography || charts.regioesReceita || null,
    byRegion: charts.revenueBreakdowns?.byRegion || charts.revenueByRegion || charts.revenueGeography || null,
    regions: charts.revenueBreakdowns?.regions || charts.revenueByRegion || charts.revenueGeography || null,
    revenueSegment: charts.revenueSegment || charts.revenueByBusiness || charts.negociosReceita || charts.revenueBreakdowns?.revenueSegment || charts.revenueBreakdowns?.business || null,
    revenueByBusiness: charts.revenueByBusiness || charts.revenueSegment || charts.negociosReceita || charts.revenueBreakdowns?.revenueByBusiness || charts.revenueBreakdowns?.business || null,
    negociosReceita: charts.negociosReceita || charts.revenueByBusiness || charts.revenueSegment || charts.revenueBreakdowns?.negociosReceita || charts.revenueBreakdowns?.business || null,
    segmentosReceita: charts.segmentosReceita || charts.revenueByBusiness || charts.revenueSegment || charts.revenueBreakdowns?.segmentosReceita || charts.revenueBreakdowns?.segments || null,
    business: charts.revenueBreakdowns?.business || charts.revenueByBusiness || charts.revenueSegment || null,
    byBusiness: charts.revenueBreakdowns?.byBusiness || charts.revenueByBusiness || charts.revenueSegment || null,
    segments: charts.revenueBreakdowns?.segments || charts.segmentosReceita || charts.revenueByBusiness || null,
    sourceTrace: charts.revenueBreakdowns?.sourceTrace || null,
  };
}

export function buildAppMobileSnapshot(payload = {}) {
  const metrics = compactMetrics(payload);
  const charts = compactCharts(payload);
  const quote = {
    ticker: payload.ticker,
    type: payload.type,
    name: payload.appPayload?.quote?.name || payload.results?.nome || payload.results?.name || payload.ticker,
    price: payload.appPayload?.quote?.price ?? metrics.precoAtual?.value ?? null,
    priceDisplay: payload.appPayload?.quote?.priceDisplay ?? metrics.precoAtual?.display ?? null,
    dayChange: payload.appPayload?.quote?.dayChange ?? metrics.variacaoDay?.value ?? null,
    dayChangeDisplay: payload.appPayload?.quote?.dayChangeDisplay ?? metrics.variacaoDay?.display ?? null,
    source: payload.appPayload?.quote?.source || payload.appPayload?.source?.primary || payload.sourceReport?.primarySource || null,
  };
  const decision = payload.appSyncEnvelope?.decision || {};
  const body = {
    version: VALORAE_APP_MOBILE_SNAPSHOT_VERSION,
    generatedAt: payload.metrics?.generatedAt || payload.appPayload?.generatedAt || new Date().toISOString(),
    ticker: payload.ticker,
    type: payload.type,
    status: payload.status,
    quote,
    metrics,
    panels: buildPanels(payload),
    charts,
    revenueBreakdowns: buildRevenueBreakdowns(payload),
    dividends: buildDividends(payload),
    sync: {
      action: decision.action || null,
      renderSafe: Boolean(decision.renderSafe || payload.appDataContract?.renderSafe),
      canReplacePreviousSnapshot: Boolean(decision.canReplacePreviousSnapshot || payload.appDataContract?.canReplacePreviousSnapshot),
      shouldShowPartialBanner: Boolean(decision.shouldShowPartialBanner || payload.appDataContract?.uiGuards?.showPartialBanner),
      score: decision.score ?? payload.appDataContract?.score ?? null,
      payloadHash: payload.appSyncEnvelope?.identity?.payloadHash || null,
    },
    source: {
      primary: payload.appPayload?.source?.primary || payload.sourceReport?.primarySource || null,
      cacheStatus: payload.cacheStatus || payload.appDataContract?.freshness?.cacheStatus || null,
      badge: payload.appDataContract?.freshness?.badge || null,
      sourcesUsed: payload.appPayload?.source?.sourcesUsed || payload.sourceReport?.sourcesUsed || [],
    },
  };
  return {
    ...body,
    snapshotHash: stableHash(body),
    appInstructions: {
      preferredForFirstPaint: true,
      safeRootForMobileLists: 'appMobileSnapshot',
      hydrateFullDetailsFrom: ['appPayload', 'appRenderContract', 'appDataContract', 'results'],
      maxChartPointsPerSeries: 80,
    },
  };
}
