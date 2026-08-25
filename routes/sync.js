import crypto from 'node:crypto';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, getInput } from '../lib/http/route.js';
import { VALORAE_ENGINE_VERSION, VALORAE_RELEASE_PATCH } from '../lib/release/current.js';
import { RELEASE } from '../lib/core/release.js';
import { normalizeTicker } from '../lib/core/tickers.js';

// Release patch: 21.12.409-asset-modal-contract-alignment-v428
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
    legacyWriteBlocks: 0,
    rpcFallbacks: 0,
    rpcFallbackFailures: 0,
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

function assertCompatibleEcosystemContract(req) {
  const received = header(req, 'x-valorae-ecosystem-contract');
  if (!received) return;
  const compatible = new Set([
    RELEASE.ecosystemContract,
    ...(Array.isArray(RELEASE.compatibleEcosystemContracts) ? RELEASE.compatibleEcosystemContracts : []),
  ].filter(Boolean));
  if (compatible.has(received)) return;
  const error = new Error('O APK e o Proxy pertencem a contratos de ecossistema incompatíveis.');
  error.status = 426;
  error.code = 'ECOSYSTEM_CONTRACT_MISMATCH';
  error.retryable = false;
  error.details = {
    received,
    expected: RELEASE.ecosystemContract,
    compatible: [...compatible],
  };
  throw error;
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
  const raw = String(response?.headers?.get?.('retry-after') || '').trim();
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const target = Date.parse(raw);
  return Number.isFinite(target) ? Math.max(0, target - Date.now()) : null;
}

function syncMaxResponseBytes() {
  return Math.min(
    Math.max(Number(process.env.VALORAE_SYNC_MAX_RESPONSE_BYTES || 8 * 1024 * 1024), 64 * 1024),
    32 * 1024 * 1024
  );
}

function supabaseResponseError(message, code, retryable = false) {
  const error = new Error(message);
  error.status = 502;
  error.code = code;
  error.retryable = retryable;
  return error;
}

async function readBoundedResponseText(response) {
  const maxBytes = syncMaxResponseBytes();
  const declared = Number(response?.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw supabaseResponseError('O Supabase retornou dados acima do limite seguro.', 'SUPABASE_RESPONSE_TOO_LARGE');
  }
  try {
    if (response?.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value || []);
        total += chunk.length;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw supabaseResponseError('O Supabase retornou dados acima do limite seguro.', 'SUPABASE_RESPONSE_TOO_LARGE');
        }
        chunks.push(chunk);
      }
      return Buffer.concat(chunks, total).toString('utf8');
    }
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw supabaseResponseError('O Supabase retornou dados acima do limite seguro.', 'SUPABASE_RESPONSE_TOO_LARGE');
    }
    return text;
  } catch (error) {
    if (error?.code === 'SUPABASE_RESPONSE_TOO_LARGE') throw error;
    const wrapped = supabaseResponseError('Não foi possível ler a resposta do Supabase.', 'SUPABASE_BODY_READ_FAILED', true);
    wrapped.cause = error;
    throw wrapped;
  }
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
    const timedOut = controller.signal.aborted || cause?.name === 'AbortError';
    const error = new Error(timedOut
      ? 'O Supabase não respondeu dentro do tempo limite.'
      : 'Não foi possível conectar ao Supabase.');
    error.status = 503;
    error.code = timedOut ? 'SUPABASE_TIMEOUT' : 'SUPABASE_NETWORK_ERROR';
    error.retryable = true;
    error.retryAfterMs = timedOut ? 15_000 : 5_000;
    error.cause = cause;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonResponse(response, fallbackCode) {
  const text = await readBoundedResponseText(response);
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
    error.retryable = true;
    error.retryAfterMs = 15 * 60 * 1000;
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

function errorDetails(error) {
  return `${error?.message || ''} ${JSON.stringify(error?.details || '')}`;
}

function isMissingRpcError(error) {
  const details = errorDetails(error);
  return error?.code === 'PGRST202' || /could not find the function|schema cache.*function/i.test(details);
}

function isMissingRelationError(error) {
  const details = errorDetails(error);
  return error?.code === 'PGRST205' || error?.code === '42P01' ||
    /could not find the table|relation .* does not exist|schema cache.*table/i.test(details);
}

function migrationRequiredError(cause = null) {
  const error = new Error('A estrutura financeira v2 ainda não está disponível no Supabase. Execute supabase/00_cloud_transaction_recovery.sql e publique novamente o Proxy.');
  error.status = 503;
  error.code = 'MINIMAL_SYNC_MIGRATION_REQUIRED';
  // A infraestrutura pode ser corrigida sem atualizar o APK. A fila local deve voltar a tentar
  // automaticamente depois do deploy, em vez de permanecer bloqueada como uma falha de login.
  error.retryable = true;
  error.retryAfterMs = 15 * 60 * 1000;
  error.cause = cause || undefined;
  error.details = cause?.details || cause?.message || undefined;
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
    const details = errorDetails(error);
    if (/\b(?:(?:INVALID|IVALID)_TRANSACTION_ROWS|INVALID_TRANSACTIONS_PAYLOAD)\b/i.test(details)) {
      error.status = 422;
      error.code = 'SYNC_TRANSACTION_ROWS_REJECTED';
      error.retryable = false;
      error.message = 'Uma ou mais transações possuem data, ticker ou valores inválidos; o Histórico anterior foi preservado.';
    } else if (/\b(?:INVALID_DIVIDEND_ROWS|INVALID_DIVIDENDS_PAYLOAD)\b/i.test(details)) {
      error.status = 422;
      error.code = 'SYNC_DIVIDEND_ROWS_REJECTED';
      error.retryable = false;
      error.message = 'Um ou mais proventos possuem ticker ou datas inválidas; o histórico anterior foi preservado.';
    } else if (isMissingRpcError(error)) {
      error.status = 503;
      error.code = 'SYNC_RPC_MISSING';
      error.retryable = true;
      error.retryAfterMs = 15 * 60 * 1000;
      error.message = `A RPC ${name} não está no schema cache; tentando o caminho REST seguro.`;
    }
    throw error;
  }
}

