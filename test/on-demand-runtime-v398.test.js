import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const vercel = JSON.parse(read('vercel.json'));
const monitor = read('public/index.html');
const serviceWorker = read('public/service-worker.js');
const sync = read('routes/sync.js');
const router = read('routes/_router.js');
const auth = read('lib/security/client-auth.js');
const sharedState = read('lib/state/shared-runtime-state.js');
const sharedStateRemote = read('lib/state/shared-state-supabase.js');
const circuitBreaker = read('lib/resilience/circuit-breaker.js');
const failureCache = read('lib/resilience/failure-cache.js');
const continuityStore = read('lib/contract/continuity-store.js');

assert.equal(vercel.crons, undefined, 'Vercel não deve possuir cron');
assert.doesNotMatch(monitor, /<script\b|setInterval\s*\(|setTimeout\s*\(|fetch\s*\(|\/api\//i);
assert.match(monitor, /Serviço sob demanda/);
assert.doesNotMatch(serviceWorker, /addEventListener\(['"]fetch|fetch\s*\(/);
assert.match(serviceWorker, /registration\.unregister\(\)/);
assert.equal(fs.existsSync(new URL('../lib/observability/monitor-persistence.js',import.meta.url)),false);
assert.equal(fs.existsSync(new URL('../lib/observability/server-metrics.js', import.meta.url)), false);

assert.match(sync, /const TRANSACTIONS_TABLE = 'valorae_financial_transactions'/);
assert.match(sync, /const DIVIDENDS_TABLE = 'valorae_financial_dividends'/);
assert.doesNotMatch(sync, /\/rest\/v1\/(?:valorae_user_snapshots|valorae_sync_backups|valorae_monitor_events|valorae_runtime_shared_state|valorae_sync_clients)/);
assert.match(sync, /snapshotsEnabled: false/);
assert.match(sync, /backupsEnabled: false/);
assert.match(sync, /legacyWriteBlocks/);

assert.doesNotMatch(sharedState, /\/rest\/v1\/|sharedStateRemoteRequest|globalThis\.fetch|fetch\s*\(/);
assert.doesNotMatch(sharedStateRemote, /\/rest\/v1\/|globalThis\.fetch|fetch\s*\(|setTimeout\s*\(/);
assert.doesNotMatch(circuitBreaker, /setTimeout\s*\(|setSharedState\s*\(/);
assert.doesNotMatch(failureCache, /setSharedState\s*\(|getSharedState\s*\(/);
assert.doesNotMatch(continuityStore, /setSharedState\s*\(|getSharedState\s*\(/);

assert.match(router, /async function buildMobileAlerts/);
assert.match(router, /Promise\.allSettled/);
assert.match(router, /includeNews/);
assert.match(router, /loadFeatureModule/);
assert.doesNotMatch(router, /attachProxyMetricsInterceptor|\/server\/metrics|\/monitor\/summary|\/monitor\/self-test/);
assert.match(router, /VALORAE_APK_REQUEST_REQUIRED/);
assert.match(auth, /shouldRequireValoraeApkRequest/);
assert.match(auth, /return process\.env\.VERCEL === '1' \|\| process\.env\.NODE_ENV === 'production'/);

console.log('on-demand runtime v399 OK');
