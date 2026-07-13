const UNTRUSTED_HISTORY_SOURCE = /(ultimo\s+snapshot\s+conhecido|último\s+snapshot\s+conhecido|last[_ -]?known|mock|fixture|synthetic|sint[eé]tic|simulad|proxy\s*ticker|ticker\s*substitut|etf\s*proxy|reconstructed\s+from\s+yahoo\s+snapshot)/i;

function historyRows(history = {}) {
  const candidates = [history.points, history.history, history.series, history.prices, history.chartHistory];
  return candidates.find(Array.isArray) || [];
}

function pointHasUntrustedMarker(point = {}) {
  if (!point || typeof point !== 'object') return false;
  if (point.simulated === true || point.synthetic === true || point.proxyTickerUsed === true
    || point.reconstructedFromYahooSnapshot === true || point.yahooSnapshotComparisonOnly === true
    || point.staticFallback === true || point.lastKnownFallback === true) return true;
  return UNTRUSTED_HISTORY_SOURCE.test(String(point.source || point.provider || point.warning || ''));
}

export function inspectRealHistoryIntegrity(history = {}) {
  const rows = historyRows(history);
  const topLevelReasons = [];
  if (history?.simulated === true) topLevelReasons.push('simulated');
  if (history?.synthetic === true) topLevelReasons.push('synthetic');
  if (history?.proxyTickerUsed === true) topLevelReasons.push('proxy_ticker');
  if (history?.reconstructedFromYahooSnapshot === true || history?.yahooSnapshotComparisonOnly === true) topLevelReasons.push('snapshot_curve');
  if (history?.staticFallback === true || history?.lastKnownFallback === true) topLevelReasons.push('static_fallback');
  if (UNTRUSTED_HISTORY_SOURCE.test(String(history?.source || history?.provider || history?.warning || ''))) topLevelReasons.push('untrusted_source_label');
  const untrustedPoints = rows.filter(pointHasUntrustedMarker).length;
  if (untrustedPoints) topLevelReasons.push('untrusted_points');
  return {
    trusted: topLevelReasons.length === 0,
    reason: topLevelReasons[0] || '',
    reasons: [...new Set(topLevelReasons)],
    pointCount: rows.length,
    untrustedPoints
  };
}

export function isTrustedRealHistory(history = {}) {
  return inspectRealHistoryIntegrity(history).trusted;
}