async function callRpcWithRestFallback(name, args, fallback) {
  try {
    return await callRpc(name, args);
  } catch (error) {
    if (error?.code !== 'SYNC_RPC_MISSING') throw error;
    runtime.metrics.rpcFallbacks += 1;
    try {
      return await fallback();
    } catch (fallbackError) {
      runtime.metrics.rpcFallbackFailures += 1;
      if (isMissingRelationError(fallbackError) || fallbackError?.code === 'SYNC_RPC_MISSING') {
        throw migrationRequiredError(fallbackError);
      }
      throw fallbackError;
    }
  }
}

function restQuery(table, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const suffix = query.toString();
  return `/rest/v1/${table}${suffix ? `?${suffix}` : ''}`;
}

function tableTransactionRow(userId, row) {
  return {
    user_id: userId,
    client_tx_id: row.clientTxId,
    transaction_date: row.date,
    operation: row.operation,
    symbol: row.symbol,
    asset_type: row.assetType || 'Outro',
    quantity: finiteNumber(row.quantity),
    price: finiteNumber(row.price),
    gross_value: finiteNumber(row.grossValue),
    source: row.source || 'VALORAE',
    imported_at: row.importedAt || null,
    updated_at: new Date().toISOString(),
  };
}

function clientTransactionRow(row = {}) {
  return {
    clientTxId: cleanText(row.client_tx_id, 96),
    date: cleanText(row.transaction_date, 40),
    operation: cleanText(row.operation, 48),
    symbol: normalizeTicker(row.symbol),
    assetType: cleanText(row.asset_type || 'Outro', 80),
    quantity: finiteNumber(row.quantity),
    price: finiteNumber(row.price),
    grossValue: finiteNumber(row.gross_value),
    source: cleanText(row.source || 'VALORAE', 120),
    importedAt: row.imported_at || null,
    updatedAt: row.updated_at || null,
  };
}

function tableDividendRow(userId, row) {
  return {
    user_id: userId,
    event_id: row.eventId,
    ticker: row.ticker,
    date_com: row.dateCom || null,
    ex_date: row.exDate || null,
    inferred_com_date: row.inferredComDate || null,
    eligibility_date_source: row.eligibilityDateSource || null,
    payment_date: row.paymentDate || null,
    value_per_share: finiteNumber(row.valuePerShare),
    quantity: finiteNumber(row.quantity),
    estimated_amount: finiteNumber(row.estimatedAmount),
    gross_value_per_share: finiteNumber(row.grossValuePerShare),
    net_value_per_share: finiteNumber(row.netValuePerShare),
    tax_rate: finiteNumber(row.taxRate),
    tax_withheld_per_share: finiteNumber(row.taxWithheldPerShare),
    gross_amount: finiteNumber(row.grossAmount),
    net_amount: finiteNumber(row.netAmount),
    tax_withheld_amount: finiteNumber(row.taxWithheldAmount),
    tax_rule: cleanText(row.taxRule, 120),
    status: row.status || 'oficial',
    source: row.source || 'VALORAE',
    updated_at: new Date().toISOString(),
  };
}

