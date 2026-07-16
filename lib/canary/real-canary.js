import {
  acquireSharedLease,
  getSharedState,
  releaseSharedLease,
  setSharedState,
  sharedStateDriverInfo,
} from '../state/shared-runtime-state.js';

import {
  additiveCandidate,
  boolEnv,
  bucketFor,
  circuitCooldownMs,
  circuitFailureThreshold,
  endpointAllowlist,
  identityHash,
  leaseTtlMs,
  maxConcurrent,
  maxRunsPerMinute,
  maxValueBytes,
  normalizeToken,
  pipelineAllowlist,
  realCanaryMode,
  sampleBasisPoints,
  validateValue,
} from './real-canary-policy.js';

export const VALORAE_REAL_CANARY_VERSION = '2026.07.15-checkpoint115-v1';
export const VALORAE_REAL_CANARY_POLICY = 'deterministic-real-traffic-additive-promotion-v1';
export const VALORAE_REAL_CANARY_IMPLEMENTATION = 'stable-cohort-shared-lease-circuit-breaker-v1';

const state = globalThis.__VALORAE_REAL_CANARY_STATE__ || {
  active: 0,
  windowStartedAt: Date.now(),
  windowRuns: 0,
  metrics: {
    considered: 0,
    eligible: 0,
    selected: 0,
    sampledOut: 0,
    endpointRejected: 0,
    budgetRejected: 0,
    leaseRejected: 0,
    circuitRejected: 0,
    runs: 0,
    shadowRuns: 0,
    promotions: 0,
    noGain: 0,
    blockedUnsafe: 0,
    failures: 0,
    sharedWrites: 0,
    sharedWriteFailures: 0,
    totalElapsedMs: 0,
    maxElapsedMs: 0,
    lastElapsedMs: 0,
    lastStatus: 'NEVER',
    lastReason: '',
    lastRunAt: '',
  },
  byEndpoint: new Map(),
};
globalThis.__VALORAE_REAL_CANARY_STATE__ = state;

export { realCanaryMode } from './real-canary-policy.js';

function endpointMetric(endpoint) {
  const id = normalizeToken(endpoint);
  if (!state.byEndpoint.has(id)) {
    state.byEndpoint.set(id, {
      considered: 0,
      selected: 0,
      runs: 0,
      promotions: 0,
      blocked: 0,
      failures: 0,
      lastStatus: 'NEVER',
      lastRunAt: '',
    });
  }
  return state.byEndpoint.get(id);
}

function resetBudgetWindow() {
  if (Date.now() - state.windowStartedAt >= 60_000) {
    state.windowStartedAt = Date.now();
    state.windowRuns = 0;
  }
}

function budgetAvailable() {
  resetBudgetWindow();
  return state.active < maxConcurrent() && state.windowRuns < maxRunsPerMinute();
}

function record(endpoint, status, reason = '', elapsedMs = 0) {
  const metric = state.metrics;
  const row = endpointMetric(endpoint);
  metric.lastStatus = status;
  metric.lastReason = String(reason || '').slice(0, 180);
  metric.lastRunAt = new Date().toISOString();
  metric.lastElapsedMs = Math.round(elapsedMs * 100) / 100;
  metric.totalElapsedMs += elapsedMs;
  metric.maxElapsedMs = Math.max(metric.maxElapsedMs, metric.lastElapsedMs);
  row.lastStatus = status;
  row.lastRunAt = metric.lastRunAt;
  if (status === 'PROMOTED') { metric.promotions += 1; row.promotions += 1; }
  if (status === 'BLOCKED') { metric.blockedUnsafe += 1; row.blocked += 1; }
  if (status === 'ERROR') { metric.failures += 1; row.failures += 1; }
  if (status === 'NO_GAIN') metric.noGain += 1;
  if (status === 'SHADOW') metric.shadowRuns += 1;
}

