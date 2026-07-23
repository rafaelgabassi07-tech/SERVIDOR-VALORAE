import { createRequire } from 'node:module';
import { baselineForEndpoint } from './baseline.js';
import { VALORAE_REQUEST_SCHEMAS, VALORAE_RESPONSE_SCHEMAS, formalSchemaCatalog } from './formal-schemas.js';

import { VALORAE_FORMAL_SCHEMA_VERSION } from '../core/feature-versions.js';
export { VALORAE_FORMAL_SCHEMA_VERSION } from '../core/feature-versions.js';
export const VALORAE_FORMAL_SCHEMA_POLICY = 'json-schema-2020-12-continuity-guard-v1';
export const VALORAE_FORMAL_SCHEMA_IMPLEMENTATION = 'ajv-8.20.0-strict-draft-2020-12-optional-runtime';

const require = createRequire(import.meta.url);
const validatorRuntime = globalThis.__VALORAE_FORMAL_SCHEMA_VALIDATORS__ || {
  ajv: null,
  responseValidators: new Map(),
  requestValidators: new Map(),
  ajvLoads: 0,
  compiledResponse: 0,
  compiledRequest: 0,
  loadAttempted: false,
  unavailableReason: '',
};
globalThis.__VALORAE_FORMAL_SCHEMA_VALIDATORS__ = validatorRuntime;

const responseValidators = validatorRuntime.responseValidators;
const requestValidators = validatorRuntime.requestValidators;

function ajvInstance() {
  if (validatorRuntime.ajv) return validatorRuntime.ajv;
  if (validatorRuntime.loadAttempted && validatorRuntime.unavailableReason) return null;
  validatorRuntime.loadAttempted = true;
  try {
    const imported = require('ajv/dist/2020.js');
    const Ajv2020 = imported?.default || imported;
    validatorRuntime.ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      strictTypes: true,
      allowUnionTypes: false,
      validateFormats: false,
      messages: true,
      verbose: false,
    });
    validatorRuntime.ajvLoads += 1;
    validatorRuntime.unavailableReason = '';
    return validatorRuntime.ajv;
  } catch (error) {
    if (error?.code !== 'MODULE_NOT_FOUND' && error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    validatorRuntime.unavailableReason = String(error?.message || 'Ajv indisponível').slice(0, 240);
    return null;
  }
}

function validatorFor(direction, id) {
  const validators = direction === 'request' ? requestValidators : responseValidators;
  if (validators.has(id)) return validators.get(id);
  const schemas = direction === 'request' ? VALORAE_REQUEST_SCHEMAS : VALORAE_RESPONSE_SCHEMAS;
  const schema = schemas[id];
  if (!schema) return null;
  const ajv = ajvInstance();
  if (!ajv) return null;
  const validator = ajv.compile(schema);
  validators.set(id, validator);
  if (direction === 'request') validatorRuntime.compiledRequest += 1;
  else validatorRuntime.compiledResponse += 1;
  return validator;
}

const state = globalThis.__VALORAE_FORMAL_SCHEMA_STATE__ || {
  validations: 0,
  valid: 0,
  invalid: 0,
  responseValidations: 0,
  requestValidations: 0,
  blockedUsingLastGood: 0,
  incompleteWithoutBaseline: 0,
  byEndpoint: {},
};
globalThis.__VALORAE_FORMAL_SCHEMA_STATE__ = state;

function boolEnv(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).toLowerCase());
}

export function formalSchemaMode() {
  if (!boolEnv(process.env.VALORAE_FORMAL_SCHEMA_VALIDATION_ENABLED, true)) return 'disabled';
  const mode = String(process.env.VALORAE_FORMAL_SCHEMA_MODE || 'guard-last-good').trim().toLowerCase();
  return ['disabled', 'shadow', 'guard-last-good'].includes(mode) ? mode : 'guard-last-good';
}

export function formalRequestSchemaMode() {
  const mode = String(process.env.VALORAE_FORMAL_REQUEST_SCHEMA_MODE || 'shadow').trim().toLowerCase();
  return ['disabled', 'shadow', 'enforce'].includes(mode) ? mode : 'shadow';
}

function endpointId(endpoint = '') {
  return baselineForEndpoint(endpoint).id;
}

function sanitizeErrors(errors = []) {
  return errors.slice(0, 16).map(error => ({
    instancePath: String(error.instancePath || '/').slice(0, 180),
    schemaPath: String(error.schemaPath || '').slice(0, 220),
    keyword: String(error.keyword || '').slice(0, 60),
    message: String(error.message || 'schema validation failed').slice(0, 240),
    params: error.params && typeof error.params === 'object'
      ? Object.fromEntries(Object.entries(error.params).slice(0, 8).map(([key, value]) => [key, String(value).slice(0, 120)]))
      : {},
  }));
}

function record(id, direction, ok) {
  state.validations += 1;
  state[direction === 'request' ? 'requestValidations' : 'responseValidations'] += 1;
  state[ok ? 'valid' : 'invalid'] += 1;
  const row = state.byEndpoint[id] ||= { validations: 0, valid: 0, invalid: 0 };
  row.validations += 1;
  row[ok ? 'valid' : 'invalid'] += 1;
}

