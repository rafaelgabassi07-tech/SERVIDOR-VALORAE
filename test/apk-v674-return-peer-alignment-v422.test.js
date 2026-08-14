import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VALORAE_MOBILE_PROTOCOL_VERSION, VALORAE_MOBILE_CACHE_POLICY_SECONDS } from '../lib/core/mobile-protocol.js';
import { APK_COMPATIBILITY } from '../lib/core/apk-compatibility.js';
import { VALORAE_RELEASE_PATCH, VALORAE_RELEASE_LABEL } from '../lib/release/current.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'metadata.json'), 'utf8'));
const router = fs.readFileSync(path.join(root, 'routes/_router.js'), 'utf8');

const expectedFingerprint = '69a04c79d4e6792a';
const expectedPatch = '21.12.408-return-peer-performance-v422';
const expectedLabel = 'return-peer-performance-v422';

assert.equal(VALORAE_MOBILE_PROTOCOL_VERSION, '2026.07.10.10');
assert.equal(VALORAE_RELEASE_PATCH, expectedPatch);
assert.equal(VALORAE_RELEASE_LABEL, expectedLabel);
assert.equal(APK_COMPATIBILITY.pairedVersion, '2026.08.11.09');
assert.equal(APK_COMPATIBILITY.pairedSourceFingerprint, expectedFingerprint);
assert.equal(pkg.valorae.apkSourceFingerprint, expectedFingerprint);
assert.equal(pkg.releaseMetadata.apkSourceFingerprint, expectedFingerprint);
assert.equal(metadata.apkSourceFingerprint, expectedFingerprint);

assert.deepEqual(
  {
    ready: VALORAE_MOBILE_CACHE_POLICY_SECONDS.ready,
    quote: VALORAE_MOBILE_CACHE_POLICY_SECONDS.quote,
    quotes: VALORAE_MOBILE_CACHE_POLICY_SECONDS.quotes,
    assetHistory: VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetHistory,
    marketIndices: VALORAE_MOBILE_CACHE_POLICY_SECONDS.marketIndices,
    marketRankings: VALORAE_MOBILE_CACHE_POLICY_SECONDS.marketRankings,
    analysisRankings: VALORAE_MOBILE_CACHE_POLICY_SECONDS.analysisRankings,
    news: VALORAE_MOBILE_CACHE_POLICY_SECONDS.news,
    portfolioHistory: VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioHistory,
    portfolioEquilibrium: VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioEquilibrium,
    portfolioReturns: VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioReturns,
    portfolioDividends: VALORAE_MOBILE_CACHE_POLICY_SECONDS.portfolioDividends,
    assetModalFast: VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFast,
    assetModalFull: VALORAE_MOBILE_CACHE_POLICY_SECONDS.assetModalFull,
  },
  {
    ready: 10,
    quote: 120,
    quotes: 120,
    assetHistory: 60,
    marketIndices: 120,
    marketRankings: 900,
    analysisRankings: 300,
    news: 900,
    portfolioHistory: 300,
    portfolioEquilibrium: 20,
    portfolioReturns: 300,
    portfolioDividends: 900,
    assetModalFast: 35,
    assetModalFull: 180,
  },
);

assert.match(router, /VALORAE_MOBILE_CACHE_POLICY_SECONDS\.analysisRankings/);
assert.match(router, /stale-while-revalidate=900/);

const apkCanonicalRoutes = [
  '/analysis/rankings',
  '/asset/history',
  '/asset/logo',
  '/asset/modal',
  '/asset/quote',
  '/assets',
  '/dividends/batch',
  '/market/indices',
  '/market/rankings',
  '/mobile/alerts',
  '/mobile/daily-close',
  '/news',
  '/portfolio/equilibrium',
  '/portfolio/history',
  '/portfolio/returns',
  '/quotes',
  '/ready',
];
for (const route of apkCanonicalRoutes) {
  assert.ok(router.includes(`'${route}'`) || router.includes(`\"${route}\"`), `rota APK ausente no Proxy: ${route}`);
}

console.log(`apk-v674-return-peer-alignment-v422 ok: ${apkCanonicalRoutes.length} rotas + cache/fingerprint alinhados`);
