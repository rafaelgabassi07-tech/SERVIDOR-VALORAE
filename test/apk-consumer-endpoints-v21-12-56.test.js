import assert from 'node:assert/strict';
import { routeManifest } from '../routes/_router.js';

const apkEndpoints = [
  '/api/fields', '/api/observability', '/api/openapi', '/api/server/metrics',
  '/api/v1/asset', '/api/v1/asset/action-plan', '/api/v1/asset/coverage', '/api/v1/asset/debt',
  '/api/v1/asset/dividends', '/api/v1/asset/fundamentals', '/api/v1/asset/history', '/api/v1/asset/indicators',
  '/api/v1/asset/next-dividend', '/api/v1/asset/peers', '/api/v1/asset/profile', '/api/v1/asset/profitability',
  '/api/v1/asset/quality', '/api/v1/asset/source-map', '/api/v1/asset/statements', '/api/v1/asset/valuation',
  '/api/v1/assets', '/api/v1/cache/stats', '/api/v1/compare', '/api/v1/deploy/status',
  '/api/v1/engine/maturity', '/api/v1/engine/performance', '/api/v1/fii/checklist', '/api/v1/fii/communications',
  '/api/v1/fii/income', '/api/v1/fii/indicators', '/api/v1/fii/patrimonial', '/api/v1/fii/portfolio',
  '/api/v1/fii/profile', '/api/v1/fii/vacancy', '/api/v1/health', '/api/v1/integration/manifest',
  '/api/v1/market/indices', '/api/v1/market/ipca', '/api/v1/market/rankings', '/api/v1/news',
  '/api/v1/personal/readiness', '/api/v1/portfolio/allocation', '/api/v1/portfolio/analyze', '/api/v1/portfolio/dividends',
  '/api/v1/portfolio/events', '/api/v1/portfolio/history', '/api/v1/portfolio/income', '/api/v1/portfolio/next-dividends',
  '/api/v1/portfolio/rebalance', '/api/v1/portfolio/risk', '/api/v1/portfolio/summary', '/api/v1/portfolio/transactions',
  '/api/v1/ready', '/api/v1/release/readiness', '/api/v1/schema', '/api/v1/source/status', '/api/v1/watchlist/analyze'
];

const normalize = (path) => path.replace(/^\/api\/v1/, '').replace(/^\/api/, '') || '/';
const routes = new Set(routeManifest().routes);
const missing = apkEndpoints.filter((endpoint) => !routes.has(normalize(endpoint)));
assert.deepEqual(missing, [], 'Todas as rotas chamadas pelo APK precisam existir no roteador do Proxy.');
assert.equal(apkEndpoints.length, 57);
console.log('apk-consumer-endpoints-v21-12-56 OK: 57 endpoints do APK cobertos pelo Proxy');
