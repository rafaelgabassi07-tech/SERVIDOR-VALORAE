import { createHash } from 'node:crypto';
import { approximateSiteKey, isPrivateOrSpecialHost, isPrivateOrSpecialIpAddress } from './network-safety.js';
import { sanitizeCapturedJson, VALORAE_CAPTURED_JSON_SAFETY_POLICY } from './json-safety.js';

export const VALORAE_NETWORK_JSON_CAPTURE_POLICY = 'known-host-bounded-sanitized-json-response-capture-v2';
export const VALORAE_NETWORK_JSON_CAPTURE_IMPLEMENTATION = 'playwright-response-events-sanitized-json-gap-fill-v2';

const DEFAULT_API_HINT = /(?:\/api\/|graphql|ajax|xhr|chart|series|histor|indicador|balanco|dividend|provento|cotacao|compare|financial|fundamental|portfolio|vacan|payout)/i;
const SENSITIVE_PATH = /(?:^|\/)(?:auth|login|logout|oauth|token|session|captcha|password|register|signup|signin|signout|account\/me|user\/me)(?:\/|$)/i;
const SENSITIVE_QUERY_KEY = /(?:token|auth|secret|password|passwd|session|cookie|email|cpf|key)/i;


function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? Math.floor(number) : fallback));
}

function safeStoredUrl(rawUrl = '') {
  let url;
  try { url = new URL(String(rawUrl || '')); } catch { return ''; }
  if (url.protocol !== 'https:' || url.username || url.password || isPrivateOrSpecialHost(url.hostname)) return '';
  if (SENSITIVE_PATH.test(url.pathname)) return '';
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEY.test(key)) return '';
  }
  url.username = '';
  url.password = '';
  url.hash = '';
  // Query values can contain opaque identifiers. The financial endpoint classifier only
  // needs origin + path, so captured diagnostics never persist query strings.
  url.search = '';
  return url.toString();
}

function responseAllowed(rawUrl = '', targetHost = '', allowedHosts = []) {
  let url;
  try { url = new URL(String(rawUrl || '')); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || isPrivateOrSpecialHost(url.hostname)) return false;
  const host = url.hostname.toLowerCase();
  if (approximateSiteKey(host) === approximateSiteKey(targetHost)) return true;
  const allowed = allowedHosts instanceof Set
    ? allowedHosts
    : new Set((allowedHosts || []).map(value => String(value || '').trim().toLowerCase()).filter(Boolean));
  return allowed.has(host);
}

function contentTypeJson(value = '') {
  return /(?:^|\s|;)(?:application|text)\/(?:[a-z0-9.+-]*\+)?json(?:\s|;|$)/i.test(String(value || ''));
}

function apiLikeUrl(value = '') {
  try { return DEFAULT_API_HINT.test(new URL(String(value || '')).pathname); }
  catch { return false; }
}

function finiteContentLength(headers = {}) {
  const raw = Number(headers?.['content-length'] || headers?.['Content-Length']);
  return Number.isFinite(raw) && raw >= 0 ? raw : null;
}

function parseJsonObject(buffer) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function responseHeaders(response) {
  try {
    const headers = response.headers?.();
    return headers && typeof headers === 'object' ? headers : {};
  } catch { return {}; }
}

function requestInfo(response) {
  try {
    const request = response.request?.();
    return {
      method: String(request?.method?.() || 'GET').toUpperCase(),
      resourceType: String(request?.resourceType?.() || '').toLowerCase(),
    };
  } catch {
    return { method: 'GET', resourceType: '' };
  }
}

