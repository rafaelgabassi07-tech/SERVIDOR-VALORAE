import { round } from '../core/numbers.js';

function pointTimestamp(point = {}) {
  const direct = Number(point.timestamp);
  if (Number.isFinite(direct) && direct > 0) return direct > 10_000_000_000 ? Math.floor(direct / 1000) : Math.floor(direct);
  const raw = point.date || point.time || point.month || '';
  const millis = typeof raw === 'number' ? raw : Date.parse(/^\d{4}-\d{2}$/.test(String(raw)) ? `${raw}-01T00:00:00.000Z` : String(raw));
  return Number.isFinite(millis) ? Math.floor(millis / 1000) : null;
}

function normalizePoints(points = []) {
  const byTimestamp = new Map();
  for (const point of Array.isArray(points) ? points : []) {
    const timestamp = pointTimestamp(point);
    const value = Number(point.returnPercent ?? point.value);
    if (!Number.isFinite(timestamp) || !Number.isFinite(value)) continue;
    byTimestamp.set(timestamp, {
      ...point,
      timestamp,
      date: point.date || new Date(timestamp * 1000).toISOString().slice(0, 10),
      value: round(value, 4),
      returnPercent: round(value, 4)
    });
  }
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function rebasePoint(point, baseReturn) {
  const current = Number(point.returnPercent ?? point.value);
  const baseFactor = 1 + baseReturn / 100;
  const currentFactor = 1 + current / 100;
  const rebased = baseFactor > 0 ? ((currentFactor / baseFactor) - 1) * 100 : current - baseReturn;
  const value = round(rebased, 4);
  return { ...point, value, returnPercent: value };
}

/**
 * Restricts all comparison series to the same real temporal window and rebases
 * each one at its first retained observation. No interpolation or synthetic
 * observations are created; different sampling frequencies remain explicit.
 */
export function alignComparisonSeriesToSharedWindow(series = []) {
  const normalized = (Array.isArray(series) ? series : [])
    .map(item => ({ ...item, points: normalizePoints(item?.points) }))
    .filter(item => item.points.length >= 2);
  if (normalized.length < 2) return normalized;

  const sharedStart = Math.max(...normalized.map(item => item.points[0].timestamp));
  const sharedEnd = Math.min(...normalized.map(item => item.points.at(-1).timestamp));
  if (!Number.isFinite(sharedStart) || !Number.isFinite(sharedEnd) || sharedEnd <= sharedStart) return normalized;

  const aligned = normalized.map(item => {
    const retained = item.points.filter(point => point.timestamp >= sharedStart && point.timestamp <= sharedEnd);
    if (retained.length < 2) return null;
    const base = Number(retained[0].returnPercent ?? retained[0].value);
    return {
      ...item,
      points: retained.map(point => rebasePoint(point, base)),
      alignedWindow: { startTimestamp: sharedStart, endTimestamp: sharedEnd }
    };
  }).filter(Boolean);

  return aligned.length >= 2 ? aligned : normalized;
}

export const _test = { pointTimestamp, normalizePoints, rebasePoint };
