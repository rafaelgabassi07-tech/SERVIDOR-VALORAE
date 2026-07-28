import { attachContractBaseline, assessContractPayload, preservePreviousContractFields } from './baseline.js';
import {
  attachFormalSchemaValidation,
  formalSchemaMode,
  markFormalSchemaBlockedUsingLastGood,
  markFormalSchemaIncompleteWithoutBaseline,
  validateFormalContractPayload,
} from './formal-schema-validation.js';

const MAX_ENTRIES = 64;
const MAX_AGE_MS = 15 * 60 * 1000;
const store = globalThis.__VALORAE_CONTRACT_CONTINUITY_STORE__ || new Map();
globalThis.__VALORAE_CONTRACT_CONTINUITY_STORE__ = store;
const sharedRuntime = globalThis.__VALORAE_CONTRACT_CONTINUITY_SHARED__ || { persisted: 0, hydrated: 0, misses: 0, errors: 0 };
globalThis.__VALORAE_CONTRACT_CONTINUITY_SHARED__ = sharedRuntime;



export async function hydrateContractContinuityEntry(endpoint, identityKey) {
  const key = `${endpoint}::${String(identityKey || 'default').slice(0, 512)}`;
  const current = store.get(key);
  return current && Date.now() - current.storedAt <= MAX_AGE_MS
    ? { hydrated: false, reason: 'local-hit' }
    : { hydrated: false, reason: 'local-miss' };
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
  return stabilizeContractPayload(endpoint, identityKey, payload);
}

export function contractContinuitySharedStats() {
  return { hydrationInFlight: 0, persisted: 0, hydrated: 0, misses: 0, errors: 0, storage: 'memory-local-only' };
}

export function clearContractContinuityStore() {
  store.clear();
}

export function contractContinuityStats() {
  trim();
  return { entries: store.size, maxEntries: MAX_ENTRIES, maxAgeMs: MAX_AGE_MS, shared: contractContinuitySharedStats() };
}

export const _test = { store, trim, MAX_ENTRIES, MAX_AGE_MS };
