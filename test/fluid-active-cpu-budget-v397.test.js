import assert from 'node:assert/strict';
import fs from 'node:fs';

const monitor = fs.readFileSync(new URL('../public/monitor-valorae.js', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../routes/server/metrics.js', import.meta.url), 'utf8');
const metrics = fs.readFileSync(new URL('../lib/observability/server-metrics.js', import.meta.url), 'utf8');
const quotes = fs.readFileSync(new URL('../lib/sources/quotes.js', import.meta.url), 'utf8');

assert.doesNotMatch(monitor, /STORAGE\.poll|pollMs|function schedule\(|setInterval\(|visibilitychange'.*refresh\(\)|online'.*refresh\(\)/s);
assert.match(monitor, /fetch\(apiUrl\('\/api\/server\/metrics\?fresh=1'\), \{ cache: 'no-store'/);
assert.equal((monitor.match(/on\('refreshButton','click',refresh\)/g) || []).length, 1, 'somente o botão Atualizar chama métricas');
assert.doesNotMatch(monitor, /function init\(\).*refresh\(\);/s);
assert.match(monitor, /Sob demanda · clique em Atualizar/);
assert.match(route, /METRICS_CAPTURE_TTL_MS/);
assert.match(route, /cachedCaptureIsFresh/);
assert.match(route, /capturePromise/);
assert.match(route, /s-maxage=60/);
assert.doesNotMatch(route, /loadPersistedMonitorEvents/);
assert.match(metrics, /realtimeTransport: 'manual-http-request'/);
assert.match(metrics, /pollingHintMs:\s*null/);
assert.match(metrics, /const DETAILED_METRICS = process\.env\.VALORAE_METRICS_DETAILED === '1'/);
assert.doesNotMatch(metrics, /scheduleMonitorPersistenceLazy/);
assert.match(quotes, /legacyPortfolioQuoteMode = requestMode === 'portfolio_quotes_with_valuation'/);
assert.match(quotes, /const includeFundamentals = legacyPortfolioQuoteMode \? false/);
assert.match(quotes, /const bypassCache = legacyPortfolioQuoteMode\s*\? false/);
assert.match(quotes, /recommendedClientPollMs: portfolioQuoteMode \? 120_000 : 30_000/);

console.log('fluid-active-cpu-budget-v397 ok');