function selection(endpoint, identity, forceSelected = false) {
  state.metrics.considered += 1;
  const row = endpointMetric(endpoint);
  row.considered += 1;
  const normalizedEndpoint = normalizeToken(endpoint);
  const mode = realCanaryMode();
  if (mode === 'disabled') return { eligible: false, selected: false, reason: 'disabled', mode, endpoint: normalizedEndpoint };
  if (!endpointAllowlist().has(normalizedEndpoint)) {
    state.metrics.endpointRejected += 1;
    return { eligible: false, selected: false, reason: 'endpoint-not-allowed', mode, endpoint: normalizedEndpoint };
  }
  state.metrics.eligible += 1;
  const hash = identityHash(normalizedEndpoint, identity);
  const bucket = bucketFor(hash);
  const selected = forceSelected || bucket < sampleBasisPoints();
  if (!selected) {
    state.metrics.sampledOut += 1;
    return { eligible: true, selected: false, reason: 'sampled-out', mode, endpoint: normalizedEndpoint, bucket, identityHash: hash };
  }
  state.metrics.selected += 1;
  row.selected += 1;
  return { eligible: true, selected: true, reason: 'selected', mode, endpoint: normalizedEndpoint, bucket, identityHash: hash };
}

async function readCircuit(endpoint) {
  const record = await getSharedState('real-canary-circuit', normalizeToken(endpoint), { allowStale: false });
  const value = record?.value && typeof record.value === 'object' ? record.value : {};
  const openUntil = Number(value.openUntil || 0);
  return {
    consecutiveFailures: Number(value.consecutiveFailures || 0),
    openUntil,
    open: openUntil > Date.now(),
    lastReason: String(value.lastReason || ''),
  };
}

async function updateCircuit(endpoint, { success, reason = '' } = {}) {
  const current = await readCircuit(endpoint);
  const consecutiveFailures = success ? 0 : current.consecutiveFailures + 1;
  const openUntil = !success && consecutiveFailures >= circuitFailureThreshold()
    ? Date.now() + circuitCooldownMs()
    : 0;
  await setSharedState('real-canary-circuit', normalizeToken(endpoint), {
    consecutiveFailures,
    openUntil,
    lastReason: String(reason || '').slice(0, 180),
    updatedAt: new Date().toISOString(),
  }, { ttlMs: Math.max(circuitCooldownMs() * 2, 15 * 60_000) });
  return { consecutiveFailures, openUntil };
}

async function writeOutcome(endpoint, decision, result) {
  try {
    const key = `${normalizeToken(endpoint)}-${decision.identityHash.slice(0, 24)}`;
    await setSharedState('real-canary-outcome', key, {
      endpoint: normalizeToken(endpoint),
      identityHash: decision.identityHash,
      bucket: decision.bucket,
      mode: decision.mode,
      status: result.status,
      gainedKeys: result.gainedKeys?.slice(0, 40) || [],
      provenance: result.provenance || {},
      reason: result.reason || '',
      at: new Date().toISOString(),
    }, { ttlMs: 24 * 60 * 60_000 });
    state.metrics.sharedWrites += 1;
  } catch {
    state.metrics.sharedWriteFailures += 1;
  }
}

