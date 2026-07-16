import { attachContractBaseline, assessContractPayload, preservePreviousContractFields } from './baseline.js';
import {
  attachFormalSchemaValidation,
  formalSchemaMode,
  markFormalSchemaBlockedUsingLastGood,
  markFormalSchemaIncompleteWithoutBaseline,
  validateFormalContractPayload,
} from './formal-schema-validation.js';
import { getSharedState, setSharedState, sharedStateKeyHash } from '../state/shared-runtime-state.js';

const MAX_ENTRIES = 64;
const MAX_AGE_MS = 15 * 60 * 1000;
const store = globalThis.__VALORAE_CONTRACT_CONTINUITY_STORE__ || new Map();
globalThis.__VALORAE_CONTRACT_CONTINUITY_STORE__ = store;
const sharedRuntime = globalThis.__VALORAE_CONTRACT_CONTINUITY_SHARED__ || { hydration: new Map(), persisted: 0, hydrated: 0, misses: 0, errors: 0 };
globalThis.__VALORAE_CONTRACT_CONTINUITY_SHARED__ = sharedRuntime;

function sharedKey(endpoint, identityKey) {
  return sharedStateKeyHash(`${endpoint}::${String(identityKey || 'default')}`).slice(0, 64);
}

function persistSharedEntry(endpoint, identityKey, entry) {
  void setSharedState('contract-continuity', sharedKey(endpoint, identityKey), {
    endpoint,
    storedAt: entry.storedAt,
    payload: entry.payload,
  }, { ttlMs: MAX_AGE_MS }).then(result => {
    if (result?.stored) sharedRuntime.persisted += 1;
  }).catch(() => { sharedRuntime.errors += 1; });
}

export async function hydrateContractContinuityEntry(endpoint, identityKey) {
  const key = `${endpoint}::${String(identityKey || 'default').slice(0, 512)}`;
  const current = store.get(key);
  if (current && Date.now() - current.storedAt <= MAX_AGE_MS) return { hydrated: false, reason: 'local-hit' };
  const hydrationKey = sharedKey(endpoint, identityKey);
  if (sharedRuntime.hydration.has(hydrationKey)) return sharedRuntime.hydration.get(hydrationKey);
  const promise = (async () => {
    try {
      const record = await getSharedState('contract-continuity', hydrationKey);
      const value = record?.value;
      const storedAt = Number(value?.storedAt || Date.parse(record?.updatedAt || '') || 0);
      if (!value?.payload || !storedAt || Date.now() - storedAt > MAX_AGE_MS) {
        sharedRuntime.misses += 1;
        return { hydrated: false, reason: 'shared-miss' };
      }
      const local = store.get(key);
      if (!local || local.storedAt <= storedAt) store.set(key, { payload: value.payload, storedAt });
      sharedRuntime.hydrated += 1;
      trim();
      return { hydrated: true, reason: 'shared-hit', storedAt };
    } catch {
      sharedRuntime.errors += 1;
      return { hydrated: false, reason: 'shared-error' };
    }
  })().finally(() => sharedRuntime.hydration.delete(hydrationKey));
  sharedRuntime.hydration.set(hydrationKey, promise);
  return promise;
}


function trim(now = Date.now()) {
  for (const [key, entry] of store.entries()) {
    if (now - entry.storedAt > MAX_AGE_MS) store.delete(key);
  }
  if (store.size <= MAX_ENTRIES) return;
  [...store.entries()]
    .sort((a, b) => a[1].storedAt - b[1].storedAt)
    .slice(0, store.size - MAX_ENTRIES)
    .forEach(([key]) => store.delete(key));
}

export function stabilizeContractPayload(endpoint, identityKey, payload = {}) {
  const key = `${endpoint}::${String(identityKey || 'default').slice(0, 512)}`;
  const now = Date.now();
  trim(now);
  const previousEntry = store.get(key);
  const previous = previousEntry?.payload;
  const assessment = assessContractPayload(endpoint, payload);
  let stable = previous ? preservePreviousContractFields(endpoint, previous, payload) : attachContractBaseline(endpoint, payload);
  const schemaValidation = validateFormalContractPayload(endpoint, stable);
  const schemaGuardActive = formalSchemaMode() === 'guard-last-good' && schemaValidation.applicable && !schemaValidation.ok;

  if (schemaGuardActive && previous) {
    markFormalSchemaBlockedUsingLastGood();
    const fallback = typeof structuredClone === 'function' ? structuredClone(previous) : JSON.parse(JSON.stringify(previous));
    fallback.requestId = stable?.requestId || payload?.requestId || fallback.requestId;
    fallback.partial = true;
    fallback.contractBaseline = {
      ...(fallback.contractBaseline || {}),
      status: 'FORMAL_SCHEMA_BLOCKED_USING_LAST_GOOD',
      regressionBlocked: true,
      canReplacePrevious: false,
      warning: 'Resposta incompatível com o schema formal; último payload válido preservado.',
    };
    return attachFormalSchemaValidation(fallback, schemaValidation, {
      status: 'BLOCKED_USING_LAST_GOOD',
      previousPreserved: true,
      canReplacePrevious: false,
    });
  }

  stable = attachFormalSchemaValidation(stable, schemaValidation, {
    status: schemaValidation.ok ? 'VALID' : (schemaValidation.applicable ? 'INVALID_NO_BASELINE' : 'NOT_APPLICABLE'),
    previousPreserved: false,
    canReplacePrevious: schemaValidation.ok,
  });

  const currentHasRegression = stable.contractBaseline?.regressionBlocked === true;
  if (assessment.ok && !currentHasRegression && schemaValidation.ok) {
    const entry = { payload: stable, storedAt: now };
    store.set(key, entry);
    persistSharedEntry(endpoint, identityKey, entry);
  }
  if (!previous && (!assessment.ok || !schemaValidation.ok)) {
    if (!schemaValidation.ok) markFormalSchemaIncompleteWithoutBaseline();
    stable.contractBaseline.canReplacePrevious = false;
    stable.contractBaseline.status = schemaValidation.ok ? 'INCOMPLETE_NO_BASELINE' : 'FORMAL_SCHEMA_INVALID_NO_BASELINE';
    stable.contractSchemaValidation.canReplacePrevious = false;
  }
  return stable;
}


export async function stabilizeContractPayloadShared(endpoint, identityKey, payload = {}) {
  await hydrateContractContinuityEntry(endpoint, identityKey);
  return stabilizeContractPayload(endpoint, identityKey, payload);
}

export function contractContinuitySharedStats() {
  return {
    hydrationInFlight: sharedRuntime.hydration.size,
    persisted: sharedRuntime.persisted,
    hydrated: sharedRuntime.hydrated,
    misses: sharedRuntime.misses,
    errors: sharedRuntime.errors,
  };
}

export function clearContractContinuityStore() {
  store.clear();
}

export function contractContinuityStats() {
  trim();
  return { entries: store.size, maxEntries: MAX_ENTRIES, maxAgeMs: MAX_AGE_MS, shared: contractContinuitySharedStats() };
}

export const _test = { store, trim, MAX_ENTRIES, MAX_AGE_MS };
