import crypto from 'node:crypto';
import { sendJson } from '../lib/performance/http.js';
import { formatBrDate } from '../lib/core/dates.js';
import { beginRoute, getInput } from '../lib/http/route.js';
import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { normalizeTicker } from '../lib/core/tickers.js';
import {
  TRANSACTION_PAGE_LIMIT_MAX,
  applyOperationToPosition,
  assertCursorMatchesState,
  classifyCorporateOperation,
  decodeRevisionCursor,
  encodeRevisionCursor,
  normalizeClientTxId,
  stableDividendEventKey,
} from '../lib/sync/financial-integrity.js';

const SNAPSHOT_TABLE = process.env.VALORAE_SUPABASE_SNAPSHOT_TABLE || 'valorae_user_snapshots';
const CLIENTS_TABLE = process.env.VALORAE_SUPABASE_CLIENTS_TABLE || 'valorae_sync_clients';
const TRANSACTIONS_TABLE = process.env.VALORAE_SUPABASE_TRANSACTIONS_TABLE || 'valorae_transactions';
const DIVIDENDS_TABLE = process.env.VALORAE_SUPABASE_DIVIDENDS_TABLE || 'valorae_dividend_events';
const BACKUPS_TABLE = process.env.VALORAE_SUPABASE_BACKUPS_TABLE || process.env.VALORAE_SUPABASE_BACKUP_TABLE || 'valorae_sync_backups';
const SYNC_STATE_TABLE = process.env.VALORAE_SUPABASE_SYNC_STATE_TABLE || 'valorae_sync_user_state';
const CORE_VERSION = '21.12.394-runtime-safety-v362';
// Compat lineage: 21.12.151-cloud-primary-supabase-v88.

const SNAPSHOT_FULL_SELECT = 'payload,payload_ciphertext,encrypted,updated_at,domain,snapshot_key,user_id,cache_scope,cache_ttl_seconds,expires_at,source,source_updated_at,etag,payload_size_bytes';
const SNAPSHOT_LEGACY_SELECT = 'payload,updated_at,domain,snapshot_key,user_id';
const SNAPSHOT_CACHE_COLUMNS = Object.freeze(['cache_scope', 'cache_ttl_seconds', 'expires_at', 'source_updated_at', 'etag', 'payload_size_bytes']);
const SNAPSHOT_LEGACY_COMPAT_MESSAGE = 'Tabela valorae_user_snapshots sem colunas de cache v85; rode supabase/002_valorae_snapshot_cache_columns_v85.sql para habilitar TTL/etag, ou mantenha o Proxy v85 que salva em modo compatível.';

const SYNC_CAPABILITIES = Object.freeze([
  'health',
  'diagnostics',
  'auth_check',
  'register_client',
  'upsert_snapshot',
  'get_sync_state',
  'get_snapshot',
  'upsert_snapshots',
  'get_snapshots',
  'upsert_transactions',
  'replace_transactions_for_symbols',
  'get_transactions',
  'upsert_dividend_events',
  'get_dividend_events',
  'get_sync_backups',
  'delete_user_data',
]);

function cleanUrl(raw = '') {
  let value = String(raw || '').trim().replace(/\/+$/, '');
  // Aceita SUPABASE_URL colada com /rest/v1, /auth/v1 etc. no Vercel e normaliza
  // para a raiz do projeto. Isso evita chamadas quebradas como /rest/v1/rest/v1/tabela.
  value = value
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/auth\/v1\/?$/i, '')
    .replace(/\/storage\/v1\/?$/i, '')
    .replace(/\/functions\/v1\/?$/i, '')
    .replace(/\/+$/, '');
  return value;
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
    keyKind: key ? 'server_secret' : 'missing',
    configured: url.startsWith('https://') && Boolean(key),
    authConfigured: url.startsWith('https://') && Boolean(publicKey || key),
  };
}

function header(req, name) {
  return String(req.headers?.[name] || req.headers?.[name.toLowerCase()] || '').trim();
}

function authorizationBearer(req) {
  const raw = header(req, 'authorization');
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function suppliedAdminToken(req) {
  return String(header(req, 'x-valorae-sync-token') || header(req, 'authorization'))
    .replace(/^Bearer\s+/i, '')
    .trim();
}

function hasValidAdminToken(req) {
  const configured = String(process.env.VALORAE_SUPABASE_SYNC_TOKEN || '').trim();
  return Boolean(configured) && suppliedAdminToken(req) === configured;
}

async function parseJsonBody(req) {
  const maxBytes = Math.min(Math.max(Number(process.env.VALORAE_SYNC_MAX_BODY_BYTES || 1_048_576), 16_384), 5_242_880);
  const invalid = (message, code = 'INVALID_JSON_BODY', status = 400) => {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
  };
  if (req.body && typeof req.body === 'object') {
    const bytes = Buffer.byteLength(JSON.stringify(req.body), 'utf8');
    if (bytes > maxBytes) throw invalid('Payload de sincronização excede o limite permitido.', 'SYNC_PAYLOAD_TOO_LARGE', 413);
    return req.body;
  }
  if (typeof req.body === 'string') {
    const text = req.body.trim();
    if (!text) return {};
    if (Buffer.byteLength(text, 'utf8') > maxBytes) throw invalid('Payload de sincronização excede o limite permitido.', 'SYNC_PAYLOAD_TOO_LARGE', 413);
    try { return JSON.parse(text); } catch { throw invalid('Corpo JSON inválido.'); }
  }
  if (!req || typeof req.on !== 'function') return {};
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > maxBytes) throw invalid('Payload de sincronização excede o limite permitido.', 'SYNC_PAYLOAD_TOO_LARGE', 413);
    chunks.push(bytes);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw invalid('Corpo JSON inválido.'); }
}

function safeText(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

function normalizeDomain(value) {
  return safeText(value, 64).toLowerCase();
}

function normalizeSnapshotKey(value) {
  return safeText(value, 96).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePostgrestTimestamp(value, { allowNull = true } = {}) {
  if (value == null || value === '') return allowNull ? null : nowIso();
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = Math.abs(value) > 9999999999 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isFinite(date.getTime()) ? date.toISOString() : (allowNull ? null : nowIso());
  }
  const raw = String(value).trim();
  if (!raw) return allowNull ? null : nowIso();
  if (/^\d{10,17}$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      const millis = raw.length >= 13 ? numeric : numeric * 1000;
      const date = new Date(millis);
      return Number.isFinite(date.getTime()) ? date.toISOString() : (allowNull ? null : nowIso());
    }
  }
  const br = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const date = new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1]), Number(br[4] || 0), Number(br[5] || 0), Number(br[6] || 0)));
    return Number.isFinite(date.getTime()) ? date.toISOString() : (allowNull ? null : nowIso());
  }
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return allowNull ? null : nowIso();
}

function clientSecretHash(userId, clientSecret) {
  const pepper = String(process.env.VALORAE_SUPABASE_CLIENT_SECRET_PEPPER || process.env.VALORAE_SUPABASE_SYNC_TOKEN || '').trim();
  return crypto.createHash('sha256').update(`${pepper}:${userId}:${clientSecret}`).digest('hex');
}

