export const VALORAE_CAPTURED_JSON_SAFETY_POLICY = 'bounded-sensitive-json-sanitization-v1';

const PROTOTYPE_KEYS = new Set(['__proto__', 'proto', 'prototype', 'constructor']);
const SECRET_KEYS = new Set([
  'accesstoken', 'refreshtoken', 'idtoken', 'authtoken', 'authorization',
  'bearertoken', 'cookie', 'setcookie', 'password', 'passwd', 'passphrase',
  'session', 'sessionid', 'sessiontoken', 'csrftoken', 'xsrftoken', 'apikey',
  'secret', 'clientsecret', 'privatekey', 'credential', 'credentials',
]);
const PERSONAL_KEYS = new Set([
  'email', 'useremail', 'accountemail', 'cpf', 'taxid', 'documentnumber',
  'phonenumber', 'telephone', 'telefone', 'cellphone', 'celular',
  'streetaddress', 'postaladdress', 'endereco', 'userid', 'customerid',
]);
const JWT_VALUE = /^(?:bearer\s+)?eyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}$/i;
const AUTH_VALUE = /^(?:bearer|basic)\s+[a-z0-9+/=_\-.]{12,}$/i;
const EMAIL_VALUE = /^[^\s@]{1,128}@[^\s@]{1,253}\.[a-z]{2,63}$/i;
const CPF_VALUE = /^(?:\d{3}[.\s-]?){3}\d{2}$/;

function sensitiveStringKind(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  if (JWT_VALUE.test(text) || AUTH_VALUE.test(text)) return 'secret';
  if (EMAIL_VALUE.test(text) || CPF_VALUE.test(text)) return 'personal';
  return '';
}

function normalizedKey(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function safeLimits(options = {}) {
  const finite = (value, fallback, min, max) => {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? Math.floor(number) : fallback));
  };
  return {
    maxDepth: finite(options.maxDepth, 18, 4, 40),
    maxNodes: finite(options.maxNodes, 24_000, 100, 100_000),
    maxObjectKeys: finite(options.maxObjectKeys, 2_000, 20, 10_000),
    maxArrayItems: finite(options.maxArrayItems, 8_000, 20, 50_000),
    maxStringChars: finite(options.maxStringChars, 160_000, 1_000, 500_000),
    maxTotalStringChars: finite(options.maxTotalStringChars, 1_000_000, 10_000, 4_000_000),
  };
}

function safetyError(code, message) {
  const error = new Error(message);
  error.name = 'ValoraeCapturedJsonSafetyError';
  error.code = code;
  return error;
}

/**
 * Clones captured public JSON into a bounded, prototype-safe shape.
 * Secret and personal fields are removed instead of being retained in caches,
 * diagnostics or downstream extractor documents.
 */
export function sanitizeCapturedJson(value, options = {}) {
  const limits = safeLimits(options);
  const metrics = {
    nodes: 0,
    strings: 0,
    totalStringChars: 0,
    prototypeKeysRemoved: 0,
    sensitiveFieldsRemoved: 0,
    secretValuesRemoved: 0,
    personalValuesRemoved: 0,
  };

  function visit(input, depth) {
    if (depth > limits.maxDepth) throw safetyError('CAPTURED_JSON_DEPTH_LIMIT', 'JSON capturado excedeu a profundidade segura.');
    metrics.nodes += 1;
    if (metrics.nodes > limits.maxNodes) throw safetyError('CAPTURED_JSON_NODE_LIMIT', 'JSON capturado excedeu a complexidade segura.');

    if (input === null || typeof input === 'boolean') return input;
    if (typeof input === 'number') return Number.isFinite(input) ? input : null;
    if (typeof input === 'string') {
      metrics.strings += 1;
      metrics.totalStringChars += input.length;
      if (metrics.totalStringChars > limits.maxTotalStringChars) {
        throw safetyError('CAPTURED_JSON_STRING_BUDGET', 'JSON capturado excedeu o orçamento textual seguro.');
      }
      const sensitiveKind = sensitiveStringKind(input);
      if (sensitiveKind) {
        if (sensitiveKind === 'secret') metrics.secretValuesRemoved += 1;
        else metrics.personalValuesRemoved += 1;
        return undefined;
      }
      return input.slice(0, limits.maxStringChars);
    }
    if (typeof input !== 'object') return undefined;

    if (Array.isArray(input)) {
      if (input.length > limits.maxArrayItems) {
        throw safetyError('CAPTURED_JSON_ARRAY_LIMIT', 'JSON capturado excedeu o limite seguro de itens.');
      }
      const out = [];
      for (const item of input) {
        const sanitized = visit(item, depth + 1);
        if (sanitized !== undefined) out.push(sanitized);
      }
      return out;
    }

    const entries = Object.entries(input);
    if (entries.length > limits.maxObjectKeys) {
      throw safetyError('CAPTURED_JSON_OBJECT_LIMIT', 'JSON capturado excedeu o limite seguro de propriedades.');
    }
    const out = {};
    for (const [key, nested] of entries) {
      const normalized = normalizedKey(key);
      if (PROTOTYPE_KEYS.has(key) || PROTOTYPE_KEYS.has(normalized)) {
        metrics.prototypeKeysRemoved += 1;
        continue;
      }
      if (SECRET_KEYS.has(normalized) || PERSONAL_KEYS.has(normalized)) {
        metrics.sensitiveFieldsRemoved += 1;
        continue;
      }
      const sanitized = visit(nested, depth + 1);
      if (sanitized !== undefined) out[key] = sanitized;
    }
    return out;
  }

  try {
    const data = visit(value, 0);
    if (!data || typeof data !== 'object') {
      return { ok: false, reason: 'CAPTURED_JSON_EMPTY_AFTER_SANITIZATION', data: null, metrics };
    }
    return { ok: true, data, metrics };
  } catch (error) {
    return {
      ok: false,
      reason: String(error?.code || 'CAPTURED_JSON_SANITIZATION_FAILED'),
      data: null,
      metrics,
    };
  }
}

export const _test = { normalizedKey, safeLimits, sensitiveStringKind, PROTOTYPE_KEYS, SECRET_KEYS, PERSONAL_KEYS };
