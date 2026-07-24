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
  'X-Valorae-Observability-Accept',
  'X-Valorae-Source-Adapters-Accept',
  'X-Valorae-Html-Parser-Shadow-Accept',
  'X-Valorae-Structured-Data-Accept',
  'X-Valorae-Dynamic-Render-Accept',
  'X-Valorae-Extraction-Intelligence-Accept',
  'X-Valorae-Formal-Schema-Accept',
  'X-Valorae-Http-Transport-Accept',
  'X-Valorae-Shared-State-Accept',
  'X-Valorae-Real-Canary-Accept',
  'X-Valorae-Final-Decomposition-Accept',
  'X-Valorae-Scraping-Engine-Accept',
  'X-Valorae-Signature',
  'X-Valorae-Timestamp',
]);

export const VALORAE_LEGACY_REQUEST_HEADERS = Object.freeze([
  'X-Valorae-Client-Id',
  'X-Valorae-Client-Version',
  'X-Valorae-Environment',
]);

export const VALORAE_SYNC_REQUEST_HEADERS = Object.freeze([
  'X-Valorae-Client-Key',
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
  'X-Valorae-Delivery-Schema',
  'X-Valorae-Baseline-Contract',
  'X-Valorae-Field-Observability',
  'X-Valorae-Trace-Id',
  'X-Valorae-Source-Adapters',
  'X-Valorae-Html-Parser-Shadow',
  'X-Valorae-Structured-Data',
  'X-Valorae-Dynamic-Render',
  'X-Valorae-Extraction-Intelligence',
  'X-Valorae-Formal-Schema',
  'X-Valorae-Http-Transport',
  'X-Valorae-Shared-State',
  'X-Valorae-Real-Canary',
  'X-Valorae-Final-Decomposition',
  'X-Valorae-Scraping-Engine',
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
  quote: 30,
  quotes: 30,
  assetHistory: 60,
  marketIndices: 30,
  marketRankings: 60,
  news: 30,
  analysis: 60,
  portfolioHistory: 30,
  portfolioEquilibrium: 20,
  portfolioReturns: 60,
  portfolioDividends: 60,
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