function eventKey(userId, ev = {}) {
  return stableDividendEventKey(userId, ev);
}

function isLocalDividendProjection(ev = {}) {
  const source = safeText(ev.source || ev.fonte || '', 240).toLowerCase();
  const status = safeText(ev.status || '', 120).toLowerCase();
  const payloadSource = safeText(ev.payload?.source || '', 240).toLowerCase();
  const combined = `${source} ${status} ${payloadSource}`;
  return combined.includes('previsão local') ||
    combined.includes('previsao local') ||
    combined.includes('estimativa local') ||
    combined.includes('último provento conhecido') ||
    combined.includes('ultimo provento conhecido');
}

function hasUsableDividendEvent(ev = {}) {
  const ticker = normalizeSingleTransactionSymbol(ev.ticker || ev.symbol || '');
  const dateCom = safeText(ev.dateCom || ev.date_com || '', 40);
  const inferredComDate = safeText(ev.inferredComDate || ev.inferred_com_date || ev.estimatedComDate || '', 40);
  const exDate = safeText(ev.exDate || ev.ex_date || ev.dateEx || '', 40);
  const paymentDate = safeText(ev.paymentDate || ev.payment_date || '', 40);
  const value = Number(ev.valuePerShare ?? ev.value_per_share ?? ev.value ?? 0);
  const amount = Number(ev.estimatedAmount ?? ev.estimated_amount ?? 0);
  return Boolean(ticker) && Boolean(dateCom || inferredComDate || exDate || paymentDate) && (Number.isFinite(value) && value > 0 || Number.isFinite(amount) && amount > 0);
}

function isValidSyncIdentity(value) {
  const userId = safeText(value, 160);
  return /^valorae-[a-z0-9-]{20,}$/i.test(userId) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
}

function safeClientCredentials(input = {}, req, { requireSecret = true, forcedUserId = '' } = {}) {
  const userId = safeText(forcedUserId || input.user_id || input.userId || header(req, 'x-valorae-user-id'), 160);
  const deviceId = safeText(input.device_id || input.deviceId || header(req, 'x-valorae-device-id'), 160);
  const clientSecret = safeText(input.client_secret || input.clientSecret || header(req, 'x-valorae-client-secret'), 240);
  const appVersion = safeText(input.app_version || input.appVersion || header(req, 'x-valorae-app-version'), 40);
  const source = safeText(input.source || input.client_kind || header(req, 'x-valorae-client-kind') || 'apk-android', 80);

  if (!userId || !isValidSyncIdentity(userId)) {
    const err = new Error('Identidade VALORAE inválida ou ausente. Entre na Conta VALORAE ou atualize o APK.');
    err.status = 400;
    err.code = 'INVALID_SYNC_IDENTITY';
    throw err;
  }
  if (requireSecret && (!clientSecret || clientSecret.length < 40)) {
    const err = new Error('Credencial local de sincronização ausente ou curta demais.');
    err.status = 401;
    err.code = 'CLIENT_SECRET_REQUIRED';
    throw err;
  }
  return { userId, deviceId, clientSecret, appVersion, source };
}

function safeRecord(input = {}, forcedUserId = '') {
  const domain = normalizeDomain(input.domain);
  const snapshotKey = normalizeSnapshotKey(input.snapshot_key || input.snapshotKey || input.key);
  const userId = safeText(forcedUserId || input.user_id || input.userId, 160);
  if (!userId || !domain || !snapshotKey) {
    const err = new Error('Campos obrigatórios ausentes: user_id, domain e snapshot_key.');
    err.status = 400;
    err.code = 'INVALID_SYNC_RECORD';
    throw err;
  }
  const ttl = Number(input.cache_ttl_seconds ?? input.cacheTtlSeconds ?? input.ttlSeconds ?? 0);
  const payload = input.encrypted ? null : (input.payload ?? {});
  const explicitExpiresAt = normalizePostgrestTimestamp(input.expires_at ?? input.expiresAt ?? null);
  const expiresAt = explicitExpiresAt || (Number.isFinite(ttl) && ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null);
  const payloadSize = payload == null ? 0 : Buffer.byteLength(JSON.stringify(payload), 'utf8');
  return {
    user_id: userId,
    domain,
    snapshot_key: snapshotKey,
    schema_version: Number(input.schema_version || input.schemaVersion || 3),
    app_version: safeText(input.app_version || input.appVersion, 40),
    device_id: safeText(input.device_id || input.deviceId, 160),
    source: safeText(input.source || 'valorae-proxy', 80),
    cache_scope: safeText(input.cache_scope || input.cacheScope || 'user', 40),
    cache_ttl_seconds: Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : null,
    expires_at: expiresAt,
    source_updated_at: normalizePostgrestTimestamp(input.source_updated_at ?? input.sourceUpdatedAt ?? null),
    etag: safeText(input.etag || '', 160) || null,
    payload_size_bytes: payloadSize,
    encrypted: Boolean(input.encrypted),
    payload,
    payload_ciphertext: input.encrypted ? String(input.payload_ciphertext || input.payloadCiphertext || '') : null,
    updated_at: normalizePostgrestTimestamp(input.updated_at ?? input.updatedAt ?? null, { allowNull: false }),
  };
}

function snapshotToClient(record = {}) {
  const expiresAt = record.expires_at || null;
  const fresh = !expiresAt || Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) > Date.now();
  return {
    domain: record.domain,
    snapshot_key: record.snapshot_key,
    key: record.snapshot_key,
    payload: record.payload || {},
    payload_ciphertext: record.payload_ciphertext || null,
    encrypted: Boolean(record.encrypted),
    updated_at: record.updated_at || null,
    expires_at: expiresAt,
    cache_scope: record.cache_scope || 'user',
    cache_ttl_seconds: record.cache_ttl_seconds ?? null,
    source: record.source || null,
    source_updated_at: record.source_updated_at || null,
    etag: record.etag || null,
    payload_size_bytes: record.payload_size_bytes ?? null,
    fresh,
    isFresh: fresh,
  };
}

async function supabaseFetch(path, init = {}) {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) {
    const err = new Error('Supabase não configurado no Proxy. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
    err.status = 503;
    err.code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }
  const response = await fetch(`${cfg.url}${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      authorization: `Bearer ${cfg.key}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const err = new Error(json?.message || text || `Supabase HTTP ${response.status}`);
    err.status = response.status;
    err.code = json?.code || 'SUPABASE_HTTP_ERROR';
    err.details = json || text;
    throw err;
  }
  return json ?? text;
}


function syncCursorSecret() {
  const cfg = getSupabaseConfig();
  return String(
    process.env.VALORAE_SYNC_CURSOR_SECRET ||
    process.env.VALORAE_SUPABASE_SYNC_TOKEN ||
    cfg.key ||
    ''
  ).trim();
}

