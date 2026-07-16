export const VALORAE_FINAL_DECOMPOSITION_VERSION = '2026.07.15-checkpoint116-v1';
export const VALORAE_FINAL_DECOMPOSITION_POLICY = 'stable-facades-cohesive-internals-v1';
export const VALORAE_FINAL_DECOMPOSITION_IMPLEMENTATION = 'contract-preserving-module-boundaries-v1';

const MODULES = Object.freeze([
  Object.freeze({
    id: 'http-provider-transport',
    facade: 'lib/http/provider-transport.js',
    internals: Object.freeze(['lib/http/provider-transport-profile.js']),
    responsibilities: Object.freeze(['public fetch facade', 'pool lifecycle', 'backpressure orchestration', 'provider profile resolution']),
    stableExports: Object.freeze(['providerFetch', 'providerNameForUrl', 'resolveProviderTransportProfile', 'providerTransportStats', 'buildProviderTransportManifest', 'resetProviderTransportForTests']),
  }),
  Object.freeze({
    id: 'shared-runtime-state',
    facade: 'lib/state/shared-runtime-state.js',
    internals: Object.freeze(['lib/state/shared-state-foundation.js', 'lib/state/shared-state-supabase.js']),
    responsibilities: Object.freeze(['public state facade', 'bounded memory mirror', 'Supabase driver', 'atomic lease orchestration']),
    stableExports: Object.freeze(['getSharedState', 'setSharedState', 'deleteSharedState', 'acquireSharedLease', 'releaseSharedLease', 'sharedStateDriverInfo', 'sharedStateStats', 'buildSharedStateManifest']),
  }),
  Object.freeze({
    id: 'real-traffic-canary',
    facade: 'lib/canary/real-canary.js',
    internals: Object.freeze(['lib/canary/real-canary-policy.js']),
    responsibilities: Object.freeze(['public canary facade', 'cohort and safety policy', 'shared coordination', 'metrics and outcomes']),
    stableExports: Object.freeze(['runRealCanary', 'realCanaryMode', 'realCanaryStats', 'buildRealCanaryManifest', 'resetRealCanaryStateForTests']),
  }),
]);

export function finalDecompositionModules() {
  return MODULES.map(module => ({
    ...module,
    internals: [...module.internals],
    responsibilities: [...module.responsibilities],
    stableExports: [...module.stableExports],
  }));
}

export function buildFinalDecompositionManifest() {
  const modules = finalDecompositionModules();
  return {
    status: 'OK',
    endpoint: 'contract/final-decomposition',
    version: VALORAE_FINAL_DECOMPOSITION_VERSION,
    policyVersion: VALORAE_FINAL_DECOMPOSITION_POLICY,
    implementation: VALORAE_FINAL_DECOMPOSITION_IMPLEMENTATION,
    hiddenFromUi: true,
    contractImpact: 'none-stable-facades-and-financial-contracts-preserved',
    scope: {
      completed: true,
      moduleCount: modules.length,
      internalModuleCount: modules.reduce((total, module) => total + module.internals.length, 0),
      modules,
    },
    invariants: {
      facadeImportPathsPreserved: true,
      publicExportsPreserved: true,
      financialPayloadShapeUnchanged: true,
      routePathsUnchanged: true,
      cacheKeysAndEtagsUnchanged: true,
      sharedStateStorageSchemaUnchanged: true,
      canarySelectionAndPromotionRulesUnchanged: true,
      httpPoolAndBackpressureBehaviorUnchanged: true,
      apkUiUnaffected: true,
      olderProxyWithoutThisManifestAcceptedByApk: true,
    },
    dependencyRules: {
      internalModulesDoNotImportRoutes: true,
      purePolicyModulesDoNotPerformNetworkIo: true,
      SupabaseDriverSeparatedFromMemoryMirror: true,
      providerProfilesSeparatedFromPoolLifecycle: true,
      canarySafetySeparatedFromSharedCoordination: true,
      circularDependenciesForbidden: true,
    },
    rollback: {
      codeRollback: 'reverter apenas os módulos internos mantendo as fachadas públicas',
      runtimeFlagsPreserved: ['VALORAE_HTTP_TRANSPORT_MODE', 'VALORAE_SHARED_STATE_MODE', 'VALORAE_REAL_CANARY_MODE'],
    },
  };
}