function clientDividendRow(row = {}) {
  return {
    eventId: cleanText(row.event_id, 96),
    ticker: normalizeTicker(row.ticker),
    dateCom: cleanText(row.date_com, 40),
    exDate: cleanText(row.ex_date, 40),
    inferredComDate: cleanText(row.inferred_com_date, 40),
    eligibilityDateSource: cleanText(row.eligibility_date_source, 80),
    paymentDate: cleanText(row.payment_date, 40),
    valuePerShare: finiteNumber(row.value_per_share),
    quantity: finiteNumber(row.quantity),
    estimatedAmount: finiteNumber(row.estimated_amount),
    grossValuePerShare: finiteNumber(row.gross_value_per_share),
    netValuePerShare: finiteNumber(row.net_value_per_share),
    taxRate: finiteNumber(row.tax_rate),
    taxWithheldPerShare: finiteNumber(row.tax_withheld_per_share),
    grossAmount: finiteNumber(row.gross_amount),
    netAmount: finiteNumber(row.net_amount),
    taxWithheldAmount: finiteNumber(row.tax_withheld_amount),
    taxRule: cleanText(row.tax_rule, 120),
    status: cleanText(row.status || 'oficial', 48),
    source: cleanText(row.source || 'VALORAE', 120),
    updatedAt: row.updated_at || null,
  };
}

function latestTimestamp(rows = []) {
  return rows.reduce((latest, row) => {
    const candidate = Date.parse(row?.updated_at || row?.updatedAt || '');
    return Number.isFinite(candidate) ? Math.max(latest, candidate) : latest;
  }, 0);
}

function directSyncState(transactions = [], dividends = []) {
  const transactionsVersion = latestTimestamp(transactions);
  const dividendsVersion = latestTimestamp(dividends);
  return {
    ok: true,
    contract: SYNC_CONTRACT,
    transactions_version: transactionsVersion,
    dividends_version: dividendsVersion,
    updated_at: new Date(Math.max(transactionsVersion, dividendsVersion, Date.now())).toISOString(),
  };
}

async function directDownloadFinancialData(userId) {
  const [transactions, dividends] = await Promise.all([
    supabaseFetch(restQuery(TRANSACTIONS_TABLE, {
      select: 'client_tx_id,transaction_date,operation,symbol,asset_type,quantity,price,gross_value,source,imported_at,updated_at',
      user_id: `eq.${userId}`,
      order: 'transaction_date.asc,client_tx_id.asc',
    })),
    supabaseFetch(restQuery(DIVIDENDS_TABLE, {
      select: 'event_id,ticker,date_com,ex_date,inferred_com_date,eligibility_date_source,payment_date,value_per_share,quantity,estimated_amount,gross_value_per_share,net_value_per_share,tax_rate,tax_withheld_per_share,gross_amount,net_amount,tax_withheld_amount,tax_rule,status,source,updated_at',
      user_id: `eq.${userId}`,
      order: 'payment_date.asc,event_id.asc',
    })),
  ]);
  const txRows = Array.isArray(transactions) ? transactions : [];
  const dividendRows = Array.isArray(dividends) ? dividends : [];
  return {
    ...directSyncState(txRows, dividendRows),
    transactions: txRows.map(clientTransactionRow),
    dividends: dividendRows.map(clientDividendRow),
    transactions_count: txRows.length,
    dividends_count: dividendRows.length,
    transport: 'postgrest-fallback',
  };
}

async function directFinancialStatus(userId) {
  const data = await directDownloadFinancialData(userId);
  return {
    ...directSyncState(data.transactions, data.dividends),
    transactions_count: data.transactions_count,
    dividends_count: data.dividends_count,
    transport: 'postgrest-fallback',
  };
}

