import crypto from 'node:crypto';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, getInput } from '../lib/http/route.js';
import { VALORAE_ENGINE_VERSION, VALORAE_RELEASE_PATCH } from '../lib/release/current.js';
import { normalizeTicker } from '../lib/core/tickers.js';

// Release patch: 21.12.395-minimal-financial-sync-v363
const CORE_VERSION = VALORAE_RELEASE_PATCH;
const SYNC_CONTRACT = 'valorae-financial-sync-v2';
const TRANSACTIONS_TABLE = 'valorae_financial_transactions';
const DIVIDENDS_TABLE = 'valorae_financial_dividends';
const DOWNLOAD_RPC = 'valorae_financial_download_v2';
const STATUS_RPC = 'valorae_financial_status_v2';
const UPLOAD_TRANSACTIONS_RPC = 'valorae_financial_upload_transactions_v2';
const UPLOAD_DIVIDENDS_RPC = 'valorae_financial_upload_dividends_v2';
const DELETE_RPC = 'valorae_financial_delete_v2';

const SYNC_CAPABILITIES = Object.freeze([
  'health',
  'diagnostics',
  'auth_check',
  'download_financial_data',
  'upload_transactions',
  'upload_dividends',
  'delete_financial_data',
  'get_financial_status',
]);

const runtime = globalThis.__VALORAE_MINIMAL_FINANCIAL_SYNC__ || {
  authTokens: new Map(),
  metrics: {
    authCacheHits: 0,
    authCacheMisses: 0,
    authUpstreamCalls: 0,
    downloads: 0,
    transactionUploads: 0,
    dividendUploads: 0,
    deletions: 0,
    snapshotWritesSuppressed: 0,
  },
};
globalThis.__VALORAE_MINIMAL_FINANCIAL_SYNC__ = runtime;