export async function runRealCanary({ endpoint = 'scrape', identity = '', baselineResults = {}, candidates = [], allowedKeys = [], forceSelected = false } = {}) {
  const decision = selection(endpoint, identity, forceSelected);
  const baseDiagnostics = {
    version: VALORAE_REAL_CANARY_VERSION,
    policyVersion: VALORAE_REAL_CANARY_POLICY,
    implementation: VALORAE_REAL_CANARY_IMPLEMENTATION,
    mode: decision.mode,
    endpoint: decision.endpoint,
    eligible: decision.eligible,
    selected: decision.selected,
    promoted: false,
    reason: decision.reason,
    hiddenFromUi: true,
    outputPolicy: 'add-missing-only-never-overwrite-legacy',
  };
  if (!decision.selected) return { results: baselineResults, diagnostics: baseDiagnostics };
  if (!budgetAvailable()) {
    state.metrics.budgetRejected += 1;
    return { results: baselineResults, diagnostics: { ...baseDiagnostics, reason: 'budget-exhausted' } };
  }

  const circuit = await readCircuit(decision.endpoint);
  if (circuit.open) {
    state.metrics.circuitRejected += 1;
    return { results: baselineResults, diagnostics: { ...baseDiagnostics, reason: 'circuit-open', circuitOpenUntil: new Date(circuit.openUntil).toISOString() } };
  }

  const owner = `canary-${sharedStateDriverInfo().instanceId}`.slice(0, 128);
  const lease = await acquireSharedLease('real-canary', `${decision.endpoint}-${decision.identityHash.slice(0, 32)}`, {
    owner,
    ttlMs: leaseTtlMs(),
    requireShared: boolEnv('VALORAE_REAL_CANARY_REQUIRE_SHARED_LEASE', false),
  });
  if (!lease.acquired) {
    state.metrics.leaseRejected += 1;
    return { results: baselineResults, diagnostics: { ...baseDiagnostics, reason: 'lease-not-acquired', leaseShared: lease.shared === true } };
  }

  const started = performance.now();
  state.active += 1;
  state.windowRuns += 1;
  state.metrics.runs += 1;
  endpointMetric(decision.endpoint).runs += 1;
  try {
    const candidate = additiveCandidate(baselineResults, candidates, allowedKeys);
    if (!candidate.ok) {
      const elapsedMs = performance.now() - started;
      record(decision.endpoint, 'BLOCKED', candidate.reason, elapsedMs);
      await updateCircuit(decision.endpoint, { success: false, reason: candidate.reason });
      const outcome = {
        status: 'BLOCKED',
        gainedKeys: [],
        provenance: {},
        reason: candidate.reason,
      };
      await writeOutcome(decision.endpoint, decision, outcome);
      return {
        results: baselineResults,
        diagnostics: {
          ...baseDiagnostics,
          ran: true,
          reason: candidate.reason,
          rejected: candidate.rejected.slice(0, 12),
          elapsedMs: Math.round(elapsedMs * 100) / 100,
        },
      };
    }

    const gainedKeys = candidate.gainedKeys;
    const promoted = decision.mode === 'safe-promote' && gainedKeys.length > 0;
    const status = promoted ? 'PROMOTED' : gainedKeys.length ? 'SHADOW' : 'NO_GAIN';
    const reason = promoted ? 'safe-additive-promotion' : gainedKeys.length ? 'shadow-only' : 'no-missing-key-gained';
    const elapsedMs = performance.now() - started;
    record(decision.endpoint, status, reason, elapsedMs);
    await updateCircuit(decision.endpoint, { success: true });
    const outcome = { status, gainedKeys, provenance: candidate.provenance, reason };
    await writeOutcome(decision.endpoint, decision, outcome);
    return {
      results: promoted ? candidate.results : baselineResults,
      diagnostics: {
        ...baseDiagnostics,
        ran: true,
        promoted,
        reason,
        bucket: decision.bucket,
        sampleBasisPoints: sampleBasisPoints(),
        gainedKeys: gainedKeys.slice(0, 40),
        gainedKeyCount: gainedKeys.length,
        provenance: candidate.provenance,
        rejected: candidate.rejected.slice(0, 12),
        leaseShared: lease.shared === true,
        elapsedMs: Math.round(elapsedMs * 100) / 100,
      },
    };
  } catch (error) {
    const elapsedMs = performance.now() - started;
    const reason = String(error?.code || error?.message || error || 'real-canary-error').slice(0, 180);
    record(decision.endpoint, 'ERROR', reason, elapsedMs);
    await updateCircuit(decision.endpoint, { success: false, reason });
    await writeOutcome(decision.endpoint, decision, { status: 'ERROR', reason, gainedKeys: [], provenance: {} });
    return {
      results: baselineResults,
      diagnostics: { ...baseDiagnostics, ran: true, reason, elapsedMs: Math.round(elapsedMs * 100) / 100 },
    };
  } finally {
    state.active = Math.max(0, state.active - 1);
    await releaseSharedLease('real-canary', `${decision.endpoint}-${decision.identityHash.slice(0, 32)}`, { owner }).catch(() => {});
  }
}

