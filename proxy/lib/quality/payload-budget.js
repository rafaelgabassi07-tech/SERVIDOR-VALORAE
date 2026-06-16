// Orçamento de payload e performance v21.12.29.
// Mede peso aproximado por raiz e orienta view=app/compact/full sem I/O externo.

export const VALORAE_PAYLOAD_BUDGET_VERSION = '21.12.29-payload-budget';

function bytes(v) { try { return Buffer.byteLength(JSON.stringify(v ?? null), 'utf8'); } catch { return 0; } }
function pct(part, total) { return total ? Math.round((part / total) * 10000) / 100 : 0; }
function arr(v) { return Array.isArray(v) ? v : []; }
function rootEntries(payload = {}) {
  return Object.keys(payload || {}).map(key => ({ key, bytes: bytes(payload[key]) })).sort((a, b) => b.bytes - a.bytes);
}
function classify(totalBytes = 0) {
  if (totalBytes <= 70000) return 'excellent_mobile';
  if (totalBytes <= 160000) return 'good_app';
  if (totalBytes <= 320000) return 'acceptable_detail';
  return 'heavy_debug_only';
}
function routePlan(view, totalBytes) {
  if (/app|compact|mobile|watchlist|list|instant|fast/.test(String(view || ''))) return totalBytes <= 180000 ? 'ok_for_mobile' : 'reduce_or_use_snapshot';
  if (/full|analysis|debug|detail/.test(String(view || ''))) return 'debug_or_detail_only';
  return totalBytes <= 240000 ? 'ok' : 'prefer_view_app';
}

export function buildPayloadBudget(payload = {}, options = {}) {
  const totalBytes = bytes(payload);
  const entries = rootEntries(payload);
  const heavyRoots = entries.filter(e => e.bytes > 25000).slice(0, 12);
  const chartPoints = arr(payload.chartSeries?.series || payload.appPayload?.charts?.series || payload.appMobileSnapshot?.charts?.series).reduce((n, s) => n + arr(s?.points || s?.data || s?.values).length, 0);
  const view = options.view || payload.view || payload.requestedView || 'full';
  const state = classify(totalBytes);
  const suggestions = [];
  if (totalBytes > 180000) suggestions.push('Use view=app para Web/APK e deixe full apenas para auditoria.');
  if (heavyRoots.some(r => r.key === 'results')) suggestions.push('Mantenha results fora do contrato principal do app e consuma appPayload/appMobileSnapshot.');
  if (chartPoints > 800) suggestions.push('Use appMobileSnapshot.charts amostrado para primeira pintura e hidrate séries completas sob demanda.');
  if (!payload.appMobileSnapshot) suggestions.push('Ative appMobileSnapshot para reduzir custo de primeira renderização.');
  if (!suggestions.length) suggestions.push('Orçamento saudável para uso pessoal/controlado.');
  return {
    version: VALORAE_PAYLOAD_BUDGET_VERSION,
    generatedAt: payload.metrics?.generatedAt || new Date().toISOString(),
    ticker: payload.ticker,
    type: payload.type,
    view,
    totalBytesApprox: totalBytes,
    state,
    routePlan: routePlan(view, totalBytes),
    thresholds: { excellentMobile: 70000, goodApp: 160000, acceptableDetail: 320000 },
    rootWeights: entries.slice(0, 24).map(e => ({ ...e, percent: pct(e.bytes, totalBytes) })),
    heavyRoots,
    signals: {
      roots: entries.length,
      chartPoints,
      hasMobileSnapshot: Boolean(payload.appMobileSnapshot),
      hasAppPayload: Boolean(payload.appPayload),
      hasFullResults: Boolean(payload.results),
    },
    suggestions,
    appGuidance: {
      firstPaint: 'appMobileSnapshot',
      hydrate: 'appPayload',
      debug: 'full',
      safeDefaultView: 'app',
    },
  };
}