function validate(direction, endpoint, payload = {}) {
  const id = endpointId(endpoint);
  const mode = direction === 'request' ? formalRequestSchemaMode() : formalSchemaMode();
  const schemas = direction === 'request' ? VALORAE_REQUEST_SCHEMAS : VALORAE_RESPONSE_SCHEMAS;
  const schema = schemas[id];
  if (mode === 'disabled' || !schema) {
    return {
      version: VALORAE_FORMAL_SCHEMA_VERSION,
      policyVersion: VALORAE_FORMAL_SCHEMA_POLICY,
      implementation: VALORAE_FORMAL_SCHEMA_IMPLEMENTATION,
      direction,
      endpoint: id,
      schemaId: schema?.$id || null,
      mode,
      applicable: Boolean(schema),
      ok: true,
      skipped: true,
      errors: [],
    };
  }
  const validator = validatorFor(direction, id);
  if (!validator) {
    return {
      version: VALORAE_FORMAL_SCHEMA_VERSION,
      policyVersion: VALORAE_FORMAL_SCHEMA_POLICY,
      implementation: VALORAE_FORMAL_SCHEMA_IMPLEMENTATION,
      direction,
      endpoint: id,
      schemaId: schema?.$id || null,
      mode,
      applicable: true,
      ok: true,
      skipped: true,
      reason: 'validator-runtime-unavailable',
      errors: [],
    };
  }
  const ok = validator(payload) === true;
  record(id, direction, ok);
  return {
    version: VALORAE_FORMAL_SCHEMA_VERSION,
    policyVersion: VALORAE_FORMAL_SCHEMA_POLICY,
    implementation: VALORAE_FORMAL_SCHEMA_IMPLEMENTATION,
    direction,
    endpoint: id,
    schemaId: validator.schema?.$id || null,
    mode,
    applicable: true,
    ok,
    skipped: false,
    errorCount: ok ? 0 : (validator.errors?.length || 0),
    errors: ok ? [] : sanitizeErrors(validator.errors || []),
  };
}

export function validateFormalContractPayload(endpoint, payload = {}) {
  return validate('response', endpoint, payload);
}

export function validateFormalRequestPayload(endpoint, payload = {}) {
  return validate('request', endpoint, payload);
}

export function attachFormalSchemaValidation(payload = {}, validation = {}, extras = {}) {
  const out = payload && typeof payload === 'object' && !Array.isArray(payload) ? { ...payload } : { value: payload };
  out.contractSchemaValidation = {
    version: VALORAE_FORMAL_SCHEMA_VERSION,
    policyVersion: VALORAE_FORMAL_SCHEMA_POLICY,
    implementation: VALORAE_FORMAL_SCHEMA_IMPLEMENTATION,
    direction: validation.direction || 'response',
    endpoint: validation.endpoint || 'unknown',
    schemaId: validation.schemaId || null,
    mode: validation.mode || formalSchemaMode(),
    applicable: validation.applicable !== false,
    ok: validation.ok !== false,
    skipped: validation.skipped === true,
    errorCount: Number(validation.errorCount || validation.errors?.length || 0),
    errors: Array.isArray(validation.errors) ? validation.errors.slice(0, 10) : [],
    hiddenFromUi: true,
    canReplacePrevious: validation.ok !== false,
    ...extras,
  };
  return out;
}

export function markFormalSchemaBlockedUsingLastGood() {
  state.blockedUsingLastGood += 1;
}

export function markFormalSchemaIncompleteWithoutBaseline() {
  state.incompleteWithoutBaseline += 1;
}

export function formalSchemaValidationStats() {
  return {
    ...state,
    byEndpoint: Object.fromEntries(Object.entries(state.byEndpoint).map(([key, value]) => [key, { ...value }])),
  };
}

export function buildFormalSchemaManifest({ includeSchemas = false } = {}) {
  return {
    status: 'OK',
    endpoint: 'contract/formal-schemas',
    version: VALORAE_FORMAL_SCHEMA_VERSION,
    policyVersion: VALORAE_FORMAL_SCHEMA_POLICY,
    implementation: VALORAE_FORMAL_SCHEMA_IMPLEMENTATION,
    compatibility: 'additive-hidden-from-ui',
    contractImpact: 'invalid-response-never-replaces-last-good',
    draft: '2020-12',
    strictMode: true,
    modes: {
      response: formalSchemaMode(),
      request: formalRequestSchemaMode(),
    },
    guarantees: {
      additionalPropertiesPreserved: true,
      existingFieldsNotRenamed: true,
      invalidResponseUsesLastGoodWhenAvailable: true,
      invalidFirstResponseIsMarkedUnsafeInsteadOfInvented: true,
      requestValidationShadowByDefault: true,
      financialValuesNotCoerced: true,
      validationDoesNotApplyDefaults: true,
      validationDoesNotRemoveProperties: true,
      validatorRuntimeAvailabilityReported: true,
    },
    catalog: formalSchemaCatalog(),
    schemas: includeSchemas ? { response: VALORAE_RESPONSE_SCHEMAS, request: VALORAE_REQUEST_SCHEMAS } : undefined,
    metrics: {
      ...formalSchemaValidationStats(),
      validatorAvailable: Boolean(ajvInstance()),
      validatorUnavailableReason: validatorRuntime.unavailableReason || '',
    },
    rollback: {
      disable: 'VALORAE_FORMAL_SCHEMA_VALIDATION_ENABLED=0',
      shadowOnly: 'VALORAE_FORMAL_SCHEMA_MODE=shadow',
      requestShadow: 'VALORAE_FORMAL_REQUEST_SCHEMA_MODE=shadow',
    },
  };
}

export const _test = {
  get ajv() { return ajvInstance(); },
  responseValidators,
  requestValidators,
  validatorRuntime,
  validatorFor,
  sanitizeErrors,
  endpointId,
  state,
};