function chunk(values = [], size = 50) {
  const output = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

async function deleteRowsByIds(table, userId, key, ids = []) {
  let deleted = 0;
  for (const group of chunk([...new Set(ids.filter(Boolean))])) {
    if (!group.length) continue;
    const removed = await supabaseFetch(restQuery(table, {
      select: key,
      user_id: `eq.${userId}`,
      [key]: `in.(${group.join(',')})`,
    }), {
      method: 'DELETE',
      headers: { prefer: 'return=representation' },
    });
    deleted += Array.isArray(removed) ? removed.length : group.length;
  }
  return deleted;
}

async function directUploadTransactions(userId, rows, replaceSymbols = []) {
  let deleted = 0;
  if (replaceSymbols.length) {
    for (const symbol of replaceSymbols) {
      const existing = await supabaseFetch(restQuery(TRANSACTIONS_TABLE, {
        select: 'client_tx_id',
        user_id: `eq.${userId}`,
        symbol: `eq.${symbol}`,
      }));
      const keep = new Set(rows.filter(row => row.symbol === symbol).map(row => row.clientTxId));
      const stale = (Array.isArray(existing) ? existing : [])
        .map(row => cleanText(row?.client_tx_id, 96))
        .filter(id => id && !keep.has(id));
      deleted += await deleteRowsByIds(TRANSACTIONS_TABLE, userId, 'client_tx_id', stale);
    }
  }
  let stored = [];
  if (rows.length) {
    stored = await supabaseFetch(restQuery(TRANSACTIONS_TABLE, {
      on_conflict: 'user_id,client_tx_id',
      select: 'client_tx_id,updated_at',
    }), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(rows.map(row => tableTransactionRow(userId, row))),
    });
  }
  const returned = Array.isArray(stored) ? stored : [];
  return {
    ...directSyncState(returned, []),
    count: rows.length,
    deleted,
    transport: 'postgrest-fallback',
  };
}

async function directUploadDividends(userId, rows, replaceAll) {
  let deleted = 0;
  if (replaceAll) {
    const existing = await supabaseFetch(restQuery(DIVIDENDS_TABLE, {
      select: 'event_id',
      user_id: `eq.${userId}`,
    }));
    const keep = new Set(rows.map(row => row.eventId));
    const stale = (Array.isArray(existing) ? existing : [])
      .map(row => cleanText(row?.event_id, 96))
      .filter(id => id && !keep.has(id));
    deleted = await deleteRowsByIds(DIVIDENDS_TABLE, userId, 'event_id', stale);
  }
  let stored = [];
  if (rows.length) {
    stored = await supabaseFetch(restQuery(DIVIDENDS_TABLE, {
      on_conflict: 'user_id,event_id',
      select: 'event_id,updated_at',
    }), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(rows.map(row => tableDividendRow(userId, row))),
    });
  }
  const returned = Array.isArray(stored) ? stored : [];
  return {
    ...directSyncState([], returned),
    count: rows.length,
    deleted,
    transport: 'postgrest-fallback',
  };
}

async function directDeleteFinancialData(userId) {
  const [transactions, dividends] = await Promise.all([
    supabaseFetch(restQuery(TRANSACTIONS_TABLE, { select: 'client_tx_id', user_id: `eq.${userId}` }), {
      method: 'DELETE', headers: { prefer: 'return=representation' },
    }),
    supabaseFetch(restQuery(DIVIDENDS_TABLE, { select: 'event_id', user_id: `eq.${userId}` }), {
      method: 'DELETE', headers: { prefer: 'return=representation' },
    }),
  ]);
  return {
    ...directSyncState([], []),
    count: (Array.isArray(transactions) ? transactions.length : 0) + (Array.isArray(dividends) ? dividends.length : 0),
    transport: 'postgrest-fallback',
  };
}

function cleanText(value, max = 160) {
  return String(value ?? '').trim().slice(0, max);
}

function requestSyncContract(req) {
  return cleanText(header(req, 'x-valorae-sync-contract'), 120);
}

function assertRequestContract(req, action) {
  if (action === 'health' || action === 'diagnostics' || action === 'self_test' || action === 'ping') return;
  const supplied = requestSyncContract(req);
  if (!supplied) {
    const error = new Error('O contrato de sincronização financeira não foi informado pelo cliente.');
    error.status = 428;
    error.code = 'SYNC_CONTRACT_REQUIRED';
    error.retryable = false;
    throw error;
  }
  if (supplied !== SYNC_CONTRACT) {
    const error = new Error(`APK e Proxy usam contratos de sincronização diferentes (${supplied} != ${SYNC_CONTRACT}).`);
    error.status = 409;
    error.code = 'SYNC_CONTRACT_MISMATCH';
    error.retryable = false;
    throw error;
  }
}

function assertRpcContract(result, rpcName) {
  if (result?.contract === SYNC_CONTRACT) return result;
  const error = new Error(`A RPC ${rpcName} não confirmou o contrato financeiro v2.`);
  error.status = 502;
  error.code = 'MINIMAL_SYNC_CONTRACT_MISMATCH';
  error.retryable = false;
  throw error;
}

