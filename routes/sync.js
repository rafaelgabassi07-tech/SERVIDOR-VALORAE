import crypto from 'node:crypto';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute, getInput } from '../lib/http/route.js';
import { ValoraeEngine } from '../lib/Valorae-engine.js';

const SNAPSHOT_TABLE = process.env.VALORAE_SUPABASE_SNAPSHOT_TABLE || 'valorae_user_snapshots';
const CLIENTS_TABLE = process.env.VALORAE_SUPABASE_CLIENTS_TABLE || 'valorae_sync_clients';
const TRANSACTIONS_TABLE = process.env.VALORAE_SUPABASE_TRANSACTIONS_TABLE || 'valorae_transactions';
const DIVIDENDS_TABLE = process.env.VALORAE_SUPABASE_DIVIDENDS_TABLE || 'valorae_dividend_events';
const CORE_VERSION = '21.12.147-sync-pending-diagnostics-v84';
const SYNC_CAPABILITIES = Object.freeze([
  'health',
  'diagnostics',
  'auth_check',
  'register_client',
  'upsert_snapshot',
  'get_snapshot',
  'upsert_snapshots',
  'get_snapshots',
  'upsert_transactions',
  'replace_transactions_for_symbols',
  'get_transactions',
  'upsert_dividend_events',
  'get_dividend_events',
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
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  if (!req || typeof req.on !== 'function') return {};
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
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

function clientSecretHash(userId, clientSecret) {
  const pepper = String(process.env.VALORAE_SUPABASE_CLIENT_SECRET_PEPPER || process.env.VALORAE_SUPABASE_SYNC_TOKEN || '').trim();
  return crypto.createHash('sha256').update(`${pepper}:${userId}:${clientSecret}`).digest('hex');
}

function eventKey(userId, ev = {}) {
  const raw = [
    userId,
    ev.ticker || ev.symbol || '',
    ev.paymentDate || ev.payment_date || '',
    ev.dateCom || ev.date_com || '',
    ev.valuePerShare || ev.value_per_share || ev.value || '',
    ev.status || '',
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
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
  const ticker = safeText(ev.ticker || ev.symbol || '', 32);
  const dateCom = safeText(ev.dateCom || ev.date_com || '', 40);
  const paymentDate = safeText(ev.paymentDate || ev.payment_date || '', 40);
  const value = Number(ev.valuePerShare ?? ev.value_per_share ?? ev.value ?? 0);
  const amount = Number(ev.estimatedAmount ?? ev.estimated_amount ?? 0);
  return Boolean(ticker) && Boolean(dateCom || paymentDate) && (Number.isFinite(value) && value > 0 || Number.isFinite(amount) && amount > 0);
}

async function purgeLocalDividendPredictions(userId) {
  const encodedUser = encodeURIComponent(userId);
  await Promise.all([
    supabaseFetch(`/rest/v1/${DIVIDENDS_TABLE}?user_id=eq.${encodedUser}&source=ilike.*local*`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }).catch(() => null),
    supabaseFetch(`/rest/v1/${DIVIDENDS_TABLE}?user_id=eq.${encodedUser}&status=ilike.*local*`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }).catch(() => null),
    supabaseFetch(`/rest/v1/${DIVIDENDS_TABLE}?user_id=eq.${encodedUser}&source=ilike.*estimativa*`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }).catch(() => null),
    supabaseFetch(`/rest/v1/${DIVIDENDS_TABLE}?user_id=eq.${encodedUser}&status=ilike.*previs*`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }).catch(() => null),
  ]);
}

