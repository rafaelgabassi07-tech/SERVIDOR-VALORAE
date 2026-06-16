// Classificação leve de erros do Engine para retry, circuit breaker e diagnóstico didático.
// Sem dependências externas; segura para Vercel Free.
export const VALORAE_ERROR_CLASSIFIER_VERSION = '21.11.1-error-classifier-source-intelligence';

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const FINAL_STATUS = new Set([400, 401, 403, 404, 410, 415, 422]);

export function classifyNetworkError(err = {}) {
  const name = String(err?.name || '').toLowerCase();
  const msg = String(err?.message || err || '').toLowerCase();
  if (name === 'aborterror' || /timeout|timed out|aborted/.test(msg)) return 'TIMEOUT';
  if (/dns|enotfound|getaddrinfo|eai_again/.test(msg)) return 'DNS_ERROR';
  if (/tls|certificate|ssl|handshake/.test(msg)) return 'TLS_ERROR';
  if (/socket|econnreset|network|fetch failed/.test(msg)) return 'NETWORK_ERROR';
  return 'UNKNOWN_NETWORK_ERROR';
}

export function classifyHttpStatus(status) {
  const n = Number(status || 0);
  if (!n) return 'NO_STATUS';
  if (n === 401) return 'HTTP_401';
  if (n === 403) return 'HTTP_403';
  if (n === 404) return 'HTTP_404';
  if (n === 410) return 'HTTP_410';
  if (n === 429) return 'HTTP_429';
  if (n >= 500) return 'HTTP_5XX';
  if (n >= 400) return 'HTTP_4XX';
  if (n >= 300) return 'HTTP_3XX';
  return 'HTTP_OK';
}

export function detectSourceSignals({ html = '', contentType = '', error = '' } = {}) {
  const sample = `${String(error || '')}\n${String(html || '').slice(0, 5000)}`.toLowerCase();
  const type = String(contentType || '').toLowerCase();
  const signals = [];
  if (type && !/text\/html|application\/xhtml\+xml|text\/plain|application\/json/.test(type)) signals.push('INVALID_CONTENT_TYPE');
  if (/cloudflare|captcha|access denied|forbidden|waf|blocked|robot|verify you are human|cf-chl|challenge-platform|turnstile|akamai|datadome|perimeterx|incapsula|distil networks|please enable javascript/.test(sample)) signals.push('WAF_DETECTED');
  if (/rate limit|too many requests|limite de requisi[cç][oõ]es|temporarily unavailable/.test(sample)) signals.push('RATE_LIMIT_SIGNAL');
  if (/maintenance|manuten[cç][aã]o|servi[cç]o indispon[ií]vel/.test(sample)) signals.push('SOURCE_MAINTENANCE');
  if (!String(html || '').trim()) signals.push('EMPTY_HTML');
  return signals;
}

export function isRetryableStatus(status) {
  const n = Number(status || 0);
  if (!n) return true;
  if (FINAL_STATUS.has(n)) return false;
  return RETRYABLE_STATUS.has(n) || n >= 500;
}

export function classifyFetchOutcome({ status = 0, ok = false, contentType = '', html = '', error = null, blocked = false } = {}) {
  const signals = detectSourceSignals({ html, contentType, error: error?.message || error });
  const statusType = classifyHttpStatus(status);
  const networkType = error ? classifyNetworkError(error) : null;
  let type = networkType || statusType;
  if (Number(status) === 429 || signals.includes('RATE_LIMIT_SIGNAL')) type = 'HTTP_429';
  else if (signals.includes('WAF_DETECTED') || blocked || [401, 403].includes(Number(status || 0))) type = 'WAF_DETECTED';
  else if (signals.includes('INVALID_CONTENT_TYPE')) type = 'INVALID_CONTENT_TYPE';
  else if (!ok && signals.includes('EMPTY_HTML')) type = 'EMPTY_HTML';
  const retryable = networkType ? true : (type === 'HTTP_429' || signals.includes('SOURCE_MAINTENANCE') ? true : (type === 'WAF_DETECTED' ? false : isRetryableStatus(status)));
  const confidence = ok ? 1 : (signals.length ? 0.92 : (networkType ? 0.8 : 0.7));
  const severity = ok ? 'ok' : (retryable ? 'transient' : 'final');
  return {
    version: VALORAE_ERROR_CLASSIFIER_VERSION,
    type,
    status: Number(status || 0),
    retryable,
    severity,
    blocked: type === 'WAF_DETECTED' || blocked,
    signals,
    message: error?.message || (ok ? undefined : type),
    confidence,
  };
}

export function shouldRetryFetch(outcome = {}) {
  if (typeof outcome === 'number') return isRetryableStatus(outcome);
  return Boolean(outcome.retryable);
}
