import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { performanceCapabilities } from '../lib/performance/profile.js';
import { cacheDriverInfo } from '../lib/cache/memory.js';
import { sharedStateDriverInfo } from '../lib/state/shared-runtime-state.js';
import { sendJson } from '../lib/performance/http.js';
import { beginRoute } from '../lib/http/route.js';
import { routeManifest } from './_router.js';
import { VIEW_ALIASES, PROFILE_ALIASES, TTL_MATRIX, SOURCE_PROVIDERS, RECOMMENDED_IMPROVEMENTS_STATUS } from '../lib/catalogs/valorae-catalogs.js';

export default async function handler(req, res) {
  const route = beginRoute(req, res, { version: ValoraeEngine.version, methods: ['GET'], route: 'manifest', rateMax: Number(process.env.VALORAE_RATE_LIMIT_HEALTH_MAX || 180), profile: 'manifest', cacheControl: 'private, max-age=60' });
  if (route.done) return;
  const manifest = routeManifest();
  return sendJson(req, res, {
    version: ValoraeEngine.version,
    release: '21.12.0',
    codename: 'Launch Contract Hardening',
    requestId: route.requestId,
    name: 'Valorae Proxy',
    goal: 'Proxy HTTP/JSON serverless para GitHub/Vercel gratuito.',
    freeOnly: true,
    physicalFunctions: manifest.physicalFunctions,
    routes: manifest.routes,
    legacyAliases: manifest.legacyAliases,
    capabilities: {
      apiVersions: ['v1','v2'],
      envelopeV2: true,
      payloadControl: ['fields','dataFields','lean','maxItems','view=app'],
      views: Object.keys(VIEW_ALIASES),
      viewAliases: VIEW_ALIASES,
      profiles: Object.keys(performanceCapabilities().profiles || {}),
      profileAliases: PROFILE_ALIASES,
      launchEndpoints: ['/api/v1/asset?view=app','/api/v1/asset/coverage','/api/v1/asset/fundamentals','/api/v1/integration/sdk','/api/v1/integration/prompts'],
      optionalAuth: ['VALORAE_CLIENT_KEYS','VALORAE_REQUIRE_CLIENT_AUTH','x-valorae-app-id','x-valorae-client-key','x-valorae-signature'],
      portfolio: ['summary','allocation','risk','income','rebalance','history','events','transactions','intelligence','narrative','positionRanking'],
      sharedState: sharedStateDriverInfo(),
      reliability: ['sharedRuntimeState','crossInstanceContractContinuity','sharedProviderHealth','sharedFailureBackoff','atomicLeases','finalDecomposition','stableFacades','sourceDrift','parserResilience','schemaStability','cacheStats','ready','manifest','sourceStatus','qualityMatrix','schemaCatalog'],
      scraperCompat: ['multi-selector','batch-dedup','selector-coverage','compat/scraper4','selector-fallbacks','source-drift-fixtures'],
      ttlMatrix: TTL_MATRIX,
      sourceProviders: SOURCE_PROVIDERS,
      recommendedImprovements: RECOMMENDED_IMPROVEMENTS_STATUS,
    },
    cache: cacheDriverInfo(),
    releaseChecks: {
      noRequiredDependencies: true,
      noRequiredExternalStorage: true,
      optionalSupabaseSharedState: true,
      noPaidCron: true,
      noWebSocket: true,
      noPermanentWorker: true,
    },
  }, { status: 200, engineVersion: ValoraeEngine.version, profile: 'manifest', cachePolicy: 'etag', cacheControl: 'private, max-age=60' });
}
