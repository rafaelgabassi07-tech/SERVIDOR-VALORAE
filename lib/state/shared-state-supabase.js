import {
  DEFAULT_SHARED_STATE_REMOTE_COOLDOWN_MS,
  DEFAULT_SHARED_STATE_REMOTE_TIMEOUT_MS,
  intValue,
  isoTime,
  keyValue,
  namespaceValue,
  scopeValue,
  sharedStateRuntime,
  supabaseConfig,
  tableValue,
} from './shared-state-foundation.js';

/** Checkpoint 116: driver Supabase isolado do espelho local e da API pública. */
function markRemoteSuccess() {
  sharedStateRuntime.remoteLastError = null;
  sharedStateRuntime.remoteUnavailableUntil = 0;
  sharedStateRuntime.remoteLastSuccessAt = isoTime(Date.now());
}

function markRemoteFailure(error) {
  sharedStateRuntime.metrics.remoteErrors += 1;
  sharedStateRuntime.remoteLastError = {
    at: isoTime(Date.now()),
    code: String(error?.code || error?.status || 'SHARED_STATE_REMOTE_ERROR').slice(0, 80),
    message: String(error?.message || 'Falha no estado compartilhado remoto.').slice(0, 240),
  };
  const cooldownMs = intValue(process.env.VALORAE_SHARED_STATE_REMOTE_COOLDOWN_MS, DEFAULT_SHARED_STATE_REMOTE_COOLDOWN_MS, 1000, 10 * 60 * 1000);
  sharedStateRuntime.remoteUnavailableUntil = Date.now() + cooldownMs;
}

export async function sharedStateRemoteRequest(path, init = {}) {
  const cfg = supabaseConfig();
  if (!cfg.configured) {
    const error = new Error('Supabase não configurado para estado compartilhado.');
    error.code = 'SHARED_STATE_NOT_CONFIGURED';
    throw error;
  }
  const timeoutMs = intValue(process.env.VALORAE_SHARED_STATE_REMOTE_TIMEOUT_MS, DEFAULT_SHARED_STATE_REMOTE_TIMEOUT_MS, 250, 10000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await globalThis.fetch(`${cfg.url}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: cfg.key,
        authorization: `Bearer ${cfg.key}`,
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!response.ok) {
      const error = new Error(json?.message || json?.hint || text.slice(0, 240) || `Supabase HTTP ${response.status}`);
      error.status = response.status;
      error.code = json?.code || `SHARED_STATE_HTTP_${response.status}`;
      throw error;
    }
    markRemoteSuccess();
    return json;
  } catch (error) {
    const normalized = error?.name === 'AbortError'
      ? Object.assign(new Error(`Estado compartilhado remoto excedeu ${timeoutMs}ms.`), { code: 'SHARED_STATE_REMOTE_TIMEOUT', cause: error })
      : error;
    markRemoteFailure(normalized);
    throw normalized;
  } finally {
    clearTimeout(timer);
  }
}

export function sharedStateRemoteSelectPath(namespace, key) {
  const params = new URLSearchParams({
    select: 'scope,namespace,state_key,value,version,checksum,owner,created_at,updated_at,expires_at',
    scope: `eq.${scopeValue()}`,
    namespace: `eq.${namespaceValue(namespace)}`,
    state_key: `eq.${keyValue(key)}`,
    limit: '1',
  });
  return `/rest/v1/${tableValue()}?${params.toString()}`;
}