function cleanUrl(raw = '') {
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(?:rest|auth|storage|functions)\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

function getSupabaseConfig() {
  const url = cleanUrl(process.env.SUPABASE_URL || process.env.VALORAE_SUPABASE_URL || '');
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VALORAE_SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  const publicKey = String(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VALORAE_SUPABASE_PUBLISHABLE_KEY ||
    key ||
    ''
  ).trim();
  return {
    url,
    key,
    publicKey,
    configured: url.startsWith('https://') && Boolean(key),
    authConfigured: url.startsWith('https://') && Boolean(publicKey),
  };
}

function header(req, name) {
  return String(req.headers?.[name] || req.headers?.[name.toLowerCase()] || '').trim();
}

function authorizationBearer(req) {
  const match = header(req, 'authorization').match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function authCacheTtlMs() {
  return Math.min(Math.max(Number(process.env.VALORAE_SYNC_AUTH_CACHE_MS || 300_000), 30_000), 900_000);
}

function tokenCacheKey(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function jwtExpiryMs(token) {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    const exp = Number(json?.exp);
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function trimAuthCache() {
  const now = Date.now();
  for (const [key, entry] of runtime.authTokens.entries()) {
    if (!entry || Number(entry.expiresAt || 0) <= now) runtime.authTokens.delete(key);
  }
  while (runtime.authTokens.size > 300) runtime.authTokens.delete(runtime.authTokens.keys().next().value);
}

function readCachedAuth(token) {
  trimAuthCache();
  const entry = runtime.authTokens.get(tokenCacheKey(token));
  if (!entry || entry.expiresAt <= Date.now()) return undefined;
  runtime.metrics.authCacheHits += 1;
  return entry.user;
}

function cacheAuth(token, user) {
  const now = Date.now();
  const jwtExpiry = jwtExpiryMs(token);
  runtime.authTokens.set(tokenCacheKey(token), {
    user,
    expiresAt: Math.min(now + authCacheTtlMs(), jwtExpiry ? Math.max(now + 1_000, jwtExpiry - 30_000) : now + authCacheTtlMs()),
  });
  trimAuthCache();
}

function supabaseTimeoutMs() {
  return Math.min(Math.max(Number(process.env.VALORAE_SYNC_SUPABASE_TIMEOUT_MS || 20_000), 3_000), 45_000);
}

function retryAfterMs(response) {
  const seconds = Number(response?.headers?.get?.('retry-after'));
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : null;
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchWithDeadline(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Supabase timeout')), supabaseTimeoutMs());
  timer.unref?.();
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (cause) {
    const error = new Error('O Supabase não respondeu dentro do tempo limite.');
    error.status = 503;
    error.code = 'SUPABASE_TIMEOUT';
    error.retryable = true;
    error.retryAfterMs = 15_000;
    error.cause = cause;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonResponse(response, fallbackCode) {
  let text = '';
  try { text = await response.text(); } catch {}
  let json = null;
  if (text) {
    try { json = JSON.parse(text); } catch {
      if (response.ok) {
        const error = new Error('O Supabase retornou JSON inválido.');
        error.status = 502;
        error.code = 'SUPABASE_INVALID_RESPONSE';
        error.retryable = true;
        throw error;
      }
    }
  }
  if (!response.ok) {
    const error = new Error(json?.message || json?.hint || text || `Supabase HTTP ${response.status}`);
    error.status = response.status;
    error.code = json?.code || fallbackCode || 'SUPABASE_HTTP_ERROR';
    error.details = json || text;
    error.retryable = isRetryableStatus(response.status);
    error.retryAfterMs = retryAfterMs(response);
    throw error;
  }
  return json;
}

async function supabaseFetch(path, init = {}) {
  const config = getSupabaseConfig();
  if (!config.configured) {
    const error = new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Proxy.');
    error.status = 503;
    error.code = 'SUPABASE_NOT_CONFIGURED';
    error.retryable = false;
    throw error;
  }
  const response = await fetchWithDeadline(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      ...(init.headers || {}),
    },
  });
  return parseJsonResponse(response, 'SUPABASE_HTTP_ERROR');
}

async function verifySupabaseBearer(req) {
  const config = getSupabaseConfig();
  const token = authorizationBearer(req);
  if (!token || !config.authConfigured) return null;
  const cached = readCachedAuth(token);
  if (cached !== undefined) return cached;
  runtime.metrics.authCacheMisses += 1;
  runtime.metrics.authUpstreamCalls += 1;
  const response = await fetchWithDeadline(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.publicKey,
      authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401 || response.status === 403) {
    cacheAuth(token, null);
    return null;
  }
  const user = await parseJsonResponse(response, 'SUPABASE_AUTH_UNAVAILABLE');
  if (!user?.id) {
    const error = new Error('O Supabase Auth não retornou a identidade da sessão.');
    error.status = 502;
    error.code = 'SUPABASE_AUTH_INVALID_RESPONSE';
    error.retryable = true;
    throw error;
  }
  const normalized = { id: String(user.id), email: String(user.email || '') };
  cacheAuth(token, normalized);
  return normalized;
}

async function requireAuthenticatedUser(req) {
  const user = await verifySupabaseBearer(req);
  if (user?.id) return user;
  const error = new Error('Sessão Supabase inválida ou expirada. Entre novamente no APK.');
  error.status = 401;
  error.code = authorizationBearer(req) ? 'SUPABASE_BEARER_INVALID' : 'AUTH_TOKEN_MISSING';
  error.retryable = false;
  throw error;
}

async function parseJsonBody(req) {
  const maxBytes = Math.min(Math.max(Number(process.env.VALORAE_SYNC_MAX_BODY_BYTES || 2 * 1024 * 1024), 16_384), 8 * 1024 * 1024);
  if (req.body && typeof req.body === 'object') {
    if (Buffer.byteLength(JSON.stringify(req.body), 'utf8') > maxBytes) throw bodyError('Payload grande demais.', 413, 'SYNC_PAYLOAD_TOO_LARGE');
    return req.body;
  }
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > maxBytes) throw bodyError('Payload grande demais.', 413, 'SYNC_PAYLOAD_TOO_LARGE');
    if (!req.body.trim()) return {};
    try { return JSON.parse(req.body); } catch { throw bodyError('Corpo JSON inválido.', 400, 'INVALID_JSON_BODY'); }
  }
  if (!req?.on) return {};
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw bodyError('Payload grande demais.', 413, 'SYNC_PAYLOAD_TOO_LARGE');
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw bodyError('Corpo JSON inválido.', 400, 'INVALID_JSON_BODY'); }
}

function bodyError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.retryable = false;
  return error;
}

async function callRpc(name, args) {
  try {
    return await supabaseFetch(`/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch (error) {
    const details = `${error?.message || ''} ${JSON.stringify(error?.details || '')}`;
    if (error?.code === 'PGRST202' || /could not find the function|schema cache/i.test(details)) {
      error.status = 503;
      error.code = 'MINIMAL_SYNC_MIGRATION_REQUIRED';
      error.retryable = false;
      error.message = 'Execute supabase/013_valorae_minimal_financial_sync_v2.sql antes de usar esta versão do Proxy.';
    }
    throw error;
  }
}

function cleanText(value, max = 160) {
  return String(value ?? '').trim().slice(0, max);
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedClientId(row = {}) {
  const supplied = cleanText(row.clientTxId || row.client_tx_id || row.id, 96).replace(/[^A-Za-z0-9:_-]/g, '');
  if (supplied) return supplied;
  const seed = [row.symbol || row.ticker, row.date || row.transaction_date, row.operation || row.side, row.quantity, row.price, row.grossValue || row.gross_value, row.source].join('|');
  return `valorae-${crypto.createHash('sha256').update(seed).digest('hex')}`.slice(0, 96);
}

function normalizeTransactionSymbols(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeTicker).filter(Boolean))];
}

function normalizeTransaction(row = {}) {
  const symbol = normalizeTicker(row.symbol || row.ticker || '').slice(0, 24);
  const quantity = Math.max(0, finiteNumber(row.quantity));
  const price = Math.max(0, finiteNumber(row.price ?? row.purchase_price));
  const grossValue = Math.max(0, finiteNumber(row.grossValue ?? row.gross_value, quantity * price));
  return {
    clientTxId: normalizedClientId(row),
    date: cleanText(row.date || row.transaction_date, 40),
    operation: cleanText(row.operation || row.side || 'MOVIMENTAÇÃO', 48).toUpperCase(),
    symbol,
    assetType: cleanText(row.assetType || row.asset_type || 'Outro', 80),
    quantity,
    price,
    grossValue: grossValue > 0 ? grossValue : quantity * price,
    source: cleanText(row.source || 'VALORAE', 120),
    importedAt: row.importedAt ?? row.imported_at ?? null,
  };
}

function normalizedEventId(row = {}) {
  const supplied = cleanText(row.eventId || row.event_id || row.eventKey || row.event_key || row.id, 96).replace(/[^A-Za-z0-9:_-]/g, '');
  if (supplied) return supplied;
  const seed = [
    normalizeTicker(row.ticker || row.symbol || ''),
    row.dateCom || row.date_com || '',
    row.exDate || row.ex_date || '',
    row.inferredComDate || row.inferred_com_date || '',
    row.paymentDate || row.payment_date || '',
    cleanText(row.source || 'VALORAE', 120).toUpperCase(),
  ].join('|');
  return `div-${crypto.createHash('sha256').update(seed).digest('hex')}`.slice(0, 96);
}

function normalizeDividend(row = {}) {
  return {
    eventId: normalizedEventId(row),
    ticker: normalizeTicker(row.ticker || row.symbol || '').slice(0, 24),
    dateCom: cleanText(row.dateCom || row.date_com, 40),
    exDate: cleanText(row.exDate || row.ex_date, 40),
    inferredComDate: cleanText(row.inferredComDate || row.inferred_com_date, 40),
    eligibilityDateSource: cleanText(row.eligibilityDateSource || row.eligibility_date_source, 80),
    paymentDate: cleanText(row.paymentDate || row.payment_date, 40),
    valuePerShare: Math.max(0, finiteNumber(row.valuePerShare ?? row.value_per_share)),
    quantity: Math.max(0, finiteNumber(row.quantity)),
    estimatedAmount: Math.max(0, finiteNumber(row.estimatedAmount ?? row.estimated_amount)),
    status: cleanText(row.status || 'oficial', 48),
    source: cleanText(row.source || 'VALORAE', 120),
  };
}

function normalizeRpcObject(raw) {
  if (Array.isArray(raw)) return raw[0] || {};
  return raw && typeof raw === 'object' ? raw : {};
}

function syncStateFrom(result = {}) {
  const transactionsVersion = Math.max(0, Number(result.transactions_version ?? result.transactionsVersion) || 0);
  const dividendsVersion = Math.max(0, Number(result.dividends_version ?? result.dividendsVersion) || 0);
  return {
    revision: Math.max(transactionsVersion, dividendsVersion),
    deletionGeneration: 0,
    deletion_generation: 0,
    tombstone: false,
    deletedAt: null,
    deleted_at: null,
    updatedAt: result.updated_at || null,
    updated_at: result.updated_at || null,
  };
}

async function downloadFinancialData(userId) {
  runtime.metrics.downloads += 1;
  const result = normalizeRpcObject(await callRpc(DOWNLOAD_RPC, { p_user_id: userId }));
  if (result.contract !== SYNC_CONTRACT) {
    const error = new Error('A RPC do Supabase não retornou o contrato financeiro v2.');
    error.status = 502;
    error.code = 'MINIMAL_SYNC_CONTRACT_MISMATCH';
    error.retryable = false;
    throw error;
  }
  const transactions = Array.isArray(result.transactions) ? result.transactions : [];
  const dividends = Array.isArray(result.dividends) ? result.dividends : [];
  const transactionsCount = Number(result.transactions_count ?? transactions.length) || 0;
  const dividendsCount = Number(result.dividends_count ?? dividends.length) || 0;
  return {
    ok: true,
    contract: SYNC_CONTRACT,
    restoreContract: SYNC_CONTRACT,
    restore_contract: SYNC_CONTRACT,
    restoreSource: DOWNLOAD_RPC,
    restore_source: DOWNLOAD_RPC,
    identitySource: 'supabase_user_id',
    identity_source: 'supabase_user_id',
    transactions,
    dividends,
    count: transactionsCount,
    transactionsCount,
    transactions_count: transactionsCount,
    totalCount: transactionsCount,
    total_count: transactionsCount,
    dividendsCount,
    dividends_count: dividendsCount,
    verifiedEmpty: transactionsCount === 0,
    verified_empty: transactionsCount === 0,
    transactionsVersion: Number(result.transactions_version || 0),
    transactions_version: Number(result.transactions_version || 0),
    dividendsVersion: Number(result.dividends_version || 0),
    dividends_version: Number(result.dividends_version || 0),
    syncState: syncStateFrom(result),
  };
}

async function uploadTransactions(userId, input, action) {
  const sourceRows = Array.isArray(input.transactions) ? input.transactions : Array.isArray(input.rows) ? input.rows : [];
  const rows = sourceRows.map(normalizeTransaction).filter(row => row.symbol && row.date && (row.quantity > 0 || row.grossValue > 0));
  const replacement = action === 'replace_transactions_for_symbols' || input.mode === 'replace_symbols';
  const symbols = replacement
    ? [...new Set((Array.isArray(input.symbols) ? input.symbols : []).map(normalizeTicker).filter(Boolean))]
    : [];
  runtime.metrics.transactionUploads += 1;
  const result = normalizeRpcObject(await callRpc(UPLOAD_TRANSACTIONS_RPC, {
    p_user_id: userId,
    p_rows: rows,
    p_replace_symbols: symbols.length ? symbols : null,
  }));
  return {
    ok: result.ok !== false,
    contract: SYNC_CONTRACT,
    count: Number(result.count || 0),
    deleted: Number(result.deleted || 0),
    message: `Histórico sincronizado: ${Number(result.count || 0)} alteração(ões), ${Number(result.deleted || 0)} remoção(ões).`,
    syncState: syncStateFrom(result),
  };
}

async function uploadDividends(userId, input) {
  const sourceRows = Array.isArray(input.events) ? input.events : Array.isArray(input.dividends) ? input.dividends : [];
  const rows = sourceRows.map(normalizeDividend).filter(row => row.ticker && (row.dateCom || row.exDate || row.inferredComDate || row.paymentDate));
  runtime.metrics.dividendUploads += 1;
  const result = normalizeRpcObject(await callRpc(UPLOAD_DIVIDENDS_RPC, {
    p_user_id: userId,
    p_rows: rows,
    p_replace_all: input.replaceAll !== false && input.replace_all !== false,
  }));
  return {
    ok: result.ok !== false,
    contract: SYNC_CONTRACT,
    count: Number(result.count || 0),
    deleted: Number(result.deleted || 0),
    message: `Dividendos sincronizados: ${Number(result.count || 0)} alteração(ões), ${Number(result.deleted || 0)} remoção(ões).`,
    syncState: syncStateFrom(result),
  };
}

async function financialStatus(userId) {
  const result = normalizeRpcObject(await callRpc(STATUS_RPC, { p_user_id: userId }));
  return {
    ok: true,
    contract: SYNC_CONTRACT,
    transactionsCount: Number(result.transactions_count || 0),
    dividendsCount: Number(result.dividends_count || 0),
    syncState: syncStateFrom(result),
  };
}

async function deleteFinancialData(userId) {
  runtime.metrics.deletions += 1;
  const result = normalizeRpcObject(await callRpc(DELETE_RPC, { p_user_id: userId }));
  return {
    ok: result.ok !== false,
    contract: SYNC_CONTRACT,
    count: Number(result.count || 0),
    message: 'Histórico de transações e dividendos removido da nuvem.',
    syncState: syncStateFrom(result),
  };
}

function statusForError(error) {
  return Number.isInteger(error?.status) ? Math.min(Math.max(error.status, 400), 599) : 500;
}

function errorMeta(error) {
  const status = statusForError(error);
  return {
    status,
    code: cleanText(error?.code || `SYNC_HTTP_${status}`, 120),
    retryable: typeof error?.retryable === 'boolean' ? error.retryable : isRetryableStatus(status),
    retryAfterMs: Number.isFinite(Number(error?.retryAfterMs)) ? Math.max(0, Number(error.retryAfterMs)) : null,
  };
}

function applyResponseHeaders(res, meta) {
  res.setHeader('X-Valorae-Sync-Code', meta.code);
  res.setHeader('X-Valorae-Sync-Retryable', meta.retryable ? 'true' : 'false');
  if (meta.retryAfterMs > 0) res.setHeader('Retry-After', String(Math.max(1, Math.ceil(meta.retryAfterMs / 1000))));
}

function send(req, res, payload, status = 200) {
  return sendJson(req, res, payload, {
    status,
    engineVersion: VALORAE_ENGINE_VERSION,
    profile: 'minimal-financial-sync',
    cacheControl: 'no-store',
  });
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, {
    version: VALORAE_ENGINE_VERSION,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    route: 'sync',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_SYNC_MAX || 60),
    maxBodyBytes: Number(process.env.VALORAE_SYNC_MAX_BODY_BYTES || 2 * 1024 * 1024),
    profile: 'minimal-financial-sync',
    cacheControl: 'no-store',
  });
  if (route.done) return;
  if (req.method === 'OPTIONS') return res.status(200).end();

  const config = getSupabaseConfig();
  const query = getInput(req) || {};
  let action = String(query.action || req.query?.action || (req.method === 'GET' ? 'health' : 'download_financial_data')).trim().toLowerCase();

  try {
    const body = req.method === 'POST' || req.method === 'DELETE' ? await parseJsonBody(req) : {};
    const input = { ...query, ...body };
    action = String(input.action || action).trim().toLowerCase();

    if (action === 'health') {
      return send(req, res, {
        ok: true,
        version: VALORAE_ENGINE_VERSION,
        patch: CORE_VERSION,
        requestId: route.requestId,
        route: '/api/sync',
        contract: SYNC_CONTRACT,
        supabase: {
          configured: config.configured,
          authConfigured: config.authConfigured,
          transactionsTable: TRANSACTIONS_TABLE,
          dividendsTable: DIVIDENDS_TABLE,
          cloudMode: 'minimal_financial_only',
          snapshotsEnabled: false,
          backupsEnabled: false,
          monitorPersistenceEnabled: false,
          sharedRuntimeStateEnabled: false,
        },
        capabilities: SYNC_CAPABILITIES,
        resourceGuard: { ...runtime.metrics },
      });
    }

    if (action === 'diagnostics' || action === 'self_test' || action === 'ping') {
      const configured = config.configured && config.authConfigured;
      const hasBearer = Boolean(authorizationBearer(req));
      let authenticated = false;
      let migrationReady = null;
      let status = null;
      if (configured && hasBearer) {
        const user = await requireAuthenticatedUser(req);
        status = await financialStatus(user.id);
        authenticated = true;
        migrationReady = true;
      }
      const ok = configured && (!hasBearer || (authenticated && migrationReady));
      const meta = {
        status: ok ? 200 : 503,
        code: ok ? (migrationReady ? 'MINIMAL_SYNC_READY' : 'MINIMAL_SYNC_CONFIG_OK') : 'SUPABASE_NOT_CONFIGURED',
        retryable: false,
        retryAfterMs: null,
      };
      applyResponseHeaders(res, meta);
      return send(req, res, {
        ok,
        configured: config.configured,
        authenticated,
        migrationReady,
        authMode: 'supabase_auth',
        version: VALORAE_ENGINE_VERSION,
        patch: CORE_VERSION,
        requestId: route.requestId,
        contract: SYNC_CONTRACT,
        capabilities: SYNC_CAPABILITIES,
        transactionsCount: status?.transactionsCount ?? null,
        dividendsCount: status?.dividendsCount ?? null,
        tables: [
          { table: TRANSACTIONS_TABLE, ok, accessible: ok, rowsChecked: status?.transactionsCount ?? 0 },
          { table: DIVIDENDS_TABLE, ok, accessible: ok, rowsChecked: status?.dividendsCount ?? 0 },
        ],
        message: !configured
          ? 'Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e a chave pública do Supabase.'
          : migrationReady
            ? 'Sincronização financeira mínima pronta e validada no Supabase.'
            : 'Proxy configurado. Faça o diagnóstico autenticado para validar a migration 013.',
      }, meta.status);
    }

    if (action === 'auth_check') {
      const user = await requireAuthenticatedUser(req);
      return send(req, res, {
        ok: true,
        authenticated: true,
        authMode: 'supabase_auth',
        code: 'AUTH_OK',
        contract: SYNC_CONTRACT,
        requestId: route.requestId,
        message: 'Sessão Supabase validada pelo Proxy.',
        userId: user.id,
      });
    }

    if (!config.configured) {
      const error = new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Proxy.');
      error.status = 503;
      error.code = 'SUPABASE_NOT_CONFIGURED';
      error.retryable = false;
      throw error;
    }

    const user = await requireAuthenticatedUser(req);
    let result;

    if (['download_financial_data', 'restore_transactions', 'get_transactions'].includes(action)) {
      result = await downloadFinancialData(user.id);
      if (action === 'get_transactions') result = { ...result, dividends: undefined, events: undefined };
    } else if (action === 'get_dividend_events') {
      const data = await downloadFinancialData(user.id);
      result = {
        ok: true,
        contract: SYNC_CONTRACT,
        events: data.dividends,
        dividends: data.dividends,
        count: data.dividendsCount,
        syncState: data.syncState,
      };
    } else if (['upload_transactions', 'upsert_transactions', 'replace_transactions_for_symbols'].includes(action)) {
      result = await uploadTransactions(user.id, input, action);
    } else if (['upload_dividends', 'upsert_dividend_events'].includes(action)) {
      result = await uploadDividends(user.id, input);
    } else if (['delete_financial_data', 'delete_user_data'].includes(action)) {
      result = await deleteFinancialData(user.id);
    } else if (['get_financial_status', 'get_sync_state'].includes(action)) {
      result = await financialStatus(user.id);
    } else if (['upsert_snapshot', 'upsert_snapshots'].includes(action)) {
      runtime.metrics.snapshotWritesSuppressed += 1;
      result = {
        ok: true,
        contract: SYNC_CONTRACT,
        count: 0,
        featureDisabled: true,
        message: 'Snapshots em nuvem foram desativados para reduzir o uso do Supabase.',
        syncState: syncStateFrom({}),
      };
    } else if (['get_snapshot', 'get_snapshots'].includes(action)) {
      result = { ok: true, contract: SYNC_CONTRACT, snapshots: [], count: 0, featureDisabled: true };
    } else if (action === 'get_sync_backups') {
      result = { ok: true, contract: SYNC_CONTRACT, backups: [], count: 0, featureDisabled: true };
    } else if (action === 'register_client') {
      result = { ok: true, contract: SYNC_CONTRACT, count: 0, message: 'Registro de dispositivo não é necessário; a sessão Supabase é a única identidade.' };
    } else {
      const error = new Error('Ação não suportada pela sincronização financeira mínima.');
      error.status = 400;
      error.code = 'UNKNOWN_SYNC_ACTION';
      error.retryable = false;
      throw error;
    }

    return send(req, res, {
      version: VALORAE_ENGINE_VERSION,
      patch: CORE_VERSION,
      requestId: route.requestId,
      authMode: 'supabase_auth',
      action,
      ...result,
    });
  } catch (error) {
    const meta = errorMeta(error);
    applyResponseHeaders(res, meta);
    return send(req, res, {
      ok: false,
      version: VALORAE_ENGINE_VERSION,
      patch: CORE_VERSION,
      requestId: route.requestId,
      action,
      contract: SYNC_CONTRACT,
      code: meta.code,
      retryable: meta.retryable,
      retryAfterMs: meta.retryAfterMs,
      message: error?.message || 'Não foi possível sincronizar agora.',
      details: process.env.NODE_ENV === 'production' ? undefined : error?.details,
    }, meta.status);
  }
}

export const _test = {
  cleanUrl,
  normalizeTransaction,
  normalizeDividend,
  normalizedClientId,
  normalizedEventId,
  syncStateFrom,
  errorMeta,
  isRetryableStatus,
  isRetryableSyncStatus: isRetryableStatus,
  normalizeSingleTransactionSymbol: normalizeTicker,
  normalizeTransactionSymbols,
  storedTransactionToClient: normalizeTransaction,
};