function dedupeRows(rows, keyName) {
  const byId = new Map();
  for (const row of rows) {
    const key = cleanText(row?.[keyName], 96);
    if (key) byId.set(key, row);
  }
  return [...byId.values()];
}

function dividendRowQuality(row = {}) {
  let score = 0;
  if (normalizeSyncDate(row.paymentDate || row.payment_date)) score += 16;
  if (normalizeSyncDate(row.dateCom || row.date_com)) score += 12;
  if (normalizeSyncDate(row.inferredComDate || row.inferred_com_date) || normalizeSyncDate(row.exDate || row.ex_date)) score += 6;
  if (finiteNumber(row.valuePerShare ?? row.value_per_share) > 0) score += 4;
  if (finiteNumber(row.quantity) > 0) score += 4;
  if (finiteNumber(row.estimatedAmount ?? row.estimated_amount) > 0) score += 4;
  if (finiteNumber(row.grossValuePerShare ?? row.gross_value_per_share) > 0) score += 2;
  if (finiteNumber(row.netValuePerShare ?? row.net_value_per_share) > 0) score += 2;
  if (finiteNumber(row.taxWithheldAmount ?? row.tax_withheld_amount) > 0) score += 2;
  const state = cleanText(row.status, 80).toUpperCase();
  if (state.includes('RECEB') || state.includes('PAGO')) score += 2;
  return score;
}

function dividendAmountToken(row = {}) {
  const amount = finiteNumber(row.valuePerShare ?? row.value_per_share);
  if (!(amount > 0)) return null;
  return amount.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
}

function dividendEconomicBaseKey(row = {}) {
  const eligibilityDate = normalizeSyncDate(row.dateCom || row.date_com)
    || normalizeSyncDate(row.inferredComDate || row.inferred_com_date)
    || normalizeSyncDate(row.exDate || row.ex_date);
  const paymentDate = normalizeSyncDate(row.paymentDate || row.payment_date);
  return [
    normalizeTicker(row.ticker || row.symbol || ''),
    eligibilityDate || paymentDate,
    dividendKindFamily(row),
  ].join('|');
}

function dedupeDividendRows(rows = []) {
  const buckets = new Map();
  for (const row of rows) {
    const baseKey = dividendEconomicBaseKey(row);
    if (!baseKey || baseKey.startsWith('|')) continue;
    const bucket = buckets.get(baseKey) || { known: new Map(), unknown: null };
    const amountToken = dividendAmountToken(row);
    if (amountToken) {
      const existing = bucket.known.get(amountToken);
      if (!existing || dividendRowQuality(row) >= dividendRowQuality(existing)) bucket.known.set(amountToken, row);
    } else if (!bucket.unknown || dividendRowQuality(row) >= dividendRowQuality(bucket.unknown)) {
      bucket.unknown = row;
    }
    buckets.set(baseKey, bucket);
  }

  const result = [];
  for (const bucket of buckets.values()) {
    if (bucket.known.size === 0) {
      if (bucket.unknown) result.push(bucket.unknown);
    } else if (bucket.known.size === 1) {
      result.push(bucket.known.values().next().value);
    } else {
      result.push(...bucket.known.values());
      if (bucket.unknown) result.push(bucket.unknown);
    }
  }
  return result;
}

function transactionFingerprint(row = {}) {
  return JSON.stringify([
    cleanText(row.date, 40),
    cleanText(row.operation, 48).toUpperCase(),
    cleanText(row.symbol, 24).toUpperCase(),
    cleanText(row.assetType, 80),
    finiteNumber(row.quantity),
    finiteNumber(row.price),
    finiteNumber(row.grossValue),
    cleanText(row.source, 120).toUpperCase(),
    row.importedAt ?? null,
  ]);
}

