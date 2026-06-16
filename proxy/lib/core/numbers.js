export function numberValue(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return fallback;
  let s = String(value).trim();
  if (!s || s === '-') return fallback;
  s = s.replace(/R\$|%|\s/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

export function round(value, places = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** places;
  return Math.round(n * p) / p;
}
