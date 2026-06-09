import { sendJson } from '../lib/performance/http.js';
import { beginRoute, getInput } from '../lib/http/route.js';
import { ValoraeEngine } from '../lib/Valorae-engine.js';

const SNAPSHOT_TABLE = process.env.VALORAE_SUPABASE_SNAPSHOT_TABLE || 'valorae_user_snapshots';
const CORE_VERSION = '21.12.76-supabase-sync';

function cleanUrl(raw = '') {
  return String(raw || '').trim().replace(/\/+$/, '');
}

function boolEnv(name, fallback = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'sim', 'on', 'enabled'].includes(raw);
}

function getSupabaseConfig() {
  const url = cleanUrl(process.env.SUPABASE_URL || process.env.VALORAE_SUPABASE_URL || '');
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VALORAE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
  const keyKind = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VALORAE_SUPABASE_SERVICE_ROLE_KEY
    ? 'server_secret'
    : (key ? 'public_key' : 'missing');
  return { url, key, keyKind, configured: url.startsWith('https://') && Boolean(key) };
}

function requireSyncToken(req, action = 'write') {
  const configured = String(process.env.VALORAE_SUPABASE_SYNC_TOKEN || '').trim();
  if (!configured) {
    const err = new Error('VALORAE_SUPABASE_SYNC_TOKEN não configurado no Proxy. Por segurança, escritas via /api/sync exigem token quando o backend fala com Supabase.');
    err.status = 403;
    err.code = 'SYNC_TOKEN_REQUIRED';
    throw err;
  }
  const supplied = String(req.headers?.['x-valorae-sync-token'] || req.headers?.['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (supplied !== configured) {
    const err = new Error('Token de sincronização inválido.');
    err.status = 401;
    err.code = 'SYNC_TOKEN_INVALID';
    throw err;
  }
  return true;
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

function safeRecord(input = {}) {
  const domain = String(input.domain || '').trim().toLowerCase();
  const snapshotKey = String(input.snapshot_key || input.snapshotKey || '').trim().toLowerCase();
  const userId = String(input.user_id || input.userId || '').trim();
  if (!userId || !domain || !snapshotKey) {
    const err = new Error('Campos obrigatórios ausentes: user_id, domain e snapshot_key.');
    err.status = 400;
    err.code = 'INVALID_SYNC_RECORD';
    throw err;
  }
  const now = new Date().toISOString();
  return {
    user_id: userId.slice(0, 160),
    domain: domain.slice(0, 64),
    snapshot_key: snapshotKey.slice(0, 96),
    schema_version: Number(input.schema_version || 1),
    app_version: String(input.app_version || '').slice(0, 40),
    device_id: String(input.device_id || '').slice(0, 160),
    source: String(input.source || 'valorae-proxy').slice(0, 80),
    encrypted: Boolean(input.encrypted),
    payload: input.encrypted ? null : (input.payload ?? {}),
    payload_ciphertext: input.encrypted ? String(input.payload_ciphertext || '') : null,
    updated_at: input.updated_at || now,
  };
}

async function supabaseFetch(path, init = {}) {
  const cfg = getSupabaseConfig();
  if (!cfg.configured) {
    const err = new Error('Supabase não configurado no Proxy. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY.');
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

async function upsertSnapshot(record) {
  const row = safeRecord(record);
  await supabaseFetch(`/rest/v1/${SNAPSHOT_TABLE}?on_conflict=user_id,domain,snapshot_key`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  return { ok: true, record: { user_id: row.user_id, domain: row.domain, snapshot_key: row.snapshot_key, updated_at: row.updated_at } };
}

async function getSnapshot(input) {
  const userId = String(input.userId || input.user_id || '').trim();
  const domain = String(input.domain || '').trim().toLowerCase();
  const snapshotKey = String(input.snapshotKey || input.snapshot_key || '').trim().toLowerCase();
  if (!userId || !domain || !snapshotKey) {
    const err = new Error('Informe userId, domain e snapshotKey.');
    err.status = 400;
    err.code = 'INVALID_SYNC_QUERY';
    throw err;
  }
  const q = `user_id=eq.${encodeURIComponent(userId)}&domain=eq.${encodeURIComponent(domain)}&snapshot_key=eq.${encodeURIComponent(snapshotKey)}&select=payload,payload_ciphertext,encrypted,updated_at,domain,snapshot_key,user_id&order=updated_at.desc&limit=1`;
  const rows = await supabaseFetch(`/rest/v1/${SNAPSHOT_TABLE}?${q}`, { method: 'GET' });
  const record = Array.isArray(rows) ? rows[0] : null;
  if (!record) {
    const err = new Error('Snapshot não encontrado.');
    err.status = 404;
    err.code = 'SNAPSHOT_NOT_FOUND';
    throw err;
  }
  return { ok: true, record };
}

export default async function handler(req, res) {
  const route = beginRoute(req, res, {
    version: ValoraeEngine.version,
    methods: ['GET', 'POST', 'OPTIONS'],
    route: 'sync',
    rateMax: Number(process.env.VALORAE_RATE_LIMIT_SYNC_MAX || 45),
    profile: 'supabase-sync',
    cacheControl: 'no-store',
  });
  if (route.done) return;
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cfg = getSupabaseConfig();
  const queryInput = getInput(req) || {};
  const bodyInput = req.method === 'POST' ? await parseJsonBody(req) : {};
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
          urlConfigured: Boolean(cfg.url),
          keyConfigured: Boolean(cfg.key),
          keyKind: cfg.keyKind,
          table: SNAPSHOT_TABLE,
          tokenRequiredForWrite: Boolean(process.env.VALORAE_SUPABASE_SYNC_TOKEN),
        },
        capabilities: ['health', 'upsert_snapshot', 'get_snapshot'],
      }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
    }

    if (!cfg.configured) {
      return sendJson(req, res, {
        ok: false,
        version: ValoraeEngine.version,
        patch: CORE_VERSION,
        requestId: route.requestId,
        code: 'SUPABASE_NOT_CONFIGURED',
        message: 'Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel para habilitar a ponte Supabase via Proxy.',
      }, { status: 503, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
    }

    if (action === 'upsert_snapshot') {
      requireSyncToken(req, 'write');
      const record = input.record || input;
      const result = await upsertSnapshot(record);
      return sendJson(req, res, { version: ValoraeEngine.version, patch: CORE_VERSION, requestId: route.requestId, ...result }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
    }

    if (action === 'get_snapshot') {
      requireSyncToken(req, 'read');
      const result = await getSnapshot(input);
      return sendJson(req, res, { version: ValoraeEngine.version, patch: CORE_VERSION, requestId: route.requestId, ...result }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
    }

    return sendJson(req, res, {
      ok: false,
      version: ValoraeEngine.version,
      patch: CORE_VERSION,
      requestId: route.requestId,
      code: 'UNKNOWN_SYNC_ACTION',
      message: 'Ação de sync desconhecida. Use health, upsert_snapshot ou get_snapshot.',
    }, { status: 400, engineVersion: ValoraeEngine.version, profile: 'supabase-sync', cacheControl: 'no-store' });
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
