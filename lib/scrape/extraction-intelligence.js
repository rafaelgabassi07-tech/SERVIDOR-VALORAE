import { buildDynamicRenderManifest } from './dynamic-render-fallback.js';
import { buildHybridDocumentManifest } from './document-context.js';
import { buildStructuredDataManifest } from './structured-data-discovery.js';
import { VALORAE_EXTRACTION_INTELLIGENCE_VERSION } from '../core/feature-versions.js';
import { buildProviderTransportManifest } from '../http/provider-transport.js';

export { VALORAE_EXTRACTION_INTELLIGENCE_VERSION } from '../core/feature-versions.js';
export const VALORAE_EXTRACTION_INTELLIGENCE_POLICY = 'safe-sanitized-json-sandboxed-browser-bounded-transport-v4';
export const VALORAE_EXTRACTION_INTELLIGENCE_IMPLEMENTATION = 'adaptive-dom-rsc-sanitized-json-sandboxed-playwright-bounded-transport-v4';

export function buildExtractionIntelligenceManifest() {
  const hybrid = buildHybridDocumentManifest();
  const structured = buildStructuredDataManifest();
  const dynamic = buildDynamicRenderManifest();
  const transport = buildProviderTransportManifest();
  return {
    status: 'OK',
    endpoint: 'contract/extraction-intelligence',
    version: VALORAE_EXTRACTION_INTELLIGENCE_VERSION,
    policyVersion: VALORAE_EXTRACTION_INTELLIGENCE_POLICY,
    implementation: VALORAE_EXTRACTION_INTELLIGENCE_IMPLEMENTATION,
    compatibility: 'additive-backward-compatible-hidden-from-financial-ui',
    contractImpact: 'none-existing-mobile-fields-and-financial-baselines-preserved',
    architecture: {
      primary: 'bounded-http-html-and-json',
      html: hybrid.implementation,
      staticState: structured.implementation,
      dynamicFallback: dynamic.implementation,
      httpTransport: transport.implementation,
      browserPolicy: 'optional-only-when-static-coverage-is-insufficient',
    },
    extractionOrder: [
      'direct-provider-json',
      'bounded-http-html',
      'adaptive-htmlparser2-parse5-dom',
      'json-ld-and-framework-hydration-state',
      'nextjs-app-router-react-flight-json-records',
      'known-internal-api-discovery',
      'optional-playwright-render',
      'bounded-known-host-json-response-capture',
      'sensitive-and-prototype-safe-json-sanitization',
      'per-request-browser-dns-preflight-and-sandbox',
      'allowlisted-native-scrape-manual-redirect-dns-validation',
      'bounded-lru-http-provider-pools',
      'missing-field-gap-fill-with-static-values-preserved',
    ],
    capabilities: {
      jsonLd: true,
      nextData: true,
      nuxtAndFrameworkState: true,
      hydrationAttributes: true,
      nextAppRouterFlightJson: true,
      inlineStaticAssignments: true,
      chartConfigurations: true,
      internalEndpointDiscovery: true,
      xhrAndFetchJsonCapture: true,
      isolatedBrowserContexts: true,
      browserReuseWithoutSessionReuse: true,
      sharedLazyDom: true,
      selectorQueryDeduplication: true,
      capturedJsonSanitization: true,
      collectorBackpressureAndSettleTimeout: true,
      boundedHttpProviderPools: true,
    },
    safety: {
      noEvalOrVmExecutionForStaticJavascript: true,
      reactFlightJavaScriptNeverExecuted: true,
      pageJavascriptOnlyInsideIsolatedOptionalBrowser: true,
      httpsAndHostAllowlist: true,
      privateNetworkBlocked: true,
      privateDiscoveredEndpointsRejected: true,
      dnsResolutionPreflight: true,
      actualBrowserServerAddressVerifiedWhenAvailable: true,
      actualBrowserServerAddressRequiredByDefault: Boolean(dynamic.safety?.actualServerAddressRequiredByDefault),
      everyAllowedBrowserRequestDnsPreflight: Boolean(dynamic.safety?.everyAllowedBrowserRequestDnsPreflight),
      localBrowserSandboxEnabledByDefault: Boolean(dynamic.safety?.localBrowserSandboxEnabledByDefault),
      downloadsPopupsAndWebSocketsBlocked: Boolean(dynamic.safety?.downloadsPopupsAndWebSocketsBlocked),
      serviceWorkersBlockedForDeterministicNetworkVisibility: true,
      requestHeadersBodiesCookiesAndQueryStringsNotPersisted: true,
      sensitiveEndpointsRejected: true,
      responseBodiesBoundedPerDocumentAndPerRun: true,
      capturedJsonSensitiveFieldsRemoved: true,
      capturedJsonPrototypeKeysRemoved: true,
      capturedJsonComplexityBounded: true,
      collectorBackpressureAndSettleTimeout: true,
      dynamicCacheKeysHashed: true,
      globallyBoundedHttpPools: Boolean(transport.guarantees?.globallyBoundedPoolCountWithLruEviction),
      nativeScrapeRedirectsDnsValidated: true,
      directProviderRedirectsDnsValidated: true,
      capturedJsonUsedOnlyForKnownEndpointGapFill: true,
      existingStaticValuesNeverOverwrittenByBrowserCandidates: true,
      browserNeverMandatoryForFinancialContract: true,
    },
    compatibilityContract: {
      mobileProtocolUnchanged: true,
      assetModalDeliverySchemaUnchanged: true,
      olderProxyWithoutThisManifestAcceptedByApk: true,
      olderApkIgnoringThisManifestSupported: true,
      responseFieldsAdditiveOnly: true,
    },
    manifests: {
      hybridDocument: hybrid.version,
      structuredData: structured.version,
      dynamicRender: dynamic.version,
      httpTransport: transport.version,
    },
    rollback: {
      disableBrowser: 'VALORAE_DYNAMIC_RENDER_ENABLED=0',
      disableNetworkCapture: 'VALORAE_DYNAMIC_NETWORK_CAPTURE_ENABLED=0',
      staticStructuredShadowOnly: 'VALORAE_STRUCTURED_DATA_MODE=shadow',
      forceStandardsParser: 'VALORAE_HTML_DOCUMENT_PARSER=parse5',
    },
  };
}
