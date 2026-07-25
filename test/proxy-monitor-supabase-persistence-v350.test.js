import assert from 'node:assert/strict';
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

const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VALORAE_MONITOR_PERSISTENCE_ENABLED'];
const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
const oldFetch = globalThis.fetch;
let fetchCalls = 0;

try {
  process.env.SUPABASE_URL = 'https://example.supabase.co/rest/v1';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.VALORAE_MONITOR_PERSISTENCE_ENABLED = '1';
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('monitor não deveria acessar Supabase'); };

  resetMonitorPersistenceForTests();
  resetServerMetricsForTests();
  const initial = monitorPersistenceStatus();
  assert.equal(initial.configured, true);
  assert.equal(initial.requested, true, 'variável legada deve ser observável');
  assert.equal(initial.enabled, false, 'persistência está rigidamente desativada');
  assert.equal(initial.active, false);
  assert.equal(initial.mode, 'memory');

  const backgroundTasks = [];
  const req = {
    method: 'GET',
    url: '/api/v1/asset/quote?ticker=PETR4',
    waitUntil(task) { backgroundTasks.push(task); },
    headers: { 'x-request-id': 'monitor-memory-only' },
  };
  const res = {
    statusCode: 200,
    writableEnded: false,
    setHeader() {},
    getHeader() { return 'application/json'; },
    write() { return true; },
    end() { this.writableEnded = true; return this; },
  };
  attachProxyMetricsInterceptor(req, res);
  res.end(JSON.stringify({ status: 'OK', ticker: 'PETR4' }));
  await flushMonitorPersistenceForTests();
  const history = await loadPersistedMonitorEvents({ force: true });

  assert.equal(res.writableEnded, true);
  assert.equal(backgroundTasks.length, 0, 'não deve agendar escrita remota');
  assert.equal(fetchCalls, 0, 'não deve ler nem gravar monitor no Supabase');
  assert.equal(history.total, 0);
  assert.equal(history.events.length, 0);

  const snapshot = getServerMetricsSnapshot({
    persistedEvents: history.events,
    persistedTotal: history.total,
    persistence: history.status,
  });
  assert.equal(snapshot.serverless.persistent, false);
  assert.equal(snapshot.monitorPersistence.active, false);
  assert.equal(snapshot.monitorPersistence.mode, 'memory');

  console.log('proxy monitor memory-only persistence guard ok');
} finally {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  globalThis.fetch = oldFetch;
  resetMonitorPersistenceForTests();
  resetServerMetricsForTests();
}
