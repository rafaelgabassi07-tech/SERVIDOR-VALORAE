import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const vercel = JSON.parse(read('vercel.json'));
const monitor = read('public/monitor-valorae.js');
const serviceWorker = read('public/service-worker.js');
const persistence = read('lib/observability/monitor-persistence.js');
const metrics = read('lib/observability/server-metrics.js');
const sync = read('routes/sync.js');
const router = read('routes/_router.js');
const sharedState = read('lib/state/shared-runtime-state.js');
const sharedStateRemote = read('lib/state/shared-state-supabase.js');
const circuitBreaker = read('lib/resilience/circuit-breaker.js');
const failureCache = read('lib/resilience/failure-cache.js');
const continuityStore = read('lib/contract/continuity-store.js');

assert.equal(vercel.crons, undefined, 'Vercel não deve possuir cron');
assert.doesNotMatch(monitor, /setInterval\s*\(/, 'monitor não pode fazer polling');
assert.doesNotMatch(monitor, /visibilitychange[^\n]*refresh|addEventListener\(['"]online['"][^\n]*refresh/s, 'retorno à aba/rede não pode consultar métricas');
assert.match(monitor, /on\('refreshButton','click',refresh\)/, 'métricas devem depender de clique explícito');
assert.doesNotMatch(monitor, /renderSettings\(\);loadBenchmark\(\)/, 'benchmark não deve carregar na abertura');
assert.match(monitor, /state\.view==='benchmark'[^\n]*loadBenchmark\(\)/, 'benchmark deve ser lazy');
assert.match(serviceWorker, /caches\.match\('\/server\.html'\)/, 'navegação estática deve ser cache-first');

assert.match(persistence, /const enabled = false/);
assert.doesNotMatch(persistence, /globalThis\.fetch|fetch\s*\(|setTimeout\s*\(|setInterval\s*\(|\/rest\/v1\//, 'compatibilidade do monitor não pode iniciar rede/timer/SQL');
assert.match(metrics, /pollingHintMs: null/);
assert.match(metrics, /só é executado por chamada manual/);
assert.match(metrics, /const DETAILED_METRICS = process\.env\.VALORAE_METRICS_DETAILED === '1'/);

assert.match(sync, /const TRANSACTIONS_TABLE = 'valorae_financial_transactions'/);
assert.match(sync, /const DIVIDENDS_TABLE = 'valorae_financial_dividends'/);
assert.doesNotMatch(sync, /\/rest\/v1\/(?:valorae_user_snapshots|valorae_sync_backups|valorae_monitor_events|valorae_runtime_shared_state|valorae_sync_clients)/);
assert.match(sync, /snapshotsEnabled: false/);
assert.match(sync, /backupsEnabled: false/);
assert.match(sync, /legacyWriteBlocks/);

assert.doesNotMatch(sharedState, /\/rest\/v1\/|sharedStateRemoteRequest|globalThis\.fetch|fetch\s*\(/, 'estado operacional deve permanecer exclusivamente em memória');
assert.doesNotMatch(sharedStateRemote, /\/rest\/v1\/|globalThis\.fetch|fetch\s*\(|setTimeout\s*\(/, 'driver legado remoto precisa ser inerte');
assert.match(sharedState, /remote: 'desativado'/);
assert.doesNotMatch(circuitBreaker, /setTimeout\s*\(|setSharedState\s*\(/, 'circuit breaker não deve agendar persistência redundante');
assert.doesNotMatch(failureCache, /setSharedState\s*\(|getSharedState\s*\(/, 'cache negativo deve usar um único mapa local');
assert.doesNotMatch(continuityStore, /setSharedState\s*\(|getSharedState\s*\(/, 'continuidade deve usar um único mapa local');

assert.match(router, /async function buildMobileAlerts/);
assert.match(router, /Promise\.allSettled/);
assert.match(router, /includeNews/);
assert.match(router, /loadFeatureModule/);
assert.match(router, /VALORAE_METRICS_ENABLED/);
assert.doesNotMatch(router, /import \{ attachProxyMetricsInterceptor \} from/);
assert.match(router, /loadFeatureModule\('source-quotes', \(\) => import\('\.\.\/lib\/sources\/quotes\.js'\)\)/);

console.log('on-demand runtime v398 OK');
