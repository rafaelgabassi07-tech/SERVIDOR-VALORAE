import assert from 'node:assert/strict';
import { resolvePerformanceOptions } from '../lib/performance/profile.js';
import { getBaseUrl } from '../lib/http/route.js';

const fast = resolvePerformanceOptions({ profile: 'fast', timeoutMs: 500 }, { endpoint: 'asset', ticker: 'PETR4', type: 'ACAO' });
assert.equal(fast.timeoutMs, 500);
assert.equal(fast.valoraeScrapeTimeoutMs, 500, 'timeoutMs deve limitar ValoraeScrape quando valoraeScrapeTimeoutMs não foi informado');
assert.equal(fast.adaptiveCompletionTimeoutMs, 500, 'timeoutMs deve limitar complemento adaptativo quando adaptiveCompletionTimeoutMs não foi informado');

const turbo = resolvePerformanceOptions({ profile: 'turbo', timeoutMs: 1200 }, { endpoint: 'asset', ticker: 'PETR4', type: 'ACAO' });
assert.equal(turbo.timeoutMs, 1200);
assert.equal(turbo.valoraeScrapeTimeoutMs, 1200);
assert.equal(turbo.adaptiveCompletionTimeoutMs, 1200);

const explicit = resolvePerformanceOptions({ profile: 'turbo', timeoutMs: 1000, adaptiveCompletionTimeoutMs: 3000, valoraeScrapeTimeoutMs: 2500 }, { endpoint: 'asset', ticker: 'PETR4', type: 'ACAO' });
assert.equal(explicit.timeoutMs, 1000);
assert.equal(explicit.valoraeScrapeTimeoutMs, 2500);
assert.equal(explicit.adaptiveCompletionTimeoutMs, 3000);


const lowLatency = resolvePerformanceOptions({ profile: 'turbo', timeoutMs: 500, adaptiveCompletion: false, statusInvestComplement: false, lowLatencyBudget: true }, { endpoint: 'asset', ticker: 'PETR4', type: 'ACAO' });
assert.equal(lowLatency.timeoutMs, 500);
assert.equal(lowLatency.valoraeScrapeTimeoutMs, 500);
assert.equal(lowLatency.adaptiveCompletion, false);
assert.equal(lowLatency.statusInvestComplement, false);

const localBaseUrl = getBaseUrl({ headers: { host: '127.0.0.1:3000' } });
assert.equal(localBaseUrl, 'http://127.0.0.1:3000');
const prodBaseUrl = getBaseUrl({ headers: { host: 'servidor-valorae.vercel.app' } });
assert.equal(prodBaseUrl, 'https://servidor-valorae.vercel.app');

console.log('timeout-performance-guard-v21-12-45 OK');