function collisionSafeTransactionRows(rows = []) {
  const byIdAndFingerprint = new Map();
  const usedIds = new Set();
  const output = [];
  for (const row of rows) {
    const baseId = cleanText(row?.clientTxId, 96);
    if (!baseId) continue;
    const fingerprint = transactionFingerprint(row);
    const known = byIdAndFingerprint.get(baseId);
    if (!known) {
      byIdAndFingerprint.set(baseId, new Set([fingerprint]));
      usedIds.add(baseId);
      output.push(row);
      continue;
    }
    if (known.has(fingerprint)) continue;
    known.add(fingerprint);
    const suffix = crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 16);
    const prefix = baseId.slice(0, Math.max(1, 96 - suffix.length - 1));
    let candidate = `${prefix}-${suffix}`;
    let attempt = 1;
    while (usedIds.has(candidate)) {
      const extra = crypto.createHash('sha256').update(`${fingerprint}:${attempt}`).digest('hex').slice(0, 16);
      candidate = `${baseId.slice(0, Math.max(1, 96 - extra.length - 1))}-${extra}`;
      attempt += 1;
    }
    usedIds.add(candidate);
    output.push({ ...row, clientTxId: candidate });
  }
  return output;
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSyncDate(value) {
  const raw = cleanText(value, 64);
  if (!raw || /^(?:a confirmar|—|-)$/i.test(raw)) return '';
  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  const br = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : br ? [Number(br[3]), Number(br[2]), Number(br[1])]
    : compact ? [Number(compact[1]), Number(compact[2]), Number(compact[3])]
    : null;
  if (parts) {
    const [year, month, day] = parts;
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : '';
}

function dividendKindFamily(row = {}) {
  const raw = cleanText(row.kind || row.dividendType || row.type || row.status || '', 120)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (/\b(?:JCP|JSCP)\b|JUROS/.test(raw)) return 'JCP';
  if (raw.includes('REND')) return 'RENDIMENTO';
  if (raw.includes('AMORT')) return 'AMORTIZACAO';
  if (raw.includes('DIV')) return 'DIVIDENDO';
  return 'PROVENTO';
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
  const signedQuantity = finiteNumber(row.quantity);
  const signedPrice = finiteNumber(row.price ?? row.purchase_price);
  const signedGross = finiteNumber(row.grossValue ?? row.gross_value, signedQuantity * signedPrice);
  const quantity = Math.abs(signedQuantity);
  const price = Math.abs(signedPrice);
  const grossMagnitude = Math.abs(signedGross);
  const rawOperation = cleanText(row.operation || row.side || '', 48).toUpperCase();
  const operation = rawOperation || ((signedQuantity < 0 || signedGross < 0 || row.isSell === true || row.is_sell === true) ? 'VENDA' : 'MOVIMENTAÇÃO');
  return {
    clientTxId: normalizedClientId(row),
    date: normalizeSyncDate(row.date || row.transaction_date),
    operation,
    symbol,
    assetType: cleanText(row.assetType || row.asset_type || 'Outro', 80),
    quantity,
    price,
    grossValue: grossMagnitude > 0 ? grossMagnitude : quantity * price,
    source: cleanText(row.source || 'VALORAE', 120),
    importedAt: row.importedAt ?? row.imported_at ?? null,
  };
}

function normalizedEventId(row = {}) {
  // A identidade é sempre recalculada. IDs fornecidos por clientes antigos podiam
  // incorporar a fonte e criar duplicatas ao restaurar o mesmo evento da nuvem.
  const seed = [
    dividendEconomicBaseKey(row),
    dividendAmountToken(row) || '?',
  ].join('|');
  return `div-${crypto.createHash('sha256').update(seed).digest('hex')}`.slice(0, 96);
}

function normalizeDividend(row = {}) {
  return {
    eventId: normalizedEventId(row),
    ticker: normalizeTicker(row.ticker || row.symbol || '').slice(0, 24),
    dateCom: normalizeSyncDate(row.dateCom || row.date_com),
    exDate: normalizeSyncDate(row.exDate || row.ex_date),
    inferredComDate: normalizeSyncDate(row.inferredComDate || row.inferred_com_date),
    eligibilityDateSource: cleanText(row.eligibilityDateSource || row.eligibility_date_source, 80),
    paymentDate: normalizeSyncDate(row.paymentDate || row.payment_date),
    valuePerShare: Math.max(0, finiteNumber(row.valuePerShare ?? row.value_per_share)),
    quantity: Math.max(0, finiteNumber(row.quantity)),
    estimatedAmount: Math.max(0, finiteNumber(row.estimatedAmount ?? row.estimated_amount)),
    grossValuePerShare: Math.max(0, finiteNumber(row.grossValuePerShare ?? row.gross_value_per_share)),
    netValuePerShare: Math.max(0, finiteNumber(row.netValuePerShare ?? row.net_value_per_share)),
    taxRate: Math.max(0, finiteNumber(row.taxRate ?? row.tax_rate)),
    taxWithheldPerShare: Math.max(0, finiteNumber(row.taxWithheldPerShare ?? row.tax_withheld_per_share)),
    grossAmount: Math.max(0, finiteNumber(row.grossAmount ?? row.gross_amount)),
    netAmount: Math.max(0, finiteNumber(row.netAmount ?? row.net_amount)),
    taxWithheldAmount: Math.max(0, finiteNumber(row.taxWithheldAmount ?? row.tax_withheld_amount)),
    taxRule: cleanText(row.taxRule || row.tax_rule, 120),
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
  const result = assertRpcContract(
    normalizeRpcObject(await callRpcWithRestFallback(DOWNLOAD_RPC, { p_user_id: userId }, () => directDownloadFinancialData(userId))),
    DOWNLOAD_RPC,
  );
  const transactions = Array.isArray(result.transactions) ? result.transactions : [];
  const dividends = Array.isArray(result.dividends) ? result.dividends : [];
  const transactionIds = transactions.map(row => cleanText(row?.clientTxId || row?.client_tx_id, 96));
  if (transactionIds.some(id => !id) || new Set(transactionIds).size !== transactionIds.length) {
    const error = new Error('O Supabase retornou identificadores de transação ausentes ou duplicados. Nenhum dado parcial será aplicado.');
    error.status = 502;
    error.code = 'MINIMAL_SYNC_TRANSACTION_IDENTITY_INVALID';
    error.retryable = false;
    throw error;
  }
  const transactionsCount = Number(result.transactions_count ?? transactions.length) || 0;
  const dividendsCount = Number(result.dividends_count ?? dividends.length) || 0;
  if (transactionsCount !== transactions.length || dividendsCount !== dividends.length) {
    const error = new Error('O Supabase retornou uma carga financeira incompleta. Nenhum dado parcial será aplicado.');
    error.status = 502;
    error.code = 'MINIMAL_SYNC_COUNT_MISMATCH';
    error.retryable = true;
    error.details = {
      transactionsCount,
      transactionsLength: transactions.length,
      dividendsCount,
      dividendsLength: dividends.length,
    };
    throw error;
  }
  return {
    ok: true,
    contract: SYNC_CONTRACT,
    restoreContract: SYNC_CONTRACT,
    restore_contract: SYNC_CONTRACT,
    restoreSource: result.transport === 'postgrest-fallback' ? 'postgrest-tables' : DOWNLOAD_RPC,
    restore_source: result.transport === 'postgrest-fallback' ? 'postgrest-tables' : DOWNLOAD_RPC,
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
    transport: result.transport || 'rpc',
  };
}

async function uploadTransactions(userId, input, action) {
  const sourceRows = Array.isArray(input.transactions) ? input.transactions : Array.isArray(input.rows) ? input.rows : [];
  const normalizedRows = sourceRows.map(normalizeTransaction);
  const invalidRows = normalizedRows.filter(row => !row.clientTxId || !row.symbol || !row.date || !row.operation ||
    !Number.isFinite(row.quantity) || !Number.isFinite(row.price) || !Number.isFinite(row.grossValue) ||
    !(row.quantity > 0 || row.grossValue > 0));
  if (invalidRows.length > 0) {
    const error = new Error(`${invalidRows.length} transação(ões) não puderam ser normalizadas; o lote inteiro foi recusado para evitar Histórico parcial.`);
    error.status = 422;
    error.code = 'SYNC_TRANSACTION_ROWS_REJECTED';
    error.retryable = false;
    error.details = { received: sourceRows.length, rejected: invalidRows.length };
    throw error;
  }
  const rows = collisionSafeTransactionRows(normalizedRows);
  const replacement = action === 'replace_transactions_for_symbols' || input.mode === 'replace_symbols';
  const symbols = replacement
    ? [...new Set((Array.isArray(input.symbols) ? input.symbols : []).map(normalizeTicker).filter(Boolean))]
    : [];
  runtime.metrics.transactionUploads += 1;
  const result = assertRpcContract(
    normalizeRpcObject(await callRpcWithRestFallback(UPLOAD_TRANSACTIONS_RPC, {
      p_user_id: userId,
      p_rows: rows,
      p_replace_symbols: symbols.length ? symbols : null,
    }, () => directUploadTransactions(userId, rows, symbols))),
    UPLOAD_TRANSACTIONS_RPC,
  );
  return {
    ok: result.ok !== false,
    contract: SYNC_CONTRACT,
    count: Number(result.count || 0),
    deleted: Number(result.deleted || 0),
    receivedCount: sourceRows.length,
    normalizedCount: rows.length,
    message: `Histórico sincronizado: ${Number(result.count || 0)} alteração(ões), ${Number(result.deleted || 0)} remoção(ões).`,
    syncState: syncStateFrom(result),
    transport: result.transport || 'rpc',
  };
}

async function uploadDividends(userId, input) {
  const sourceRows = Array.isArray(input.events) ? input.events : Array.isArray(input.dividends) ? input.dividends : [];
  const normalizedRows = sourceRows.map(normalizeDividend);
  const invalidRows = normalizedRows.filter(row => !row.eventId || !row.ticker || !(row.dateCom || row.exDate || row.inferredComDate || row.paymentDate) ||
    ![row.valuePerShare, row.quantity, row.estimatedAmount, row.grossValuePerShare, row.netValuePerShare,
      row.taxRate, row.taxWithheldPerShare, row.grossAmount, row.netAmount, row.taxWithheldAmount].every(Number.isFinite));
  if (invalidRows.length > 0) {
    const error = new Error(`${invalidRows.length} evento(s) de proventos não puderam ser normalizados; a nuvem anterior foi preservada.`);
    error.status = 422;
    error.code = 'SYNC_DIVIDEND_ROWS_REJECTED';
    error.retryable = false;
    error.details = { received: sourceRows.length, rejected: invalidRows.length };
    throw error;
  }
  const rows = dedupeDividendRows(normalizedRows);
  runtime.metrics.dividendUploads += 1;
  const result = assertRpcContract(
    normalizeRpcObject(await callRpcWithRestFallback(UPLOAD_DIVIDENDS_RPC, {
      p_user_id: userId,
      p_rows: rows,
      p_replace_all: input.replaceAll !== false && input.replace_all !== false,
    }, () => directUploadDividends(userId, rows, input.replaceAll !== false && input.replace_all !== false))),
    UPLOAD_DIVIDENDS_RPC,
  );
  return {
    ok: result.ok !== false,
    contract: SYNC_CONTRACT,
    count: Number(result.count || 0),
    deleted: Number(result.deleted || 0),
    receivedCount: sourceRows.length,
    normalizedCount: rows.length,
    message: `Dividendos sincronizados: ${Number(result.count || 0)} alteração(ões), ${Number(result.deleted || 0)} remoção(ões).`,
    syncState: syncStateFrom(result),
    transport: result.transport || 'rpc',
  };
}

async function financialStatus(userId) {
  const result = assertRpcContract(
    normalizeRpcObject(await callRpcWithRestFallback(STATUS_RPC, { p_user_id: userId }, () => directFinancialStatus(userId))),
    STATUS_RPC,
  );
  return {
    ok: true,
    contract: SYNC_CONTRACT,
    transactionsCount: Number(result.transactions_count || 0),
    dividendsCount: Number(result.dividends_count || 0),
    syncState: syncStateFrom(result),
    transport: result.transport || 'rpc',
  };
}

async function deleteFinancialData(userId) {
  runtime.metrics.deletions += 1;
  const result = assertRpcContract(
    normalizeRpcObject(await callRpcWithRestFallback(DELETE_RPC, { p_user_id: userId }, () => directDeleteFinancialData(userId))),
    DELETE_RPC,
  );
  return {
    ok: result.ok !== false,
    contract: SYNC_CONTRACT,
    count: Number(result.count || 0),
    message: 'Histórico de transações e dividendos removido da nuvem.',
    syncState: syncStateFrom(result),
    transport: result.transport || 'rpc',
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
    maxResponseBytes: syncMaxResponseBytes(),
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
    assertCompatibleEcosystemContract(req);
    assertRequestContract(req, action);

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
        retryable: !ok,
        retryAfterMs: ok ? null : 15 * 60 * 1000,
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
      error.retryable = true;
      error.retryAfterMs = 15 * 60 * 1000;
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
      runtime.metrics.legacyWriteBlocks += 1;
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
  retryAfterMs,
  syncMaxResponseBytes,
  readBoundedResponseText,
  normalizeSingleTransactionSymbol: normalizeTicker,
  normalizeTransactionSymbols,
  storedTransactionToClient: normalizeTransaction,
  requestSyncContract,
  assertRequestContract,
  assertCompatibleEcosystemContract,
  assertRpcContract,
  dedupeRows,
  dedupeDividendRows,
  isMissingRpcError,
  isMissingRelationError,
  migrationRequiredError,
  restQuery,
  tableTransactionRow,
  clientTransactionRow,
  directUploadTransactions,
  dividendRowQuality,
  dividendAmountToken,
  dividendEconomicBaseKey,
};
