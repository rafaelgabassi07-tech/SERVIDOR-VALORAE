export const VALORAE_RESPONSE_SHAPE_VERSION = '21.11.0-response-shape-fields-compact';

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).toLowerCase());
}

function isEmpty(value) {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  if (typeof value === 'string') return value.length === 0;
  return false;
}

function fieldList(input = {}) {
  const raw = Array.isArray(input.fields) ? input.fields.join(',') : String(input.fields || '');
  return raw.split(',').map(x => x.trim()).filter(Boolean);
}

function getPath(obj, path) {
  return String(path || '').split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
}

function setPath(obj, path, value) {
  const parts = String(path || '').split('.').filter(Boolean);
  if (!parts.length) return;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    cur[parts[i]] = cur[parts[i]] && typeof cur[parts[i]] === 'object' ? cur[parts[i]] : {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

export function compactPayload(payload, preserveKeys = new Set()) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map(v => compactPayload(v, preserveKeys)).filter(v => !isEmpty(v));
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    const next = compactPayload(value, preserveKeys);
    if (isEmpty(next) && !preserveKeys.has(key)) continue;
    out[key] = next;
  }
  return out;
}

export function applyFields(payload, fields = []) {
  const list = Array.isArray(fields) ? fields : String(fields || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!list.length || list.includes('*') || list.includes('all')) return payload;
  const out = {};
  for (const key of ['version', 'requestId', 'ok', 'status', 'error']) {
    if (payload?.[key] !== undefined) out[key] = payload[key];
  }
  for (const path of list) {
    const value = getPath(payload, path);
    if (value !== undefined) setPath(out, path, value);
  }
  return out;
}

export function applyPreviewControls(payload, input = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const previewChars = Math.max(0, Math.min(Number(input.previewChars ?? process.env.VALORAE_DEFAULT_PREVIEW_CHARS ?? 300), 5000));
  const out = { ...payload };
  if (!out.html && typeof out.htmlPreview === 'string') out.htmlPreview = previewChars > 0 ? out.htmlPreview.slice(0, previewChars) : undefined;
  if (out.html && input.includeHtml !== true && input.returnHtml !== true) delete out.html;
  if (previewChars <= 0) delete out.htmlPreview;
  return out;
}

export function shapeResponsePayload(payload, input = {}) {
  let out = applyPreviewControls(payload, input);
  const fields = fieldList(input);
  out = applyFields(out, fields);
  const preserve = new Set(fields.map(f => String(f).split('.')[0]).filter(Boolean));
  if (bool(input.compact, false)) out = compactPayload(out, preserve);
  return out;
}