export function realCanaryStats() {
  resetBudgetWindow();
  return {
    ...state.metrics,
    averageElapsedMs: state.metrics.runs ? Math.round((state.metrics.totalElapsedMs / state.metrics.runs) * 100) / 100 : 0,
    active: state.active,
    windowRuns: state.windowRuns,
    byEndpoint: Object.fromEntries([...state.byEndpoint.entries()].map(([key, value]) => [key, { ...value }])),
  };
}

export function buildRealCanaryManifest() {
  const info = sharedStateDriverInfo();
  return {
    status: 'OK',
    endpoint: 'contract/real-canaries',
    version: VALORAE_REAL_CANARY_VERSION,
    policyVersion: VALORAE_REAL_CANARY_POLICY,
    implementation: VALORAE_REAL_CANARY_IMPLEMENTATION,
    enabled: realCanaryMode() !== 'disabled',
    mode: realCanaryMode(),
    hiddenFromUi: true,
    contractImpact: 'additive-only-selected-traffic-never-overwrites-legacy',
    cohort: {
      deterministic: true,
      sampleBasisPoints: sampleBasisPoints(),
      samplePercent: sampleBasisPoints() / 100,
      endpoints: [...endpointAllowlist()].sort(),
      pipelines: [...pipelineAllowlist()].sort(),
      identityStoredAsSha256Only: true,
    },
    coordination: {
      sharedStateDriver: info.driver,
      sharedLeaseAvailable: info.enabled,
      requireSharedLease: boolEnv('VALORAE_REAL_CANARY_REQUIRE_SHARED_LEASE', false),
      leaseTtlMs: leaseTtlMs(),
      duplicateCrossInstanceRunsPreventedWhenSharedDriverActive: true,
    },
    safety: {
      legacyValuesNeverOverwritten: true,
      onlyMissingDeclaredSelectorKeysCanBeAdded: true,
      invalidOrOversizeCandidateBlocked: true,
      prototypePollutionKeysBlocked: true,
      nonFiniteFinancialNumbersBlocked: true,
      circuitBreakerSharedAcrossInstances: true,
      automaticRollbackOnFailure: true,
      cachedFinancialSnapshotsRemainCompatible: true,
      apkUiUnaffected: true,
    },
    limits: {
      maxConcurrent: maxConcurrent(),
      maxRunsPerMinute: maxRunsPerMinute(),
      maxValueBytes: maxValueBytes(),
      circuitFailureThreshold: circuitFailureThreshold(),
      circuitCooldownMs: circuitCooldownMs(),
    },
    rollback: {
      disable: 'VALORAE_REAL_CANARY_ENABLED=0',
      shadowOnly: 'VALORAE_REAL_CANARY_MODE=shadow',
      zeroTraffic: 'VALORAE_REAL_CANARY_SAMPLE_BPS=0',
    },
    metrics: realCanaryStats(),
  };
}

export function resetRealCanaryStateForTests() {
  state.active = 0;
  state.windowStartedAt = Date.now();
  state.windowRuns = 0;
  state.byEndpoint.clear();
  Object.assign(state.metrics, {
    considered: 0, eligible: 0, selected: 0, sampledOut: 0, endpointRejected: 0,
    budgetRejected: 0, leaseRejected: 0, circuitRejected: 0, runs: 0,
    shadowRuns: 0, promotions: 0, noGain: 0, blockedUnsafe: 0, failures: 0,
    sharedWrites: 0, sharedWriteFailures: 0, totalElapsedMs: 0, maxElapsedMs: 0,
    lastElapsedMs: 0, lastStatus: 'NEVER', lastReason: '', lastRunAt: '',
  });
}

export const _test = Object.freeze({
  additiveCandidate,
  bucketFor,
  endpointAllowlist,
  identityHash,
  pipelineAllowlist,
  selection,
  validateValue,
});