function normalizeSyncState(value = {}) {
  const raw = Array.isArray(value) ? (value[0] || {}) : value;
  const state = raw?.state || raw?.result || raw || {};
  return {
    revision: Math.max(0, Number(state.revision) || 0),
    deletionGeneration: Math.max(0, Number(state.deletion_generation ?? state.deletionGeneration) || 0),
    tombstone: Boolean(state.tombstone),
    deletedAt: state.deleted_at || state.deletedAt || null,
    updatedAt: state.updated_at || state.updatedAt || null,
  };
}

async function callSyncRpc(name, args = {}) {
  try {
    return await supabaseFetch(`/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch (err) {
    const text = `${err?.message || ''} ${JSON.stringify(err?.details || '')}`;
    if (/SYNC_(?:REVISION_CONFLICT|STATE_REQUIRED|TOMBSTONE_ACTIVE|STALE_AFTER_DELETE)/.test(text)) {
      err.status = 409;
      err.code = text.match(/SYNC_(?:REVISION_CONFLICT|STATE_REQUIRED|TOMBSTONE_ACTIVE|STALE_AFTER_DELETE)/)?.[0] || 'SYNC_CONFLICT';
    } else if (err?.code === 'PGRST202' || /Could not find the function|schema cache/i.test(text)) {
      err.status = 503;
      err.code = 'SYNC_RPC_MIGRATION_REQUIRED';
      err.message = 'Migração Supabase 006_valorae_financial_sync_integrity_v358.sql não aplicada.';
    }
    throw err;
  }
}

async function getSyncState(userId) {
  const result = await callSyncRpc('valorae_sync_get_state', { p_user_id: userId });
  return normalizeSyncState(result);
}

function expectedSyncState(input = {}) {
  const source = input.sync_state || input.syncState || input.state || input;
  const hasRevision = source.expected_revision != null || source.expectedRevision != null || source.revision != null;
  const hasGeneration = source.expected_deletion_generation != null || source.expectedDeletionGeneration != null || source.deletion_generation != null || source.deletionGeneration != null;
  const hasTombstone = source.expected_tombstone != null || source.expectedTombstone != null || source.tombstone != null;
  if (!hasRevision || !hasGeneration || !hasTombstone) {
    const err = new Error('A operação exige revisão, geração de exclusão e tombstone observados antes da escrita.');
    err.status = 409;
    err.code = 'SYNC_STATE_REQUIRED';
    throw err;
  }
  return {
    revision: Math.max(0, Number(source.expected_revision ?? source.expectedRevision ?? source.revision) || 0),
    deletionGeneration: Math.max(0, Number(source.expected_deletion_generation ?? source.expectedDeletionGeneration ?? source.deletion_generation ?? source.deletionGeneration) || 0),
    tombstone: Boolean(source.expected_tombstone ?? source.expectedTombstone ?? source.tombstone),
    clearTombstone: Boolean(source.clear_tombstone ?? source.clearTombstone),
    actionCreatedAt: normalizePostgrestTimestamp(source.action_created_at ?? source.actionCreatedAt ?? input.action_created_at ?? input.actionCreatedAt ?? input.createdAt ?? null),
  };
}

function mutationRpcArgs(userId, input, rows, extra = {}) {
  const expected = expectedSyncState(input);
  return {
    p_user_id: userId,
    p_rows: rows,
    p_expected_revision: expected.revision,
    p_expected_deletion_generation: expected.deletionGeneration,
    p_expected_tombstone: expected.tombstone,
    p_action_created_at: expected.actionCreatedAt,
    p_clear_tombstone: expected.clearTombstone,
    ...extra,
  };
}


function isSnapshotCacheColumnMissingError(err) {
  const text = `${err?.message || ''} ${JSON.stringify(err?.details || '')}`.toLowerCase();
  return err?.code === 'PGRST204' && SNAPSHOT_CACHE_COLUMNS.some((column) => text.includes(column.toLowerCase())) ||
    SNAPSHOT_CACHE_COLUMNS.some((column) => text.includes(`'${column.toLowerCase()}' column`) || text.includes(`\"${column.toLowerCase()}\" column`));
}

async function fetchSnapshotRowsWithCompat(queryBuilder) {
  try {
    return {
      rows: await supabaseFetch(`/rest/v1/${SNAPSHOT_TABLE}?${queryBuilder(SNAPSHOT_FULL_SELECT)}`, { method: 'GET' }),
      schemaMode: 'full',
      degraded: false,
    };
  } catch (err) {
    if (!isSnapshotCacheColumnMissingError(err)) throw err;
    return {
      rows: await supabaseFetch(`/rest/v1/${SNAPSHOT_TABLE}?${queryBuilder(SNAPSHOT_LEGACY_SELECT)}`, { method: 'GET' }),
      schemaMode: 'legacy_snapshot_columns',
      degraded: true,
      warning: SNAPSHOT_LEGACY_COMPAT_MESSAGE,
      missingColumns: SNAPSHOT_CACHE_COLUMNS,
    };
  }
}

async function probeSnapshotCacheColumns() {
  const started = Date.now();
  const checks = [];
  for (const column of SNAPSHOT_CACHE_COLUMNS) {
    try {
      await supabaseFetch(`/rest/v1/${SNAPSHOT_TABLE}?select=${column}&limit=1`, { method: 'GET' });
      checks.push({ column, ok: true });
    } catch (err) {
      checks.push({
        column,
        ok: false,
        code: err.code || 'SUPABASE_SCHEMA_COLUMN_ERROR',
        message: String(err.message || '').slice(0, 180),
      });
    }
  }
  const missing = checks.filter((item) => !item.ok).map((item) => item.column);
  return {
    ok: missing.length === 0,
    elapsedMs: Date.now() - started,
    expectedColumns: SNAPSHOT_CACHE_COLUMNS,
    missingColumns: missing,
    checks,
    recommendation: missing.length
      ? 'Execute supabase/002_valorae_snapshot_cache_columns_v85.sql no SQL Editor do Supabase e depois publique/reinicie o Proxy para recarregar o schema cache.'
      : 'Colunas de cache do snapshot presentes.',
  };
}

async function probeSupabaseTable(table, label = table) {
  const started = Date.now();
  try {
    const rows = await supabaseFetch(`/rest/v1/${table}?select=*&limit=1`, { method: 'GET' });
    return {
      table,
      label,
      ok: true,
      accessible: true,
      rowsChecked: Array.isArray(rows) ? rows.length : 0,
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    return {
      table,
      label,
      ok: false,
      accessible: false,
      code: err.code || 'SUPABASE_TABLE_PROBE_ERROR',
      status: err.status || 500,
      message: String(err.message || 'Falha ao consultar tabela Supabase.').slice(0, 240),
      elapsedMs: Date.now() - started,
    };
  }
}

async function supabaseDiagnostics() {
  const cfg = getSupabaseConfig();
  const started = Date.now();
  if (!cfg.configured) {
    return {
      ok: false,
      configured: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      message: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel do Proxy.',
      elapsedMs: Date.now() - started,
      capabilities: SYNC_CAPABILITIES,
    };
  }
  const [snapshotSchema, ...probes] = await Promise.all([
    probeSnapshotCacheColumns(),
    probeSupabaseTable(SNAPSHOT_TABLE, 'snapshots'),
    probeSupabaseTable(CLIENTS_TABLE, 'clients'),
    probeSupabaseTable(TRANSACTIONS_TABLE, 'transactions'),
    probeSupabaseTable(DIVIDENDS_TABLE, 'dividends'),
    probeSupabaseTable(BACKUPS_TABLE, 'backups'),
    probeSupabaseTable(SYNC_STATE_TABLE, 'sync_state'),
  ]);
  const failed = probes.filter((p) => !p.ok);
  const snapshotSchemaMissing = snapshotSchema.missingColumns || [];
  return {
    ok: failed.length === 0 && snapshotSchema.ok,
    schemaCompatible: snapshotSchema.ok,
    snapshotSchema,
    configured: true,
    urlConfigured: Boolean(cfg.url),
    keyConfigured: Boolean(cfg.key),
    authConfigured: cfg.authConfigured,
    checkedAt: nowIso(),
    elapsedMs: Date.now() - started,
    tables: probes,
    failedTables: failed.map((p) => p.table),
    capabilities: SYNC_CAPABILITIES,
    recommendation: failed.length
      ? 'Revise nomes das tabelas, políticas/permissões, service role key e URL do projeto no Vercel.'
      : snapshotSchemaMissing.length
        ? 'Supabase acessível, mas a tabela de snapshots está em schema antigo. Execute supabase/002_valorae_snapshot_cache_columns_v85.sql para remover pendência de cache_scope.'
        : 'Supabase acessível pelo Proxy. Escrita/leitura deve funcionar se o APK enviar identidade e payload válidos.',
  };
}

async function verifySupabaseBearer(req) {
  const cfg = getSupabaseConfig();
  const token = authorizationBearer(req);
  if (!token || !cfg.authConfigured || token === String(process.env.VALORAE_SUPABASE_SYNC_TOKEN || '').trim()) return null;
  const response = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: {
      apikey: cfg.publicKey || cfg.key,
      authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  if (!user?.id) return null;
  return { id: String(user.id), email: String(user.email || '') };
}

async function checkSupabaseAuth(req) {
  const cfg = getSupabaseConfig();
  const token = authorizationBearer(req);
  if (!cfg.configured) {
    return {
      ok: false,
      authenticated: false,
      code: 'SUPABASE_NOT_CONFIGURED',
      authMode: 'none',
      message: 'Proxy sem SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY. Configure as variáveis no Vercel antes de enviar pendências.',
      supabase: { configured: false, urlConfigured: Boolean(cfg.url), keyConfigured: Boolean(cfg.key) },
    };
  }
  if (!token) {
    return {
      ok: false,
      authenticated: false,
      code: 'AUTH_TOKEN_MISSING',
      authMode: 'none',
      message: 'APK sem sessão Supabase ativa. Entre novamente na Conta VALORAE para enviar pendências locais.',
      supabase: { configured: true, authConfigured: cfg.authConfigured },
    };
  }
  const user = await verifySupabaseBearer(req).catch(() => null);
  if (!user?.id) {
    return {
      ok: false,
      authenticated: false,
      code: 'SUPABASE_BEARER_INVALID',
      authMode: 'supabase_auth',
      message: 'Token Supabase não foi aceito pelo Proxy. Confirme se o APK e o Proxy usam o mesmo projeto Supabase e entre novamente no app.',
      supabase: { configured: true, authConfigured: cfg.authConfigured },
    };
  }
  return {
    ok: true,
    authenticated: true,
    code: 'AUTH_OK',
    authMode: 'supabase_auth',
    userId: user.id,
    email: user.email,
    message: 'Sessão Supabase validada pelo Proxy. Pendências podem ser enviadas.',
    supabase: { configured: true, authConfigured: cfg.authConfigured },
  };
}


async function registerClient(input, req) {
  const admin = hasValidAdminToken(req);
  const supabaseUser = admin ? null : await verifySupabaseBearer(req).catch(() => null);
  const requestedUserId = safeText(input.user_id || input.userId || '', 160);
  const authenticatedUserId = supabaseUser?.id || (admin ? requestedUserId : '');
  if (!authenticatedUserId) {
    const err = new Error('O registro do dispositivo exige uma sessão Supabase válida ou token administrativo.');
    err.status = 401;
    err.code = 'REGISTER_AUTH_REQUIRED';
    throw err;
  }
  if (supabaseUser?.id && requestedUserId && requestedUserId !== supabaseUser.id) {
    const err = new Error('A identidade solicitada não corresponde à sessão autenticada.');
    err.status = 403;
    err.code = 'SYNC_USER_MISMATCH';
    throw err;
  }
  const client = safeClientCredentials(input, req, { requireSecret: true, forcedUserId: authenticatedUserId });
  const row = {
    user_id: client.userId,
    device_id: client.deviceId,
    client_secret_hash: clientSecretHash(client.userId, client.clientSecret),
    app_version: client.appVersion,
    source: client.source,
    schema_version: 3,
    revoked: false,
    last_seen_at: nowIso(),
  };
  await supabaseFetch(`/rest/v1/${CLIENTS_TABLE}?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  return {
    ok: true,
    authMode: supabaseUser?.id ? 'supabase_auth' : 'admin_token',
    client: { user_id: client.userId, device_id: client.deviceId, registered: true },
  };
}

async function verifyClient(req, input = {}) {
  const bearer = authorizationBearer(req);
  const syncToken = String(process.env.VALORAE_SUPABASE_SYNC_TOKEN || '').trim();
  const supabaseUser = await verifySupabaseBearer(req).catch(() => null);
  if (supabaseUser?.id) return { mode: 'supabase_auth', userId: supabaseUser.id, email: supabaseUser.email };
  if (bearer && bearer !== syncToken) {
    const err = new Error('Sessão Supabase não foi aceita pelo Proxy. Verifique se APK e Proxy usam o mesmo projeto Supabase e entre novamente.');
    err.status = 401;
    err.code = 'SUPABASE_BEARER_INVALID';
    throw err;
  }

  if (hasValidAdminToken(req)) {
    const userId = safeText(input.userId || input.user_id || input.record?.user_id || '', 160);
    return { mode: 'admin_token', userId };
  }

  const client = safeClientCredentials(input, req, { requireSecret: true });
  const query = `user_id=eq.${encodeURIComponent(client.userId)}&select=user_id,device_id,client_secret_hash,revoked&limit=1`;
  const rows = await supabaseFetch(`/rest/v1/${CLIENTS_TABLE}?${query}`, { method: 'GET' });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || row.revoked) {
    const err = new Error('Cliente de sincronização não registrado ou revogado. Use login Supabase no APK.');
    err.status = 401;
    err.code = 'SYNC_CLIENT_NOT_REGISTERED';
    throw err;
  }
  const expected = String(row.client_secret_hash || '');
  const supplied = clientSecretHash(client.userId, client.clientSecret);
  if (!expected || expected !== supplied) {
    const err = new Error('Credencial local de sincronização inválida.');
    err.status = 401;
    err.code = 'SYNC_CLIENT_INVALID';
    throw err;
  }
  supabaseFetch(`/rest/v1/${CLIENTS_TABLE}?user_id=eq.${encodeURIComponent(client.userId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ last_seen_at: nowIso(), app_version: client.appVersion || undefined, device_id: client.deviceId || undefined }),
  }).catch(() => {});
  return { mode: 'device_client', userId: client.userId, deviceId: client.deviceId };
}

async function upsertSnapshot(record, auth) {
  const userId = auth.userId;
  const row = safeRecord(record, userId);
  const result = await callSyncRpc('valorae_sync_upsert_snapshots', mutationRpcArgs(userId, record, [row], {
    p_backup: { snapshots: [{ domain: row.domain, snapshot_key: row.snapshot_key, payload: row.payload }] },
  }));
  const state = normalizeSyncState(result);
  return {
    ok: true,
    count: Number(result?.count || 1),
    backupMirrored: true,
    record: { user_id: row.user_id, domain: row.domain, snapshot_key: row.snapshot_key, updated_at: row.updated_at },
    syncState: state,
  };
}

async function upsertSnapshots(input, auth) {
  const userId = auth.userId;
  const arr = Array.isArray(input.snapshots) ? input.snapshots : Array.isArray(input.records) ? input.records : [];
  const rows = arr.map((record) => safeRecord(record, userId));
  if (!rows.length) return { ok: true, count: 0, message: 'Nenhum snapshot para salvar.', syncState: await getSyncState(userId) };
  const result = await callSyncRpc('valorae_sync_upsert_snapshots', mutationRpcArgs(userId, input, rows, {
    p_backup: { snapshots: rows.map((row) => ({ domain: row.domain, snapshot_key: row.snapshot_key, payload: row.payload })) },
  }));
  return {
    ok: true,
    count: Number(result?.count || rows.length),
    backupMirrored: true,
    snapshots: rows.map(snapshotToClient),
    syncState: normalizeSyncState(result),
  };
}

async function getSnapshot(input, auth) {
  const userId = auth.mode === 'device_client' || auth.mode === 'supabase_auth'
    ? auth.userId
    : safeText(input.userId || input.user_id || auth.userId || '', 160);
  const domain = normalizeDomain(input.domain);
  const snapshotKey = normalizeSnapshotKey(input.snapshotKey || input.snapshot_key || input.key);
  if (!userId || !domain || !snapshotKey) {
    const err = new Error('Informe userId, domain e snapshotKey.');
    err.status = 400;
    err.code = 'INVALID_SYNC_QUERY';
    throw err;
  }
  const state = await getSyncState(userId);
  if (state.tombstone) {
    const err = new Error('Snapshot indisponível porque a carteira foi excluída.');
    err.status = 404;
    err.code = 'SNAPSHOT_NOT_FOUND';
    throw err;
  }
  const queryBuilder = (select) => `user_id=eq.${encodeURIComponent(userId)}&domain=eq.${encodeURIComponent(domain)}&snapshot_key=eq.${encodeURIComponent(snapshotKey)}&select=${select}&order=updated_at.desc&limit=1`;
  const compatibility = await fetchSnapshotRowsWithCompat(queryBuilder);
  const rows = compatibility.rows;
  const record = Array.isArray(rows) ? rows[0] : null;
  if (!record) {
    const err = new Error('Snapshot não encontrado.');
    err.status = 404;
    err.code = 'SNAPSHOT_NOT_FOUND';
    throw err;
  }
  const snapshot = snapshotToClient(record);
  return {
    ok: true,
    record: snapshot,
    snapshot,
    snapshots: [snapshot],
    count: 1,
    schemaMode: compatibility.schemaMode,
    degraded: compatibility.degraded,
    warning: compatibility.warning,
    missingColumns: compatibility.missingColumns,
    syncState: state,
  };
}

async function getSnapshots(input, auth) {
  const userId = auth.mode === 'device_client' || auth.mode === 'supabase_auth'
    ? auth.userId
    : safeText(input.userId || input.user_id || auth.userId || '', 160);
  const state = await getSyncState(userId);
  if (state.tombstone) return { ok: true, count: 0, requested: 0, snapshots: [], syncState: state };
  const domain = normalizeDomain(input.domain);
  const keysInput = Array.isArray(input.keys) ? input.keys : String(input.keys || input.snapshot_keys || input.snapshotKeys || '').split(',');
  const keys = keysInput.map((key) => normalizeSnapshotKey(key)).filter(Boolean).slice(0, 60);
  if (!userId || !domain || !keys.length) {
    const err = new Error('Informe userId, domain e keys/snapshot_keys.');
    err.status = 400;
    err.code = 'INVALID_SYNC_QUERY';
    throw err;
  }
  const inValues = keys.map((key) => encodeURIComponent(key)).join(',');
  const queryBuilder = (select) => `user_id=eq.${encodeURIComponent(userId)}&domain=eq.${encodeURIComponent(domain)}&snapshot_key=in.(${inValues})&select=${select}&order=updated_at.desc`;
  const compatibility = await fetchSnapshotRowsWithCompat(queryBuilder);
  const rows = compatibility.rows;
  const snapshots = (Array.isArray(rows) ? rows : []).map(snapshotToClient);
  return {
    ok: true,
    count: snapshots.length,
    requested: keys.length,
    snapshots,
    schemaMode: compatibility.schemaMode,
    degraded: compatibility.degraded,
    warning: compatibility.warning,
    missingColumns: compatibility.missingColumns,
    syncState: state,
  };
}

function normalizeTransactionDate(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString().slice(0, 10);
  const raw = String(value).trim();
  const br = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : raw;
}

function transactionTimestamp(value) {
  const normalized = normalizeTransactionDate(value);
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : Date.now();
}

function transactionRow(userId, tx = {}, options = {}) {
  const ticker = normalizeTransactionSymbols([tx.ticker || tx.symbol || ''])[0] || '';
  const date = normalizeTransactionDate(tx.date || tx.transaction_date || tx.transactionDate || tx.imported_at || tx.importedAt || '');
  const quantity = Math.abs(Number(tx.quantity || 0));
  const price = Number(tx.price ?? tx.purchasePrice ?? tx.purchase_price ?? 0);
  const grossValue = Number(tx.grossValue ?? tx.gross_value ?? (Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0));
  const operation = classifyCorporateOperation(
    tx.operation || tx.side || tx.type || tx.tipo || (tx.isSell || tx.is_sell ? 'VENDA' : 'COMPRA'),
    { isSell: Boolean(tx.isSell || tx.is_sell), quantity: Number(tx.quantity || 0) },
  );
  const operationLabel = safeText(tx.operation || tx.side || operation.code, 80).toUpperCase();
  const fallbackSeed = [userId, ticker, date, operation.code, quantity, price, grossValue, tx.source || ''].join('|');
  const clientTxId = normalizeClientTxId(tx.client_tx_id || tx.clientTxId || tx.id || '', fallbackSeed);
  const assetType = safeText(tx.assetType || tx.asset_type || '', 40);
  const transactionTime = transactionTimestamp(date);
  const transactionDateValue = options.dateMode === 'iso'
    ? new Date(transactionTime).toISOString()
    : transactionTime;
  return {
    user_id: userId,
    client_tx_id: clientTxId,
    ticker,
    name: safeText(tx.name || ticker, 120),
    quantity: Number.isFinite(quantity) ? quantity : 0,
    purchase_price: Number.isFinite(price) ? price : 0,
    transaction_date: transactionDateValue,
    asset_type: assetType,
    is_sell: operation.reducesPosition,
    broker: safeText(tx.broker || '', 120),
    sector: safeText(tx.sector || '', 120),
    notes: safeText(tx.notes || '', 1000),
    payload: {
      ...tx,
      date,
      operation: operationLabel,
      operationCode: operation.code,
      operation_code: operation.code,
      quantityEffect: operation.quantityEffect,
      quantity_effect: operation.quantityEffect,
      costEffect: operation.costEffect,
      cost_effect: operation.costEffect,
      symbol: ticker,
      ticker,
      assetType,
      asset_type: assetType,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      price: Number.isFinite(price) ? price : 0,
      grossValue: Number.isFinite(grossValue) ? grossValue : 0,
      gross_value: Number.isFinite(grossValue) ? grossValue : 0,
      source: tx.source || 'B3',
      importedAt: Number(tx.importedAt ?? tx.imported_at ?? Date.now()),
      imported_at: Number(tx.importedAt ?? tx.imported_at ?? Date.now()),
      clientTxId,
      client_tx_id: clientTxId,
    },
    updated_at: nowIso(),
  };
}


function normalizeSingleTransactionSymbol(symbol) {
  return normalizeTicker(safeText(symbol, 40));
}

function normalizeTransactionSymbols(input = []) {
  const source = Array.isArray(input) ? input : String(input || '').split(',');
  return [...new Set(source
    .map((symbol) => normalizeSingleTransactionSymbol(symbol))
    .filter(Boolean)
    .slice(0, 80))];
}

function dedupeTransactionRowsByClientId(rows = []) {
  const seen = new Set();
  const output = [];
  for (const row of rows) {
    const key = normalizeClientTxId(row?.client_tx_id || '');
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    output.push(row);
  }
  return output;
}

async function upsertTransactions(input, auth) {
  const userId = auth.userId;
  const arr = Array.isArray(input.transactions) ? input.transactions : [];
  const rows = dedupeTransactionRowsByClientId(arr.map((tx) => transactionRow(userId, tx, { dateMode: 'iso' })).filter((r) => r.ticker));
  if (!rows.length) return { ok: true, count: 0, message: 'Nenhuma transação para salvar.', syncState: await getSyncState(userId) };
  const result = await callSyncRpc('valorae_sync_upsert_transactions', mutationRpcArgs(userId, input, rows, {
    p_backup: { transactions: rows.map((row) => row.payload || row) },
  }));
  return { ok: true, count: Number(result?.count || rows.length), backupMirrored: true, syncState: normalizeSyncState(result) };
}

async function replaceTransactionsForSymbols(input, auth) {
  const userId = auth.userId;
  const symbols = normalizeTransactionSymbols(input.symbols || input.tickers || input.symbol || input.ticker || []);
  if (!userId || !symbols.length) return { ok: true, count: 0, deleted: 0, message: 'Nenhum ticker para substituir.', syncState: await getSyncState(userId) };
  const arr = Array.isArray(input.transactions) ? input.transactions : [];
  const rows = dedupeTransactionRowsByClientId(arr
    .map((tx) => transactionRow(userId, tx, { dateMode: 'iso' }))
    .filter((r) => r.ticker && symbols.includes(r.ticker)));
  const result = await callSyncRpc('valorae_sync_replace_transactions', mutationRpcArgs(userId, input, rows, {
    p_symbols: symbols,
    p_reason: safeText(input.reason || 'replace_transactions_for_symbols', 120),
    p_backup: { symbols, transactions: rows.map((row) => row.payload || row) },
  }));
  return {
    ok: true,
    count: Number(result?.count || 0),
    deleted: Number(result?.deleted || 0),
    deletedScopeSymbols: symbols.length,
    symbols,
    backupMirrored: true,
    syncState: normalizeSyncState(result),
    message: rows.length ? `Histórico remoto substituído para ${symbols.length} ticker(s).` : `Histórico remoto limpo para ${symbols.length} ticker(s).`,
  };
}

async function getTransactions(input, auth) {
  const userId = auth.userId || safeText(input.userId || input.user_id || '', 160);
  const state = await getSyncState(userId);
  const limit = Math.min(Math.max(Number(input.limit || 250), 1), TRANSACTION_PAGE_LIMIT_MAX);
  const token = safeText(input.cursor || input.page_token || input.pageToken || '', 4096);
  let offset = 0;
  if (token) {
    const cursor = decodeRevisionCursor(token, syncCursorSecret());
    assertCursorMatchesState(cursor, state);
    offset = cursor.offset;
  } else if (Number(input.page || 1) > 1) {
    const err = new Error('Paginação por número de página não é segura. Use o cursor retornado pela página anterior.');
    err.status = 400;
    err.code = 'SYNC_CURSOR_REQUIRED';
    throw err;
  }
  if (state.tombstone) {
    return { ok: true, count: 0, transactions: [], has_more: false, next_cursor: null, syncState: state };
  }
  const q = `user_id=eq.${encodeURIComponent(userId)}&select=client_tx_id,ticker,name,quantity,purchase_price,transaction_date,asset_type,is_sell,broker,sector,notes,payload,updated_at&order=transaction_date.desc,client_tx_id.asc&limit=${limit + 1}&offset=${offset}`;
  const rows = await supabaseFetch(`/rest/v1/${TRANSACTIONS_TABLE}?${q}`, { method: 'GET' });
  const pageRows = (Array.isArray(rows) ? rows : []).slice(0, limit);
  const hasMore = Array.isArray(rows) && rows.length > limit;
  const uniqueRows = dedupeTransactionRowsByClientId(pageRows);
  const transactions = uniqueRows.map((r) => {
    const payload = r.payload || {};
    const classified = classifyCorporateOperation(payload.operationCode || payload.operation_code || payload.operation || (r.is_sell ? 'VENDA' : 'COMPRA'), { isSell: Boolean(r.is_sell), quantity: Number(r.quantity || 0) });
    const operation = safeText(payload.operation || classified.code, 80).toUpperCase();
    const price = Number(payload.price ?? payload.purchasePrice ?? r.purchase_price ?? 0);
    const grossValue = Number(payload.grossValue ?? payload.gross_value ?? (Number(r.quantity || 0) * price));
    const transactionMillis = transactionTimestamp(r.transaction_date || payload.date || payload.transaction_date || payload.transactionDate || Date.now());
    const ticker = normalizeSingleTransactionSymbol(payload.symbol || r.ticker);
    return {
      ...payload,
      id: Number(payload.id || 0) || 0,
      client_tx_id: normalizeClientTxId(r.client_tx_id || payload.client_tx_id || payload.clientTxId || ''),
      clientTxId: normalizeClientTxId(r.client_tx_id || payload.client_tx_id || payload.clientTxId || ''),
      symbol: ticker,
      ticker,
      name: r.name || ticker,
      operation,
      operationCode: classified.code,
      operation_code: classified.code,
      quantityEffect: classified.quantityEffect,
      quantity_effect: classified.quantityEffect,
      costEffect: classified.costEffect,
      cost_effect: classified.costEffect,
      quantity: Math.abs(Number(r.quantity || 0)),
      price,
      purchasePrice: price,
      grossValue,
      gross_value: grossValue,
      date: payload.date || normalizeTransactionDate(r.transaction_date),
      dateDisplay: formatBrDate(payload.date || normalizeTransactionDate(r.transaction_date), ''),
      assetType: payload.assetType || payload.asset_type || r.asset_type || '',
      asset_type: payload.asset_type || payload.assetType || r.asset_type || '',
      isSell: classified.reducesPosition,
      is_sell: classified.reducesPosition,
      broker: r.broker || payload.broker || '',
      sector: r.sector || payload.sector || '',
      notes: r.notes || payload.notes || '',
      source: payload.source || 'Supabase',
      importedAt: Number(payload.importedAt ?? payload.imported_at ?? transactionMillis),
      imported_at: Number(payload.imported_at ?? payload.importedAt ?? transactionMillis),
    };
  });
  const nextCursor = hasMore ? encodeRevisionCursor({ offset: offset + pageRows.length, ...state }, syncCursorSecret()) : null;
  return {
    ok: true,
    count: transactions.length,
    transactions,
    has_more: hasMore,
    hasMore,
    next_cursor: nextCursor,
    nextCursor,
    next_page_token: nextCursor,
    syncState: state,
  };
}

function dividendRow(userId, ev = {}) {
  const status = safeText(ev.status || '', 80);
  const low = status.toLowerCase();
  const normalizedTicker = normalizeSingleTransactionSymbol(ev.ticker || ev.symbol || '');
  const normalizedPayload = {
    ...ev,
    ticker: normalizedTicker,
    symbol: normalizedTicker,
    dateCom: safeText(ev.dateCom || ev.date_com || '', 40),
    exDate: safeText(ev.exDate || ev.ex_date || ev.dateEx || '', 40),
    inferredComDate: safeText(ev.inferredComDate || ev.inferred_com_date || ev.estimatedComDate || '', 40),
    eligibilityDateSource: safeText(ev.eligibilityDateSource || ev.eligibility_date_source || ev.dateComSource || '', 80),
    paymentDate: safeText(ev.paymentDate || ev.payment_date || '', 40),
  };
  return {
    user_id: userId,
    event_key: eventKey(userId, normalizedPayload),
    ticker: normalizeSingleTransactionSymbol(ev.ticker || ev.symbol || ''),
    date_com: normalizedPayload.dateCom,
    payment_date: normalizedPayload.paymentDate,
    value_per_share: Number(ev.valuePerShare ?? ev.value_per_share ?? ev.value ?? 0),
    quantity: Number(ev.quantity || 0),
    estimated_amount: Number(ev.estimatedAmount ?? ev.estimated_amount ?? 0),
    status,
    category: low.includes('pago') || low.includes('receb') || low.includes('paid') ? 'received' : 'future',
    source: safeText(ev.source || 'VALORAE', 160),
    payload: normalizedPayload,
    updated_at: nowIso(),
  };
}

async function upsertDividendEvents(input, auth) {
  const userId = auth.userId;
  const arr = Array.isArray(input.events) ? input.events : [];
  const rows = arr
    .filter((ev) => !isLocalDividendProjection(ev) && hasUsableDividendEvent(ev))
    .map((ev) => dividendRow(userId, ev))
    .filter((r) => r.ticker);
  if (!rows.length) return { ok: true, count: 0, message: 'Nenhum provento real para salvar. Previsões locais foram ignoradas.', syncState: await getSyncState(userId) };
  const result = await callSyncRpc('valorae_sync_upsert_dividends', mutationRpcArgs(userId, input, rows, {
    p_backup: { events: rows.map((row) => row.payload || row) },
  }));
  return {
    ok: true,
    count: Number(result?.count || rows.length),
    ignoredLocalProjections: Math.max(0, arr.length - rows.length),
    backupMirrored: true,
    syncState: normalizeSyncState(result),
  };
}

async function getDividendEvents(input, auth) {
  const userId = auth.userId || safeText(input.userId || input.user_id || '', 160);
  const state = await getSyncState(userId);
  if (state.tombstone) return { ok: true, count: 0, events: [], syncState: state };
  const category = safeText(input.category || '', 24);
  const catFilter = category ? `&category=eq.${encodeURIComponent(category)}` : '';
  const q = `user_id=eq.${encodeURIComponent(userId)}${catFilter}&select=*&order=payment_date.asc`;
  const rows = await supabaseFetch(`/rest/v1/${DIVIDENDS_TABLE}?${q}`, { method: 'GET' });
  const events = (Array.isArray(rows) ? rows : []).map((r) => r.payload || ({
    ticker: r.ticker,
    dateCom: r.date_com,
    dateComDisplay: formatBrDate(r.date_com, ''),
    exDate: r.ex_date || '',
    exDateDisplay: formatBrDate(r.ex_date, ''),
    inferredComDate: r.inferred_com_date || '',
    inferredComDateDisplay: formatBrDate(r.inferred_com_date, ''),
    eligibilityDateSource: r.eligibility_date_source || '',
    paymentDate: r.payment_date,
    paymentDateDisplay: formatBrDate(r.payment_date, ''),
    valuePerShare: Number(r.value_per_share || 0),
    quantity: Number(r.quantity || 0),
    estimatedAmount: Number(r.estimated_amount || 0),
    status: r.status,
    source: r.source,
  }));
  return { ok: true, count: events.length, events, syncState: state };
}

async function getSyncBackups(input, auth) {
  const userId = auth.userId || safeText(input.userId || input.user_id || '', 160);
  const state = await getSyncState(userId);
  if (state.tombstone) return { ok: true, count: 0, backups: [], syncState: state };
  const limit = Math.min(Math.max(Number(input.limit || 20), 1), 100);
  const q = `user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=${limit}`;
  const rows = await supabaseFetch(`/rest/v1/${BACKUPS_TABLE}?${q}`, { method: 'GET' });
  return { ok: true, count: Array.isArray(rows) ? rows.length : 0, backups: Array.isArray(rows) ? rows : [], syncState: state };
}

async function deleteUserData(input, auth) {
  const userId = safeText(auth.userId || '', 160);
  if (!userId) {
    const err = new Error('user_id ausente para apagar dados.');
    err.status = 400;
    err.code = 'INVALID_SYNC_IDENTITY';
    throw err;
  }
  const expected = expectedSyncState(input);
  const result = await callSyncRpc('valorae_sync_delete_user_data', {
    p_user_id: userId,
    p_expected_revision: expected.revision,
    p_expected_deletion_generation: expected.deletionGeneration,
    p_expected_tombstone: expected.tombstone,
    p_reason: safeText(input.reason || 'portfolio_cleared', 120),
  });
  const encodedUser = encodeURIComponent(userId);
  const verification = await Promise.all([
    supabaseFetch(`/rest/v1/${SNAPSHOT_TABLE}?user_id=eq.${encodedUser}&select=user_id&limit=1`, { method: 'GET' }),
    supabaseFetch(`/rest/v1/${TRANSACTIONS_TABLE}?user_id=eq.${encodedUser}&select=user_id&limit=1`, { method: 'GET' }),
    supabaseFetch(`/rest/v1/${DIVIDENDS_TABLE}?user_id=eq.${encodedUser}&select=user_id&limit=1`, { method: 'GET' }),
    supabaseFetch(`/rest/v1/${BACKUPS_TABLE}?user_id=eq.${encodedUser}&select=user_id&limit=1`, { method: 'GET' }),
  ]);
  if (verification.some((rows) => Array.isArray(rows) && rows.length > 0)) {
    const err = new Error('A exclusão não foi confirmada em todas as tabelas da nuvem.');
    err.status = 500;
    err.code = 'SYNC_DELETE_VERIFICATION_FAILED';
    throw err;
  }
  if (auth.mode === 'device_client') {
    await supabaseFetch(`/rest/v1/${CLIENTS_TABLE}?user_id=eq.${encodedUser}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({ revoked: true, last_seen_at: nowIso() }),
    });
  }
  return { ok: true, deleted: true, user_id: userId, syncState: normalizeSyncState(result), deletedCounts: result?.deleted_counts || {} };
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    route: 'sync',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_SYNC_MAX || 90),
    profile: 'supabase-sync',
    cacheControl: 'no-store',
  });
  if (route.done) return;
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cfg = getSupabaseConfig();
  const queryInput = getInput(req) || {};

  try {
    const bodyInput = req.method === 'POST' || req.method === 'DELETE' ? await parseJsonBody(req) : {};
    const input = { ...queryInput, ...bodyInput };
    const action = String(input.action || req.query?.action || (req.method === 'GET' ? 'health' : 'upsert_snapshot')).trim().toLowerCase();
    if (action === 'health') {
      return sendJson(req, res, {
        ok: true,
        version: ValoraeEngine.version,
        patch: CORE_VERSION,
        requestId: route.requestId,
        route: '/api/sync',
        supabase: {
          configured: cfg.configured,
          authConfigured: cfg.authConfigured,
          urlConfigured: Boolean(cfg.url),
          keyConfigured: Boolean(cfg.key),
          keyKind: cfg.keyKind,
          snapshotTable: SNAPSHOT_TABLE,
          clientsTable: CLIENTS_TABLE,
          transactionsTable: TRANSACTIONS_TABLE,
          dividendsTable: DIVIDENDS_TABLE,
          backupsTable: BACKUPS_TABLE,
          syncStateTable: SYNC_STATE_TABLE,
          cloudMode: 'cloud_primary_local_cache',
          authMode: 'supabase_email_password',
          legacyAdminTokenEnabled: Boolean(process.env.VALORAE_SUPABASE_SYNC_TOKEN),
        },
        capabilities: SYNC_CAPABILITIES,
        diagnosticsHint: 'Use /api/sync?action=diagnostics para testar conexão real com Supabase e tabelas.',
      }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
    }

    if (action === 'diagnostics' || action === 'self_test' || action === 'ping') {
      const diagnostics = await supabaseDiagnostics();
      return sendJson(req, res, {
        ok: diagnostics.ok,
        version: ValoraeEngine.version,
        patch: CORE_VERSION,
        requestId: route.requestId,
        route: '/api/sync',
        action,
        capabilities: diagnostics.capabilities || SYNC_CAPABILITIES,
        supabase: diagnostics,
      }, { status: diagnostics.configured ? 200 : 503, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
    }

    if (action === 'auth_check') {
      const result = await checkSupabaseAuth(req);
      return sendJson(req, res, {
        version: ValoraeEngine.version,
        patch: CORE_VERSION,
        requestId: route.requestId,
        route: '/api/sync',
        action,
        ...result,
      }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
    }

    if (!cfg.configured) {
      return sendJson(req, res, {
        ok: false,
        version: ValoraeEngine.version,
        patch: CORE_VERSION,
        requestId: route.requestId,
        code: 'SUPABASE_NOT_CONFIGURED',
        message: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel do Proxy.',
      }, { status: 503, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
    }

    if (action === 'register_client') {
      const result = await registerClient(input, req);
      return sendJson(req, res, { version: ValoraeEngine.version, patch: CORE_VERSION, requestId: route.requestId, ...result }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
    }

    const auth = await verifyClient(req, input);
    let result;
    if (action === 'get_sync_state') result = { ok: true, syncState: await getSyncState(auth.userId) };
    else if (action === 'upsert_snapshot') result = await upsertSnapshot(input.record ? { ...input.record, sync_state: input.sync_state || input.syncState, action_created_at: input.action_created_at || input.actionCreatedAt || input.createdAt } : input, auth);
    else if (action === 'upsert_snapshots') result = await upsertSnapshots(input, auth);
    else if (action === 'get_snapshot') result = await getSnapshot(input, auth);
    else if (action === 'get_snapshots') result = await getSnapshots(input, auth);
    else if (action === 'upsert_transactions') result = await upsertTransactions(input, auth);
    else if (action === 'replace_transactions_for_symbols') result = await replaceTransactionsForSymbols(input, auth);
    else if (action === 'get_transactions') result = await getTransactions(input, auth);
    else if (action === 'upsert_dividend_events') result = await upsertDividendEvents(input, auth);
    else if (action === 'get_dividend_events') result = await getDividendEvents(input, auth);
    else if (action === 'get_sync_backups') result = await getSyncBackups(input, auth);
    else if (action === 'delete_user_data') result = await deleteUserData(input, auth);
    else {
      return sendJson(req, res, {
        ok: false,
        version: ValoraeEngine.version,
        patch: CORE_VERSION,
        requestId: route.requestId,
        code: 'UNKNOWN_SYNC_ACTION',
        message: 'Ação de sync desconhecida.',
      }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
    }
    return sendJson(req, res, { version: ValoraeEngine.version, patch: CORE_VERSION, requestId: route.requestId, authMode: auth.mode, ...result }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
  } catch (err) {
    return sendJson(req, res, {
      ok: false,
      version: ValoraeEngine.version,
      patch: CORE_VERSION,
      requestId: route.requestId,
      code: err.code || 'SYNC_ERROR',
      message: err.message || 'Erro na sincronização Supabase.',
      details: process.env.NODE_ENV === 'production' ? undefined : err.details,
    }, { status: err.status || 500, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
  }
}

export const _test = {
  normalizeSingleTransactionSymbol,
  normalizeTransactionSymbols,
  transactionRow,
  dividendRow,
  eventKey,
  hasUsableDividendEvent,
};