function safeClientCredentials(input = {}, req, { requireSecret = true } = {}) {
  const userId = safeText(input.user_id || input.userId || header(req, 'x-valorae-user-id'), 160);
  const deviceId = safeText(input.device_id || input.deviceId || header(req, 'x-valorae-device-id'), 160);
  const clientSecret = safeText(input.client_secret || input.clientSecret || header(req, 'x-valorae-client-secret'), 240);
  const appVersion = safeText(input.app_version || input.appVersion || header(req, 'x-valorae-app-version'), 40);
  const source = safeText(input.source || input.client_kind || header(req, 'x-valorae-client-kind') || 'apk-android', 80);

  if (!userId || !/^valorae-[a-z0-9-]{20,}$/i.test(userId)) {
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
  const explicitExpiresAt = safeText(input.expires_at || input.expiresAt || '', 80);
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
    source_updated_at: safeText(input.source_updated_at || input.sourceUpdatedAt || '', 80) || null,
    etag: safeText(input.etag || '', 160) || null,
    payload_size_bytes: payloadSize,
    encrypted: Boolean(input.encrypted),
    payload,
    payload_ciphertext: input.encrypted ? String(input.payload_ciphertext || input.payloadCiphertext || '') : null,
    updated_at: input.updated_at || input.updatedAt || nowIso(),
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
  const probes = await Promise.all([
    probeSupabaseTable(SNAPSHOT_TABLE, 'snapshots'),
    probeSupabaseTable(CLIENTS_TABLE, 'clients'),
    probeSupabaseTable(TRANSACTIONS_TABLE, 'transactions'),
    probeSupabaseTable(DIVIDENDS_TABLE, 'dividends'),
  ]);
  const failed = probes.filter((p) => !p.ok);
  return {
    ok: failed.length === 0,
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
  const client = safeClientCredentials(input, req, { requireSecret: true });
  const row = {
    user_id: client.userId,
    device_id: client.deviceId,
    client_secret_hash: clientSecretHash(client.userId, client.clientSecret),
    app_version: client.appVersion,
    source: client.source,
    schema_version: 2,
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
    authMode: 'device_client',
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
  const forcedUserId = auth.mode === 'device_client' || auth.mode === 'supabase_auth' ? auth.userId : '';
  const row = safeRecord(record, forcedUserId);
  if (auth.userId && row.user_id !== auth.userId) {
    const err = new Error('user_id do registro não combina com a identidade autenticada.');
    err.status = 403;
    err.code = 'SYNC_USER_MISMATCH';
    throw err;
  }
  await supabaseFetch(`/rest/v1/${SNAPSHOT_TABLE}?on_conflict=user_id,domain,snapshot_key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  return { ok: true, record: { user_id: row.user_id, domain: row.domain, snapshot_key: row.snapshot_key, updated_at: row.updated_at } };
}

async function upsertSnapshots(input, auth) {
  const forcedUserId = auth.mode === 'device_client' || auth.mode === 'supabase_auth' ? auth.userId : '';
  const arr = Array.isArray(input.snapshots) ? input.snapshots : Array.isArray(input.records) ? input.records : [];
  const rows = arr.map((record) => safeRecord(record, forcedUserId));
  if (!rows.length) return { ok: true, count: 0, message: 'Nenhum snapshot para salvar.' };
  if (auth.userId && rows.some((row) => row.user_id !== auth.userId)) {
    const err = new Error('Um ou mais snapshots não combinam com a identidade autenticada.');
    err.status = 403;
    err.code = 'SYNC_USER_MISMATCH';
    throw err;
  }
  await supabaseFetch(`/rest/v1/${SNAPSHOT_TABLE}?on_conflict=user_id,domain,snapshot_key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  return { ok: true, count: rows.length, snapshots: rows.map(snapshotToClient) };
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
  const select = 'payload,payload_ciphertext,encrypted,updated_at,domain,snapshot_key,user_id,cache_scope,cache_ttl_seconds,expires_at,source,source_updated_at,etag,payload_size_bytes';
  const q = `user_id=eq.${encodeURIComponent(userId)}&domain=eq.${encodeURIComponent(domain)}&snapshot_key=eq.${encodeURIComponent(snapshotKey)}&select=${select}&order=updated_at.desc&limit=1`;
  const rows = await supabaseFetch(`/rest/v1/${SNAPSHOT_TABLE}?${q}`, { method: 'GET' });
  const record = Array.isArray(rows) ? rows[0] : null;
  if (!record) {
    const err = new Error('Snapshot não encontrado.');
    err.status = 404;
    err.code = 'SNAPSHOT_NOT_FOUND';
    throw err;
  }
  const snapshot = snapshotToClient(record);
  return { ok: true, record: snapshot, snapshot, snapshots: [snapshot], count: 1 };
}

async function getSnapshots(input, auth) {
  const userId = auth.mode === 'device_client' || auth.mode === 'supabase_auth'
    ? auth.userId
    : safeText(input.userId || input.user_id || auth.userId || '', 160);
  const domain = normalizeDomain(input.domain);
  const keysInput = Array.isArray(input.keys) ? input.keys : String(input.keys || input.snapshot_keys || input.snapshotKeys || '').split(',');
  const keys = keysInput.map((key) => normalizeSnapshotKey(key)).filter(Boolean).slice(0, 60);
  if (!userId || !domain || !keys.length) {
    const err = new Error('Informe userId, domain e keys/snapshot_keys.');
    err.status = 400;
    err.code = 'INVALID_SYNC_QUERY';
    throw err;
  }
  const select = 'payload,payload_ciphertext,encrypted,updated_at,domain,snapshot_key,user_id,cache_scope,cache_ttl_seconds,expires_at,source,source_updated_at,etag,payload_size_bytes';
  const inValues = keys.map((key) => encodeURIComponent(key)).join(',');
  const q = `user_id=eq.${encodeURIComponent(userId)}&domain=eq.${encodeURIComponent(domain)}&snapshot_key=in.(${inValues})&select=${select}&order=updated_at.desc`;
  const rows = await supabaseFetch(`/rest/v1/${SNAPSHOT_TABLE}?${q}`, { method: 'GET' });
  const snapshots = (Array.isArray(rows) ? rows : []).map(snapshotToClient);
  return { ok: true, count: snapshots.length, requested: keys.length, snapshots };
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

function transactionRow(userId, tx = {}) {
  const ticker = safeText(tx.ticker || tx.symbol || '', 32).toUpperCase().replace('.SA', '');
  const date = normalizeTransactionDate(tx.date || tx.transaction_date || tx.transactionDate || tx.imported_at || tx.importedAt || '');
  const operation = safeText(tx.operation || tx.side || (tx.isSell || tx.is_sell ? 'VENDA' : 'COMPRA'), 40).toUpperCase();
  const quantity = Number(tx.quantity || 0);
  const price = Number(tx.price ?? tx.purchasePrice ?? tx.purchase_price ?? 0);
  const grossValue = Number(tx.grossValue ?? tx.gross_value ?? (Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0));
  const rawId = safeText(tx.client_tx_id || tx.clientTxId || tx.id || `${ticker}-${date}-${operation}-${quantity}-${price}-${grossValue}`, 160);
  const clientTxId = rawId || crypto.randomUUID();
  const assetType = safeText(tx.assetType || tx.asset_type || tx.type || '', 40);
  return {
    user_id: userId,
    client_tx_id: clientTxId,
    ticker,
    name: safeText(tx.name || ticker, 120),
    quantity: Number.isFinite(quantity) ? quantity : 0,
    purchase_price: Number.isFinite(price) ? price : 0,
    transaction_date: transactionTimestamp(date),
    asset_type: assetType,
    is_sell: operation.includes('VENDA') || operation === 'V',
    broker: safeText(tx.broker || '', 120),
    sector: safeText(tx.sector || '', 120),
    notes: safeText(tx.notes || '', 1000),
    payload: {
      ...tx,
      date,
      operation,
      symbol: ticker,
      assetType,
      asset_type: assetType,
      price: Number.isFinite(price) ? price : 0,
      grossValue: Number.isFinite(grossValue) ? grossValue : 0,
      gross_value: Number.isFinite(grossValue) ? grossValue : 0,
      source: tx.source || 'B3',
      importedAt: Number(tx.importedAt ?? tx.imported_at ?? Date.now()),
      imported_at: Number(tx.importedAt ?? tx.imported_at ?? Date.now()),
    },
    updated_at: nowIso(),
  };
}


function normalizeTransactionSymbols(input = []) {
  const source = Array.isArray(input) ? input : String(input || '').split(',');
  return [...new Set(source
    .map((symbol) => safeText(symbol, 32).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/F$/, (match, offset, value) => /^[A-Z]{4}[0-9]{1,2}F$/.test(value) ? '' : match))
    .filter(Boolean)
    .slice(0, 80))];
}

function postgrestIn(values = []) {
  return values.map((value) => encodeURIComponent(value)).join(',');
}

async function upsertTransactions(input, auth) {
  const userId = auth.userId;
  const arr = Array.isArray(input.transactions) ? input.transactions : [];
  const rows = arr.map((tx) => transactionRow(userId, tx)).filter((r) => r.ticker);
  if (!rows.length) return { ok: true, count: 0, message: 'Nenhuma transação para salvar.' };
  await supabaseFetch(`/rest/v1/${TRANSACTIONS_TABLE}?on_conflict=user_id,client_tx_id`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  return { ok: true, count: rows.length };
}

async function replaceTransactionsForSymbols(input, auth) {
  const userId = auth.userId;
  const symbols = normalizeTransactionSymbols(input.symbols || input.tickers || input.symbol || input.ticker || []);
  if (!userId || !symbols.length) return { ok: true, count: 0, deleted: 0, message: 'Nenhum ticker para substituir.' };

  const arr = Array.isArray(input.transactions) ? input.transactions : [];
  const rows = arr
    .map((tx) => transactionRow(userId, tx))
    .filter((r) => r.ticker && symbols.includes(r.ticker));

  await supabaseFetch(`/rest/v1/${TRANSACTIONS_TABLE}?user_id=eq.${encodeURIComponent(userId)}&ticker=in.(${postgrestIn(symbols)})`, {
    method: 'DELETE',
    headers: { prefer: 'return=minimal' },
  });

  if (rows.length) {
    await supabaseFetch(`/rest/v1/${TRANSACTIONS_TABLE}?on_conflict=user_id,client_tx_id`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
  }

  return {
    ok: true,
    count: rows.length,
    deletedScopeSymbols: symbols.length,
    symbols,
    message: rows.length
      ? `Histórico remoto substituído para ${symbols.length} ticker(s).`
      : `Histórico remoto limpo para ${symbols.length} ticker(s).`,
  };
}

async function getTransactions(input, auth) {
  const userId = auth.userId || safeText(input.userId || input.user_id || '', 160);
  const q = `user_id=eq.${encodeURIComponent(userId)}&select=client_tx_id,ticker,name,quantity,purchase_price,transaction_date,asset_type,is_sell,broker,sector,notes,payload,updated_at&order=transaction_date.desc`;
  const rows = await supabaseFetch(`/rest/v1/${TRANSACTIONS_TABLE}?${q}`, { method: 'GET' });
  const transactions = (Array.isArray(rows) ? rows : []).map((r) => {
    const payload = r.payload || {};
    const operation = safeText(payload.operation || (r.is_sell ? 'VENDA' : 'COMPRA'), 40).toUpperCase();
    const price = Number(payload.price ?? payload.purchasePrice ?? r.purchase_price ?? 0);
    const grossValue = Number(payload.grossValue ?? payload.gross_value ?? (Number(r.quantity || 0) * price));
    return {
      ...payload,
      id: Number(payload.id || r.client_tx_id || 0) || 0,
      client_tx_id: r.client_tx_id,
      symbol: payload.symbol || r.ticker,
      ticker: r.ticker,
      name: r.name || r.ticker,
      operation,
      quantity: Number(r.quantity || 0),
      price,
      purchasePrice: price,
      grossValue,
      gross_value: grossValue,
      date: payload.date || normalizeTransactionDate(r.transaction_date),
      assetType: payload.assetType || payload.asset_type || r.asset_type || '',
      asset_type: payload.asset_type || payload.assetType || r.asset_type || '',
      isSell: Boolean(r.is_sell),
      is_sell: Boolean(r.is_sell),
      broker: r.broker || payload.broker || '',
      sector: r.sector || payload.sector || '',
      notes: r.notes || payload.notes || '',
      source: payload.source || 'Supabase',
      importedAt: Number(payload.importedAt ?? payload.imported_at ?? r.transaction_date ?? Date.now()),
      imported_at: Number(payload.imported_at ?? payload.importedAt ?? r.transaction_date ?? Date.now()),
    };
  });
  return { ok: true, count: transactions.length, transactions };
}

function dividendRow(userId, ev = {}) {
  const status = safeText(ev.status || '', 80);
  const low = status.toLowerCase();
  return {
    user_id: userId,
    event_key: eventKey(userId, ev),
    ticker: safeText(ev.ticker || ev.symbol || '', 32).toUpperCase().replace('.SA', ''),
    date_com: safeText(ev.dateCom || ev.date_com || '', 40),
    payment_date: safeText(ev.paymentDate || ev.payment_date || '', 40),
    value_per_share: Number(ev.valuePerShare ?? ev.value_per_share ?? ev.value ?? 0),
    quantity: Number(ev.quantity || 0),
    estimated_amount: Number(ev.estimatedAmount ?? ev.estimated_amount ?? 0),
    status,
    category: low.includes('pago') || low.includes('receb') || low.includes('paid') ? 'received' : 'future',
    source: safeText(ev.source || 'VALORAE', 160),
    payload: ev,
    updated_at: nowIso(),
  };
}

async function upsertDividendEvents(input, auth) {
  const userId = auth.userId;
  const arr = Array.isArray(input.events) ? input.events : [];
  await purgeLocalDividendPredictions(userId);
  const rows = arr
    .filter((ev) => !isLocalDividendProjection(ev) && hasUsableDividendEvent(ev))
    .map((ev) => dividendRow(userId, ev))
    .filter((r) => r.ticker);
  if (!rows.length) return { ok: true, count: 0, message: 'Nenhum provento real para salvar. Previsões locais foram ignoradas.' };
  await supabaseFetch(`/rest/v1/${DIVIDENDS_TABLE}?on_conflict=user_id,event_key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  return { ok: true, count: rows.length, ignoredLocalProjections: Math.max(0, arr.length - rows.length) };
}

async function getDividendEvents(input, auth) {
  const userId = auth.userId || safeText(input.userId || input.user_id || '', 160);
  const category = safeText(input.category || '', 24);
  const catFilter = category ? `&category=eq.${encodeURIComponent(category)}` : '';
  const q = `user_id=eq.${encodeURIComponent(userId)}${catFilter}&select=*&order=payment_date.asc`;
  const rows = await supabaseFetch(`/rest/v1/${DIVIDENDS_TABLE}?${q}`, { method: 'GET' });
  const events = (Array.isArray(rows) ? rows : []).map((r) => r.payload || ({
    ticker: r.ticker,
    dateCom: r.date_com,
    paymentDate: r.payment_date,
    valuePerShare: Number(r.value_per_share || 0),
    quantity: Number(r.quantity || 0),
    estimatedAmount: Number(r.estimated_amount || 0),
    status: r.status,
    source: r.source,
  }));
  return { ok: true, count: events.length, events };
}

async function deleteUserData(auth) {
  const userId = safeText(auth.userId || '', 160);
  if (!userId) {
    const err = new Error('user_id ausente para apagar dados.');
    err.status = 400;
    err.code = 'INVALID_SYNC_IDENTITY';
    throw err;
  }
  await Promise.all([
    supabaseFetch(`/rest/v1/${SNAPSHOT_TABLE}?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }),
    supabaseFetch(`/rest/v1/${TRANSACTIONS_TABLE}?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }).catch(() => null),
    supabaseFetch(`/rest/v1/${DIVIDENDS_TABLE}?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }).catch(() => null),
  ]);
  if (auth.mode === 'device_client') {
    await supabaseFetch(`/rest/v1/${CLIENTS_TABLE}?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({ revoked: true, last_seen_at: nowIso() }),
    });
  }
  return { ok: true, deleted: true, user_id: userId };
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
  const bodyInput = req.method === 'POST' || req.method === 'DELETE' ? await parseJsonBody(req) : {};
  const input = { ...queryInput, ...bodyInput };
  const action = String(input.action || req.query?.action || (req.method === 'GET' ? 'health' : 'upsert_snapshot')).trim().toLowerCase();

  try {
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
    if (action === 'upsert_snapshot') result = await upsertSnapshot(input.record || input, auth);
    else if (action === 'upsert_snapshots') result = await upsertSnapshots(input, auth);
    else if (action === 'get_snapshot') result = await getSnapshot(input, auth);
    else if (action === 'get_snapshots') result = await getSnapshots(input, auth);
    else if (action === 'upsert_transactions') result = await upsertTransactions(input, auth);
    else if (action === 'replace_transactions_for_symbols') result = await replaceTransactionsForSymbols(input, auth);
    else if (action === 'get_transactions') result = await getTransactions(input, auth);
    else if (action === 'upsert_dividend_events') result = await upsertDividendEvents(input, auth);
    else if (action === 'get_dividend_events') result = await getDividendEvents(input, auth);
    else if (action === 'delete_user_data') result = await deleteUserData(auth);
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