export function createNetworkJsonCollector({
  targetUrl = '',
  allowedHosts = [],
  maxDocuments = 24,
  maxDocumentBytes = 512 * 1024,
  maxTotalBytes = 2 * 1024 * 1024,
  maxPending = 48,
  settleTimeoutMs = 1_500,
  requireServerAddress = true,
} = {}) {
  let target;
  try { target = new URL(String(targetUrl || '')); } catch { target = null; }
  const limits = {
    maxDocuments: boundedInteger(maxDocuments, 24, 1, 128),
    maxDocumentBytes: boundedInteger(maxDocumentBytes, 512 * 1024, 1_024, 4 * 1024 * 1024),
    maxTotalBytes: boundedInteger(maxTotalBytes, 2 * 1024 * 1024, 4_096, 16 * 1024 * 1024),
    maxPending: boundedInteger(maxPending, 48, 4, 256),
    settleTimeoutMs: boundedInteger(settleTimeoutMs, 1_500, 50, 15_000),
  };
  limits.maxDocumentBytes = Math.min(limits.maxDocumentBytes, limits.maxTotalBytes);
  const documents = [];
  const pending = new Set();
  const allowedHostSet = new Set((allowedHosts || []).map(value => String(value || '').trim().toLowerCase()).filter(Boolean));
  let observing = true;
  let sealed = false;
  const seen = new Set();
  const metrics = {
    observed: 0,
    accepted: 0,
    skippedStatus: 0,
    skippedHost: 0,
    skippedSensitive: 0,
    skippedAddress: 0,
    skippedType: 0,
    skippedSize: 0,
    parseFailures: 0,
    duplicateDocuments: 0,
    serverAddressChecks: 0,
    serverAddressUnavailable: 0,
    capturedBytes: 0,
    skippedBackpressure: 0,
    settleTimeouts: 0,
    sensitiveFieldsRemoved: 0,
    secretValuesRemoved: 0,
    personalValuesRemoved: 0,
    prototypeKeysRemoved: 0,
    complexityRejected: 0,
  };

  async function inspect(response) {
    metrics.observed += 1;
    if (sealed || !target || documents.length >= limits.maxDocuments || metrics.capturedBytes >= limits.maxTotalBytes) return;
    let status = 0;
    let rawUrl = '';
    try {
      status = Number(response.status?.() || 0);
      rawUrl = String(response.url?.() || '');
    } catch { return; }
    if (status < 200 || status >= 300) { metrics.skippedStatus += 1; return; }
    if (!responseAllowed(rawUrl, target.hostname, allowedHostSet)) { metrics.skippedHost += 1; return; }
    const storedUrl = safeStoredUrl(rawUrl);
    if (!storedUrl) { metrics.skippedSensitive += 1; return; }
    let serverAddress = null;
    try {
      serverAddress = typeof response.serverAddr === 'function' ? await response.serverAddr() : null;
    } catch {
      serverAddress = null;
    }
    if (serverAddress?.ipAddress) {
      metrics.serverAddressChecks += 1;
      if (isPrivateOrSpecialIpAddress(serverAddress.ipAddress)) { metrics.skippedAddress += 1; return; }
    } else {
      metrics.serverAddressUnavailable += 1;
      if (requireServerAddress) { metrics.skippedAddress += 1; return; }
    }
    const headers = responseHeaders(response);
    const contentType = String(headers['content-type'] || headers['Content-Type'] || '').slice(0, 160);
    const { method, resourceType } = requestInfo(response);
    const eligibleResource = ['xhr', 'fetch', 'document'].includes(resourceType) || !resourceType;
    if (!eligibleResource || (!contentTypeJson(contentType) && !apiLikeUrl(rawUrl))) { metrics.skippedType += 1; return; }
    const declaredLength = finiteContentLength(headers);
    if (declaredLength !== null && declaredLength > limits.maxDocumentBytes) { metrics.skippedSize += 1; return; }
    let body;
    try { body = await response.body(); }
    catch { metrics.parseFailures += 1; return; }
    const bytes = Buffer.byteLength(body);
    if (!bytes || bytes > limits.maxDocumentBytes || metrics.capturedBytes + bytes > limits.maxTotalBytes) { metrics.skippedSize += 1; return; }
    const parsed = parseJsonObject(body);
    if (!parsed) { metrics.parseFailures += 1; return; }
    const sanitized = sanitizeCapturedJson(parsed);
    metrics.sensitiveFieldsRemoved += Number(sanitized.metrics?.sensitiveFieldsRemoved || 0);
    metrics.secretValuesRemoved += Number(sanitized.metrics?.secretValuesRemoved || 0);
    metrics.personalValuesRemoved += Number(sanitized.metrics?.personalValuesRemoved || 0);
    metrics.prototypeKeysRemoved += Number(sanitized.metrics?.prototypeKeysRemoved || 0);
    if (!sanitized.ok) { metrics.complexityRejected += 1; return; }
    const data = sanitized.data;
    const serialized = JSON.stringify(data);
    const sanitizedBytes = Buffer.byteLength(serialized, 'utf8');
    if (sealed || documents.length >= limits.maxDocuments || !sanitizedBytes || sanitizedBytes > limits.maxDocumentBytes || metrics.capturedBytes + sanitizedBytes > limits.maxTotalBytes) { metrics.skippedSize += 1; return; }
    const fingerprint = createHash('sha256').update(storedUrl).update('\0').update(serialized).digest('base64url').slice(0, 28);
    if (seen.has(fingerprint)) { metrics.duplicateDocuments += 1; return; }
    seen.add(fingerprint);
    documents.push({
      id: `network-json-${documents.length + 1}-${fingerprint.slice(0, 8)}`,
      kind: 'network-json',
      source: 'playwright-response',
      url: storedUrl,
      status,
      method,
      resourceType: resourceType || undefined,
      contentType: contentType || 'application/json',
      bytes: sanitizedBytes,
      serverAddressVerified: Boolean(serverAddress?.ipAddress),
      data,
    });
    metrics.accepted += 1;
    metrics.capturedBytes += sanitizedBytes;
  }

  function observe(response) {
    if (!observing || sealed) return;
    if (pending.size >= limits.maxPending) { metrics.skippedBackpressure += 1; return; }
    const task = inspect(response).catch(() => { metrics.parseFailures += 1; });
    pending.add(task);
    task.then(() => pending.delete(task), () => pending.delete(task));
  }

  async function settle() {
    observing = false;
    if (!pending.size) { sealed = true; return documents; }
    let timer;
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => resolve('timeout'), limits.settleTimeoutMs);
    });
    const completed = Promise.allSettled([...pending]).then(() => 'completed');
    const outcome = await Promise.race([completed, timeout]);
    clearTimeout(timer);
    if (outcome === 'timeout') metrics.settleTimeouts += 1;
    sealed = true;
    return documents;
  }

  function diagnostics() {
    return {
      policyVersion: VALORAE_NETWORK_JSON_CAPTURE_POLICY,
      implementation: VALORAE_NETWORK_JSON_CAPTURE_IMPLEMENTATION,
      ...metrics,
      documents: documents.length,
      ...limits,
      requireServerAddress,
      jsonSafetyPolicy: VALORAE_CAPTURED_JSON_SAFETY_POLICY,
    };
  }

  return { observe, settle, documents, diagnostics };
}

export const _test = { boundedInteger, safeStoredUrl, responseAllowed, contentTypeJson, apiLikeUrl, parseJsonObject, isPrivateOrSpecialHost, isPrivateOrSpecialIpAddress };
