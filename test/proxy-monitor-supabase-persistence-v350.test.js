import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  attachProxyMetricsInterceptor,
  getServerMetricsSnapshot,
  resetServerMetricsForTests,
} from '../lib/observability/server-metrics.js';
import {
  flushMonitorPersistenceForTests,
  loadPersistedMonitorEvents,
  monitorPersistenceStatus,
  resetMonitorPersistenceForTests,
} from '../lib/observability/monitor-persistence.js';

const envNames = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VALORAE_MONITOR_PERSISTENCE_ENABLED',
  'VALORAE_MONITOR_PERSISTENCE_SCOPE',
  'VALORAE_MONITOR_PERSISTENCE_TABLE',
  'VALORAE_MONITOR_PERSISTENCE_DEBOUNCE_MS',
  'VALORAE_MONITOR_PERSISTENCE_READ_CACHE_MS',
  'VALORAE_MONITOR_PERSISTENCE_TIMEOUT_MS',
];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
const requests = [];
let storedRows = [];

function restore() {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  globalThis.fetch = originalFetch;
  resetMonitorPersistenceForTests();
  resetServerMetricsForTests();
}

try {
  process.env.SUPABASE_URL = 'https://example.supabase.co/rest/v1';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.VALORAE_MONITOR_PERSISTENCE_ENABLED = '1';
  process.env.VALORAE_MONITOR_PERSISTENCE_SCOPE = 'production';
  process.env.VALORAE_MONITOR_PERSISTENCE_TABLE = 'valorae_monitor_events';
  process.env.VALORAE_MONITOR_PERSISTENCE_DEBOUNCE_MS = '0';
  process.env.VALORAE_MONITOR_PERSISTENCE_READ_CACHE_MS = '500';
  process.env.VALORAE_MONITOR_PERSISTENCE_TIMEOUT_MS = '1000';

  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(init.method || 'GET').toUpperCase() === 'POST') {
      const rows = JSON.parse(String(init.body || '[]'));
      storedRows = [...storedRows.filter(row => !rows.some(next => next.event_key === row.event_key)), ...rows];
      return new Response('', { status: 201, headers: { 'content-type': 'application/json' } });
    }
    const rows = [...storedRows]
      .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
      .map(row => ({
        event_key: row.event_key,
        instance_id: row.instance_id,
        release_patch: row.release_patch,
        occurred_at: row.occurred_at,
        event: row.event,
      }));
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0',
      },
    });
  };

  resetMonitorPersistenceForTests();
  resetServerMetricsForTests();

  const headers = new Map([['content-type', 'application/json']]);
  const backgroundTasks = [];
  const req = {
    method: 'GET',
    url: '/api/v1/asset/quote?ticker=PETR4',
    waitUntil(task) { backgroundTasks.push(task); },
    headers: {
      'x-valorae-app': 'VALORAE APK',
      'x-valorae-channel': 'mobile',
      'x-request-id': 'persist-monitor-test',
    },
  };
  const res = {
    statusCode: 200,
    writableEnded: false,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    write() { return true; },
    end() { this.writableEnded = true; return this; },
  };

  attachProxyMetricsInterceptor(req, res);
  res.end(JSON.stringify({ status: 'OK', ticker: 'PETR4', price: 35.4 }));
  assert.equal(res.writableEnded, true, 'a resposta precisa terminar antes da persistência');
  assert.equal(storedRows.length, 0, 'a escrita remota não pode bloquear o envio da resposta');
  assert.equal(backgroundTasks.length, 1, 'a tarefa pós-resposta precisa ser registrada em waitUntil');
  await Promise.all(backgroundTasks);
  await flushMonitorPersistenceForTests();

  assert.equal(storedRows.length, 1, 'o evento precisa ser gravado no Supabase');
  assert.match(storedRows[0].event_key, /^[0-9a-f-]+:1$/i);
  assert.equal(storedRows[0].scope, 'production');
  assert.equal(storedRows[0].route, '/api/v1/asset/quote');
  assert.equal(storedRows[0].event.client, undefined, 'hash interno do cliente não deve ser persistido');
  assert.equal(storedRows[0].event.requestId, 'persist-monitor-test');
  assert.ok(requests[0].url.includes('/rest/v1/valorae_monitor_events?on_conflict=event_key'));
  assert.equal(requests[0].init.headers.prefer, 'resolution=merge-duplicates,return=minimal');

  const history = await loadPersistedMonitorEvents({ force: true });
  assert.equal(history.total, 1);
  assert.equal(history.events.length, 1);
  assert.equal(history.events[0].eventKey, storedRows[0].event_key);
  assert.equal(history.status.operational, true);

  const snapshot = getServerMetricsSnapshot({
    persistedEvents: history.events,
    persistedTotal: history.total,
    persistence: history.status,
  });
  assert.equal(snapshot.serverless.persistent, true);
  assert.equal(snapshot.summary.persistentEventsStored, 1);
  assert.equal(snapshot.summary.eventsAvailable, 1, 'evento local e persistido devem ser deduplicados por eventKey');
  assert.equal(snapshot.proxyOutputMonitor.outputFeed.length, 1);
  assert.equal(snapshot.proxyOutputMonitor.outputFeed[0].eventKey, storedRows[0].event_key);
  assert.equal(snapshot.monitorPersistence.table, 'valorae_monitor_events');

  const migration = fs.readFileSync(new URL('../supabase/005_valorae_monitor_events_persistence.sql', import.meta.url), 'utf8');
  assert.match(migration, /create table if not exists public\.valorae_monitor_events/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /grant select, insert, update, delete .* service_role/i);

  const status = monitorPersistenceStatus();
  assert.equal(status.metrics.written, 1);
  assert.equal(status.metrics.reads, 1);

  console.log('proxy monitor Supabase persistence v350 ok');
} finally {
  restore();
}
