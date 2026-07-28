import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const serviceWorker = fs.readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');
const router = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
const quotes = fs.readFileSync(new URL('../lib/sources/quotes.js', import.meta.url), 'utf8');

assert.doesNotMatch(html, /<script\b|fetch\s*\(|XMLHttpRequest|EventSource|WebSocket|\/api\//i);
assert.match(html, /Serviço sob demanda/);
assert.match(html, /não consulta Vercel, API, métricas, banco ou fontes financeiras/i);
assert.doesNotMatch(serviceWorker, /addEventListener\(['"]fetch|fetch\s*\(/);
assert.match(serviceWorker, /registration\.unregister\(\)/);
assert.equal(fs.existsSync(new URL('../lib/observability/server-metrics.js', import.meta.url)), false);
assert.doesNotMatch(router, /\/server\/metrics|\/monitor\/summary|\/monitor\/self-test/);
assert.match(router, /VALORAE_APK_REQUEST_REQUIRED/);
assert.match(quotes, /legacyPortfolioQuoteMode = requestMode === 'portfolio_quotes_with_valuation'/);
assert.match(quotes, /const includeFundamentals = legacyPortfolioQuoteMode \? false/);
assert.match(quotes, /const bypassCache = legacyPortfolioQuoteMode\s*\? false/);

console.log('fluid-active-cpu-budget-v399 ok');
