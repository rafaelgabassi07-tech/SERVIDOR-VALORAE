import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';


function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? Math.floor(number) : fallback));
}

function cleanHost(hostname = '') {
  return String(hostname || '').trim().replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

function parseIpv4(host = '') {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part))) return null;
  const bytes = parts.map(Number);
  return bytes.every(value => value >= 0 && value <= 255) ? bytes : null;
}

function blockedIpv4(bytes) {
  if (!bytes) return false;
  const [a, b, c] = bytes;
  return a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 31 && c === 196) ||
    (a === 192 && b === 52 && c === 193) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 175 && c === 48) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;
}

function parseIpv6BigInt(host = '') {
  let value = cleanHost(host);
  if (!value || value.includes('%')) return null;
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    if (lastColon < 0) return null;
    const ipv4 = parseIpv4(value.slice(lastColon + 1));
    if (!ipv4) return null;
    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    value = `${value.slice(0, lastColon)}:${high}:${low}`;
  }
  if ((value.match(/::/g) || []).length > 1) return null;
  const [leftRaw, rightRaw = ''] = value.split('::');
  const left = leftRaw ? leftRaw.split(':') : [];
  const right = rightRaw ? rightRaw.split(':') : [];
  if (left.some(part => !/^[0-9a-f]{1,4}$/i.test(part)) || right.some(part => !/^[0-9a-f]{1,4}$/i.test(part))) return null;
  const missing = 8 - left.length - right.length;
  if (value.includes('::')) {
    if (missing < 1) return null;
  } else if (missing !== 0) return null;
  const parts = [...left, ...Array(Math.max(0, missing)).fill('0'), ...right];
  if (parts.length !== 8) return null;
  return parts.reduce((result, part) => (result << 16n) | BigInt(Number.parseInt(part || '0', 16)), 0n);
}

function cidrContains(value, prefix, bits) {
  if (value === null || prefix === null) return false;
  if (bits === 0) return true;
  const shift = 128n - BigInt(bits);
  return (value >> shift) === (prefix >> shift);
}

const BLOCKED_IPV6_CIDRS = [
  ['::', 96], // IPv4-compatible and unspecified low-address space.
  ['::1', 128],
  ['::ffff:0:0', 96], // IPv4-mapped IPv6.
  ['64:ff9b::', 96], // Well-known NAT64 translation prefix.
  ['64:ff9b:1::', 48], // Local-use NAT64 translation prefix.
  ['100::', 64], // Discard-only.
  ['2001::', 23], // IETF protocol assignments, Teredo, benchmarking and ORCHID.
  ['2001:db8::', 32], // Documentation.
  ['2002::', 16], // 6to4 transition space.
  ['2620:4f:8000::', 48], // Direct Delegation AS112 service.
  ['3fff::', 20], // Documentation.
  ['5f00::', 16], // Segment-routing special-purpose block.
  ['fc00::', 7], // Unique-local.
  ['fe80::', 10], // Link-local.
  ['fec0::', 10], // Deprecated site-local.
  ['ff00::', 8], // Multicast.
].map(([prefix, bits]) => ({ prefix: parseIpv6BigInt(prefix), bits }));

function blockedIpv6(host) {
  const parsed = parseIpv6BigInt(host);
  if (parsed === null) return true;
  return BLOCKED_IPV6_CIDRS.some(range => cidrContains(parsed, range.prefix, range.bits));
}

export function isPrivateOrSpecialIpAddress(address = '') {
  const value = cleanHost(address);
  const version = isIP(value);
  if (version === 4) return blockedIpv4(parseIpv4(value));
  if (version === 6) return blockedIpv6(value);
  return true;
}

export function isPrivateOrSpecialHost(hostname = '') {
  const host = cleanHost(hostname);
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  const version = isIP(host);
  if (version) return isPrivateOrSpecialIpAddress(host);
  return false;
}

const resolutionState = globalThis.__VALORAE_PUBLIC_DNS_RESOLUTION_STATE__ || {
  cache: new Map(),
};
globalThis.__VALORAE_PUBLIC_DNS_RESOLUTION_STATE__ = resolutionState;

function trimResolutionCache(maxEntries) {
  while (resolutionState.cache.size > maxEntries) {
    resolutionState.cache.delete(resolutionState.cache.keys().next().value);
  }
}

function resolutionError(code, message, cause) {
  const error = new Error(message);
  error.name = 'ValoraeNetworkSafetyError';
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

/**
 * Resolve a public hostname before an optional browser fallback starts.
 * `forceRefresh` is used for browser navigation boundaries so a stale safe DNS
 * cache entry cannot hide a later rebinding attempt.
 */
export async function resolvePublicHost(hostname = '', {
  lookup = dnsLookup,
  ttlMs = 300_000,
  maxEntries = 64,
  forceRefresh = false,
} = {}) {
  const host = cleanHost(hostname);
  if (!host || isPrivateOrSpecialHost(host)) {
    throw resolutionError('UNSAFE_NETWORK_HOST', `Host privado ou especial não permitido: ${host || '(vazio)'}.`);
  }

  const literalVersion = isIP(host);
  if (literalVersion) return [{ address: host, family: literalVersion }];

  const cached = resolutionState.cache.get(host);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    resolutionState.cache.delete(host);
    resolutionState.cache.set(host, cached);
    return cached.addresses.map(item => ({ ...item }));
  }
  if (cached) resolutionState.cache.delete(host);

  let rows;
  try {
    rows = await lookup(host, { all: true, verbatim: true });
  } catch (cause) {
    throw resolutionError('HOST_RESOLUTION_FAILED', `Não foi possível resolver o host público ${host}.`, cause);
  }
  const addresses = (Array.isArray(rows) ? rows : [rows])
    .map(item => ({ address: cleanHost(item?.address), family: Number(item?.family || isIP(item?.address)) }))
    .filter(item => item.address && item.family);
  if (!addresses.length) throw resolutionError('HOST_RESOLUTION_EMPTY', `O host ${host} não retornou endereços utilizáveis.`);
  const unsafe = addresses.find(item => isPrivateOrSpecialIpAddress(item.address));
  if (unsafe) {
    throw resolutionError('UNSAFE_RESOLVED_ADDRESS', `O host ${host} resolveu para um endereço privado ou especial.`);
  }

  const safeTtlMs = boundedInteger(ttlMs, 300_000, 1_000, 3_600_000);
  const safeMaxEntries = boundedInteger(maxEntries, 64, 4, 512);
  resolutionState.cache.set(host, { addresses, expiresAt: Date.now() + safeTtlMs });
  trimResolutionCache(safeMaxEntries);
  return addresses.map(item => ({ ...item }));
}

export function resetNetworkSafetyStateForTests() {
  resolutionState.cache.clear();
}

export function approximateSiteKey(hostname = '') {
  const parts = cleanHost(hostname).split('.').filter(Boolean);
  return parts.length > 2 ? parts.slice(-3).join('.') : parts.join('.');
}

export const _test = {
  boundedInteger,
  cleanHost,
  parseIpv4,
  blockedIpv4,
  parseIpv6BigInt,
  cidrContains,
  blockedIpv6,
  resolutionState,
};
