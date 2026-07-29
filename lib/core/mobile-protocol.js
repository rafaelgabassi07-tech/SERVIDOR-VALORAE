/**
 * Canonical mobile protocol shared by router, CORS/security and integration manifest.
 * Keep this file dependency-free so every runtime path can import it without cycles.
 */
export const VALORAE_MOBILE_PROTOCOL_VERSION = '2026.07.10.10';
export const VALORAE_ASSET_MODAL_DELIVERY_SCHEMA_VERSION = '4';

export const VALORAE_CANONICAL_REQUEST_HEADERS = Object.freeze([
  'Accept',
  'Content-Type',
  'Authorization',
  'X-Request-Id',
  'X-Valorae-Mobile-Protocol',
  'X-Valorae-Delivery-Schema',
  'X-Valorae-App',
  'X-Valorae-Channel',
  'X-Valorae-App-Version',
  'X-Valorae-Build',
  'X-Valorae-App-Id',
]);

export const VALORAE_LEGACY_REQUEST_HEADERS = Object.freeze([
  'X-Valorae-Client-Id',
  'X-Valorae-Client-Version',
  'X-Valorae-Environment',
]);

export const VALORAE_SYNC_REQUEST_HEADERS = Object.freeze([
  'X-Valorae-User-Id',
  'X-Valorae-Device-Id',
  'X-Valorae-Client-Secret',
  'X-Valorae-Sync-Token',
]);

export const VALORAE_REQUEST_HEADERS = Object.freeze([
  ...VALORAE_CANONICAL_REQUEST_HEADERS,
  ...VALORAE_LEGACY_REQUEST_HEADERS,
  ...VALORAE_SYNC_REQUEST_HEADERS,
]);

export const VALORAE_EXPOSE_HEADERS = Object.freeze([
  'ETag',
  'Retry-After',
  'X-Request-Id',
  'X-Valorae-Mobile-Protocol',
  'X-Valorae-Engine-Version',
  'X-Valorae-Schema-Version',
  'X-Valorae-Contract-Version',
  'X-Valorae-Endpoint-Contract-Version',
  'X-Valorae-Delivery-Schema',
  'X-Valorae-Baseline-Contract',
  'X-Valorae-Trace-Id',
  'X-Valorae-Formal-Schema',
  'X-Valorae-Performance',
  'X-Valorae-Cache',
  'X-Valorae-Cache-Policy',
  'X-Valorae-Source-Status',
  'X-Valorae-Response-Bytes',
  'X-Valorae-Auth-Mode',
  'X-Valorae-App-Id',
  'X-Valorae-Security',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
]);

export const VALORAE_CORS_METHODS = Object.freeze(['GET', 'POST', 'DELETE', 'HEAD', 'OPTIONS']);

/** Freshness contract consumed by the Android APK. Stale fallback is handled separately. */
export const VALORAE_MOBILE_CACHE_POLICY_SECONDS = Object.freeze({
  ready: 10,
  quote: 120,
  quotes: 120,
  assetHistory: 60,
  marketIndices: 120,
  marketRankings: 900,
  news: 900,
  portfolioHistory: 300,
  portfolioEquilibrium: 20,
  portfolioReturns: 300,
  portfolioDividends: 900,
  assetModalFast: 35,
  assetModalFull: 180,
  assetModalFastStaleGrace: 120,
  assetModalFullStaleGrace: 900,
});

export function requestHeadersCsv(extra = []) {
  return [...new Set([...VALORAE_REQUEST_HEADERS, ...extra])].join(', ');
}

export function exposeHeadersCsv(extra = []) {
  return [...new Set([...VALORAE_EXPOSE_HEADERS, ...extra])].join(', ');
}

export function corsMethodsCsv(extra = []) {
  return [...new Set([...VALORAE_CORS_METHODS, ...extra])].join(', ');
}
