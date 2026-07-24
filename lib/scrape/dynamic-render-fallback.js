import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { VALORAE_DYNAMIC_RENDER_VERSION } from '../core/feature-versions.js';
import {
  createNetworkJsonCollector,
  VALORAE_NETWORK_JSON_CAPTURE_IMPLEMENTATION,
  VALORAE_NETWORK_JSON_CAPTURE_POLICY,
} from './network-json-capture.js';
import { approximateSiteKey, isPrivateOrSpecialHost, isPrivateOrSpecialIpAddress, resolvePublicHost } from './network-safety.js';
export { VALORAE_DYNAMIC_RENDER_VERSION } from '../core/feature-versions.js';
export const VALORAE_DYNAMIC_RENDER_POLICY = 'controlled-browser-fallback-shadow-v1';
export const VALORAE_DYNAMIC_RENDER_IMPLEMENTATION = 'playwright-core-optional-sandboxed-browser-request-dns-and-sanitized-json-guard-v5';

const DEFAULT_ALLOWED_HOSTS = new Set([
  'investidor10.com.br',
  'www.investidor10.com.br',
  'statusinvest.com.br',
  'www.statusinvest.com.br',
]);

const state = globalThis.__VALORAE_DYNAMIC_RENDER_STATE__ || {
  active: 0,
  windowStartedAt: Date.now(),
  windowRuns: 0,
  cache: new Map(),
  inflight: new Map(),
  metrics: {
    considered: 0,
    runs: 0,
    successes: 0,
    failures: 0,
    skipped: 0,
    unavailable: 0,
    budgetRejected: 0,
    cacheHits: 0,
    promoted: 0,
    gainedKeys: 0,
    lostKeys: 0,
    totalElapsedMs: 0,
    lastElapsedMs: 0,
    lastStatus: 'NEVER',
    lastReason: '',
    lastRunAt: '',
    networkResponsesObserved: 0,
    networkJsonDocuments: 0,
    networkCapturedBytes: 0,
    networkParseFailures: 0,
    dnsGuards: 0,
    dnsGuardFailures: 0,
    serverAddressChecks: 0,
    unsafeServerAddresses: 0,
    requestDnsPreflights: 0,
    requestDnsFailures: 0,
    popupBlocks: 0,
    websocketBlocks: 0,
  },
  runtimeOverride: null,
  browserPool: {
    browser: null,
    key: '',
    launchedAt: 0,
    uses: 0,
  },
};
globalThis.__VALORAE_DYNAMIC_RENDER_STATE__ = state;
state.browserPool ||= { browser: null, key: '', launchedAt: 0, uses: 0 };
Object.assign(state.metrics, {
  browserLaunches: Number(state.metrics.browserLaunches || 0),
  browserReuses: Number(state.metrics.browserReuses || 0),
  browserRotations: Number(state.metrics.browserRotations || 0),
  isolatedContexts: Number(state.metrics.isolatedContexts || 0),
  explicitSelectorWaits: Number(state.metrics.explicitSelectorWaits || 0),
  networkIdleWaits: Number(state.metrics.networkIdleWaits || 0),
  networkResponsesObserved: Number(state.metrics.networkResponsesObserved || 0),
  networkJsonDocuments: Number(state.metrics.networkJsonDocuments || 0),
  networkCapturedBytes: Number(state.metrics.networkCapturedBytes || 0),
  networkParseFailures: Number(state.metrics.networkParseFailures || 0),
  dnsGuards: Number(state.metrics.dnsGuards || 0),
  dnsGuardFailures: Number(state.metrics.dnsGuardFailures || 0),
  serverAddressChecks: Number(state.metrics.serverAddressChecks || 0),
  unsafeServerAddresses: Number(state.metrics.unsafeServerAddresses || 0),
  requestDnsPreflights: Number(state.metrics.requestDnsPreflights || 0),
  requestDnsFailures: Number(state.metrics.requestDnsFailures || 0),
  popupBlocks: Number(state.metrics.popupBlocks || 0),
  websocketBlocks: Number(state.metrics.websocketBlocks || 0),
});

function boolEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on', 'enabled'].includes(String(raw).trim().toLowerCase());
}

function intEnv(name, fallback, min, max) {
  const value = Number(process.env[name]);
  return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.floor(value) : fallback));
}

function numberEnv(name, fallback, min, max) {
  const value = Number(process.env[name]);
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
}

export function dynamicRenderMode() {
  if (!boolEnv('VALORAE_DYNAMIC_RENDER_ENABLED', true)) return 'disabled';
  const raw = String(process.env.VALORAE_DYNAMIC_RENDER_MODE || 'shadow').trim().toLowerCase();
  if (['disabled', 'off', 'legacy-only', 'static-only'].includes(raw)) return 'disabled';
  if (['prefer-rendered', 'promote-safe', 'rendered'].includes(raw)) return 'prefer-rendered';
  return 'shadow';
}

function maxConcurrent() { return intEnv('VALORAE_DYNAMIC_RENDER_MAX_CONCURRENT', 1, 1, 3); }
function maxRunsPerMinute() { return intEnv('VALORAE_DYNAMIC_RENDER_MAX_RUNS_PER_MINUTE', 4, 1, 30); }
function timeoutMs() { return intEnv('VALORAE_DYNAMIC_RENDER_TIMEOUT_MS', 8000, 1500, 15000); }
function maxHtmlChars() { return intEnv('VALORAE_DYNAMIC_RENDER_MAX_HTML_CHARS', 3_000_000, 100_000, 5_000_000); }
function minStaticCoverage() { return numberEnv('VALORAE_DYNAMIC_RENDER_MIN_STATIC_COVERAGE', 0.65, 0.05, 1); }
function cacheTtlMs() { return intEnv('VALORAE_DYNAMIC_RENDER_CACHE_TTL_MS', 600_000, 30_000, 3_600_000); }
function cacheEntries() { return intEnv('VALORAE_DYNAMIC_RENDER_CACHE_ENTRIES', 24, 4, 100); }
function browserReuseEnabled() { return boolEnv('VALORAE_DYNAMIC_RENDER_BROWSER_REUSE', true); }
function browserMaxUses() { return intEnv('VALORAE_DYNAMIC_RENDER_BROWSER_MAX_USES', 80, 1, 500); }
function browserMaxAgeMs() { return intEnv('VALORAE_DYNAMIC_RENDER_BROWSER_MAX_AGE_MS', 900_000, 30_000, 3_600_000); }
function networkCaptureEnabled() { return boolEnv('VALORAE_DYNAMIC_NETWORK_CAPTURE_ENABLED', true); }
function dnsGuardEnabled() { return boolEnv('VALORAE_DYNAMIC_DNS_GUARD_ENABLED', true); }
function networkMaxDocuments() { return intEnv('VALORAE_DYNAMIC_NETWORK_MAX_DOCUMENTS', 24, 1, 80); }
function networkMaxDocumentBytes() { return intEnv('VALORAE_DYNAMIC_NETWORK_MAX_DOCUMENT_BYTES', 512 * 1024, 16 * 1024, 1_500_000); }
function networkMaxTotalBytes() { return intEnv('VALORAE_DYNAMIC_NETWORK_MAX_TOTAL_BYTES', 2 * 1024 * 1024, 64 * 1024, 6_000_000); }
function networkSettleMs() { return intEnv('VALORAE_DYNAMIC_NETWORK_SETTLE_MS', 180, 0, 1200); }
function networkCollectorSettleTimeoutMs() { return intEnv('VALORAE_DYNAMIC_NETWORK_COLLECTOR_SETTLE_TIMEOUT_MS', 1500, 100, 5000); }
function networkMaxPending() { return intEnv('VALORAE_DYNAMIC_NETWORK_MAX_PENDING', 48, 4, 160); }
function browserSandboxEnabled() { return !boolEnv('VALORAE_BROWSER_DISABLE_SANDBOX', false); }
function requireServerAddress() { return boolEnv('VALORAE_DYNAMIC_REQUIRE_SERVER_ADDRESS', true); }
function networkAllowedHosts() {
  return String(process.env.VALORAE_DYNAMIC_RENDER_ALLOWED_SUBRESOURCE_HOSTS || '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
}

export function dynamicNetworkCaptureMode() {
  if (!networkCaptureEnabled()) return 'disabled';
  const raw = String(process.env.VALORAE_DYNAMIC_NETWORK_CAPTURE_MODE || 'known-endpoint-gap-fill').trim().toLowerCase();
  if (['disabled', 'off', 'none'].includes(raw)) return 'disabled';
  if (['shadow', 'observe-only'].includes(raw)) return 'shadow';
  return 'known-endpoint-gap-fill';
}

function present(value) {
  if (Array.isArray(value)) return value.some(present);
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function coverage(results = {}, selectors = {}) {
  const keys = Object.keys(selectors || {});
  if (!keys.length) return { expected: 0, matched: 0, ratio: 1 };
  const matched = keys.filter(key => present(results?.[key])).length;
  return { expected: keys.length, matched, ratio: matched / keys.length };
}

const SENSITIVE_MAIN_PATH = /(?:^|\/)(?:auth|login|logout|oauth|token|session|captcha|password|register|signup|signin|signout|account\/me|user\/me)(?:\/|$)/i;
const SENSITIVE_MAIN_QUERY_KEY = /^(?:access_?token|refresh_?token|id_?token|auth|authorization|secret|password|passwd|session|cookie|email|cpf|api_?key)$/i;

function safeDiagnosticUrl(rawUrl = '') {
  let url;
  try { url = new URL(String(rawUrl || '')); } catch { return ''; }
  url.username = '';
  url.password = '';
  url.hash = '';
  url.search = '';
  return url.toString();
}

function configuredAllowedHosts() {
  const hosts = new Set(DEFAULT_ALLOWED_HOSTS);
  String(process.env.VALORAE_ALLOWED_SCRAPE_HOSTS || '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
    .forEach(host => hosts.add(host));
  return hosts;
}

function validateMainUrl(rawUrl = '') {
  let url;
  try { url = new URL(String(rawUrl || '').trim()); } catch { return { ok: false, reason: 'invalid-url' }; }
  if (url.protocol !== 'https:' || url.username || url.password || isPrivateOrSpecialHost(url.hostname)) return { ok: false, reason: 'unsafe-url' };
  if (SENSITIVE_MAIN_PATH.test(url.pathname) || [...url.searchParams.keys()].some(key => SENSITIVE_MAIN_QUERY_KEY.test(key))) return { ok: false, reason: 'sensitive-url' };
  if (!configuredAllowedHosts().has(url.hostname.toLowerCase())) return { ok: false, reason: 'host-not-allowed' };
  url.hash = '';
  return { ok: true, url };
}

function subresourceAllowed(rawUrl, targetHost) {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  if (isPrivateOrSpecialHost(url.hostname)) return false;
  const targetBase = approximateSiteKey(targetHost);
  const hostBase = approximateSiteKey(url.hostname);
  if (targetBase && hostBase === targetBase) return true;
  const extra = String(process.env.VALORAE_DYNAMIC_RENDER_ALLOWED_SUBRESOURCE_HOSTS || '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return extra.includes(url.hostname.toLowerCase());
}

function wafLike(text = '') {
  return /captcha|cloudflare|access denied|forbidden|verify you are human|bot detection/i.test(String(text || '').slice(0, 8000));
}

function selectorFingerprint(selectors = {}) {
  return createHash('sha1').update(JSON.stringify(selectors || {})).digest('base64url').slice(0, 20);
}

function cacheKey(url, selectors) {
  const urlHash = createHash('sha256').update(String(url || '')).digest('base64url').slice(0, 24);
  return `${urlHash}|${selectorFingerprint(selectors)}`;
}

function cacheGet(key) {
  const entry = state.cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { state.cache.delete(key); return null; }
  state.cache.delete(key);
  state.cache.set(key, entry);
  state.metrics.cacheHits += 1;
  return entry.value;
}

function cacheSet(key, value) {
  state.cache.delete(key);
  state.cache.set(key, { value, expiresAt: Date.now() + cacheTtlMs() });
  while (state.cache.size > cacheEntries()) state.cache.delete(state.cache.keys().next().value);
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

function record(status, elapsed = 0, reason = '', comparison = null) {
  const metrics = state.metrics;
  metrics.lastRunAt = new Date().toISOString();
  metrics.lastStatus = status;
  metrics.lastReason = String(reason || '').slice(0, 180);
  metrics.lastElapsedMs = Math.round(elapsed * 100) / 100;
  if (status === 'SKIPPED') metrics.skipped += 1;
  else if (status === 'UNAVAILABLE') metrics.unavailable += 1;
  else {
    metrics.runs += 1;
    metrics.totalElapsedMs += elapsed;
    if (status === 'OK') metrics.successes += 1;
    else metrics.failures += 1;
  }
  if (comparison) {
    metrics.gainedKeys += comparison.gainedKeys.length;
    metrics.lostKeys += comparison.lostKeys.length;
    if (comparison.promoted) metrics.promoted += 1;
  }
}

function compareResults(staticResults = {}, renderedResults = {}, selectors = {}) {
  const keys = Object.keys(selectors || {});
  const gainedKeys = [];
  const lostKeys = [];
  const divergentKeys = [];
  for (const key of keys) {
    const staticValue = staticResults?.[key];
    const renderedValue = renderedResults?.[key];
    const hasStatic = present(staticValue);
    const hasRendered = present(renderedValue);
    if (!hasStatic && hasRendered) gainedKeys.push(key);
    if (hasStatic && !hasRendered) lostKeys.push(key);
    if (hasStatic && hasRendered && JSON.stringify(staticValue) !== JSON.stringify(renderedValue)) divergentKeys.push(key);
  }
  return {
    gainedKeys,
    lostKeys,
    divergentKeys,
    promotionSafe: lostKeys.length === 0,
  };
}

function mergeMissing(staticResults = {}, renderedResults = {}, selectors = {}) {
  const out = { ...(staticResults || {}) };
  for (const key of Object.keys(selectors || {})) {
    if (!present(out[key]) && present(renderedResults?.[key])) out[key] = renderedResults[key];
  }
  return out;
}

export function chooseDynamicWaitSelector(selectors = {}, staticResults = {}, explicit = '') {
  const configured = String(explicit || '').trim();
  if (configured) return configured.slice(0, 300);
  for (const [key, rawSpec] of Object.entries(selectors || {})) {
    if (present(staticResults?.[key])) continue;
    const selector = String(typeof rawSpec === 'string' ? rawSpec : rawSpec?.selector || '').trim();
    if (!selector || selector.length > 300) continue;
    if (/:contains\(|:eq\(|:first\b|:last\b/i.test(selector)) continue;
    if (/[{};]/.test(selector)) continue;
    return selector;
  }
  return '';
}

async function discardPooledBrowser({ rotate = false } = {}) {
  const browser = state.browserPool.browser;
  state.browserPool = { browser: null, key: '', launchedAt: 0, uses: 0 };
  if (rotate && browser) state.metrics.browserRotations += 1;
  await browser?.close().catch(() => {});
}

async function acquireLocalBrowser(chromium, executablePath, options = {}) {
  const key = executablePath || 'bundled-chromium';
  const reuse = browserReuseEnabled();
  const pooled = state.browserPool;
  const connected = pooled.browser && (typeof pooled.browser.isConnected !== 'function' || pooled.browser.isConnected());
  const reusable = reuse && connected && pooled.key === key && pooled.uses < browserMaxUses() && Date.now() - pooled.launchedAt < browserMaxAgeMs();
  if (reusable) {
    pooled.uses += 1;
    state.metrics.browserReuses += 1;
    return { browser: pooled.browser, pooled: true };
  }
  if (pooled.browser) await discardPooledBrowser({ rotate: true });
  const sandbox = browserSandboxEnabled();
  const browser = await chromium.launch({
    headless: true,
    executablePath: executablePath || undefined,
    timeout: options.timeoutMs,
    chromiumSandbox: sandbox,
    args: sandbox ? ['--disable-dev-shm-usage'] : ['--disable-dev-shm-usage', '--no-sandbox'],
  });
  state.metrics.browserLaunches += 1;
  if (reuse) state.browserPool = { browser, key, launchedAt: Date.now(), uses: 1 };
  return { browser, pooled: reuse };
}

async function verifyPublicResponseAddress(response) {
  if (!response || typeof response.serverAddr !== 'function') {
    if (requireServerAddress()) {
      const error = new Error('O endereço real da resposta do navegador não está disponível.');
      error.code = 'BROWSER_SERVER_ADDRESS_UNAVAILABLE';
      throw error;
    }
    return null;
  }
  let address = null;
  try { address = await response.serverAddr(); } catch (cause) {
    if (requireServerAddress()) {
      const error = new Error('Não foi possível verificar o endereço real da resposta do navegador.');
      error.code = 'BROWSER_SERVER_ADDRESS_CHECK_FAILED';
      error.cause = cause;
      throw error;
    }
    return null;
  }
  if (!address?.ipAddress) {
    if (requireServerAddress()) {
      const error = new Error('A resposta do navegador não informou endereço de rede verificável.');
      error.code = 'BROWSER_SERVER_ADDRESS_EMPTY';
      throw error;
    }
    return null;
  }
  state.metrics.serverAddressChecks += 1;
  if (isPrivateOrSpecialIpAddress(address.ipAddress)) {
    state.metrics.unsafeServerAddresses += 1;
    const error = new Error('A resposta do navegador foi resolvida para endereço privado ou especial.');
    error.code = 'UNSAFE_BROWSER_SERVER_ADDRESS';
    throw error;
  }
  return { verified: true, family: address.ipAddress.includes(':') ? 6 : 4 };
}

async function loadPlaywrightRuntime() {
  if (typeof state.runtimeOverride === 'function') return { type: 'test-runtime', render: state.runtimeOverride };
  const cdpConfigured = Boolean(String(process.env.VALORAE_BROWSER_CDP_URL || '').trim());
  const executableConfigured = Boolean(String(process.env.VALORAE_BROWSER_EXECUTABLE_PATH || '').trim());
  const allowBundled = boolEnv('VALORAE_DYNAMIC_RENDER_ALLOW_BUNDLED_BROWSER', false);
  if (!cdpConfigured && !executableConfigured && !allowBundled) return null;
  let playwright;
  try { playwright = await import('playwright-core'); }
  catch { return null; }
  const chromium = playwright?.chromium;
  if (!chromium) return null;
  return {
    type: 'playwright-core',
    async render(url, options = {}) {
      const cdpUrl = String(process.env.VALORAE_BROWSER_CDP_URL || '').trim();
      const executablePath = String(process.env.VALORAE_BROWSER_EXECUTABLE_PATH || '').trim();
      const mainHost = new URL(url).hostname.toLowerCase();
      const requestDnsChecks = new Map();
      if (dnsGuardEnabled()) {
        try {
          const addresses = await resolvePublicHost(mainHost, { forceRefresh: true, ttlMs: 30_000 });
          requestDnsChecks.set(mainHost, Promise.resolve(addresses));
          state.metrics.dnsGuards += 1;
          state.metrics.requestDnsPreflights += 1;
        } catch (error) {
          state.metrics.dnsGuardFailures += 1;
          state.metrics.requestDnsFailures += 1;
          throw error;
        }
      }
      let browser;
      let context;
      let pooled = false;
      let failed = false;
      try {
        if (cdpUrl) {
          browser = await chromium.connectOverCDP(cdpUrl, { timeout: options.timeoutMs });
          state.metrics.browserLaunches += 1;
        } else {
          const acquired = await acquireLocalBrowser(chromium, executablePath, options);
          browser = acquired.browser;
          pooled = acquired.pooled;
        }
        context = await browser.newContext({
          javaScriptEnabled: true,
          ignoreHTTPSErrors: false,
          serviceWorkers: 'block',
          acceptDownloads: false,
          permissions: [],
        });
        state.metrics.isolatedContexts += 1;
        if (typeof context.routeWebSocket === 'function') {
          await context.routeWebSocket('**/*', webSocket => {
            state.metrics.websocketBlocks += 1;
            return webSocket.close();
          });
        }
        const page = await context.newPage();
        context.on('page', candidate => {
          if (candidate === page) return;
          state.metrics.popupBlocks += 1;
          void candidate.close().catch(() => {});
        });
        page.on('dialog', dialog => { void dialog.dismiss().catch(() => {}); });
        const networkCollector = networkCaptureEnabled()
          ? createNetworkJsonCollector({
              targetUrl: url,
              allowedHosts: networkAllowedHosts(),
              maxDocuments: networkMaxDocuments(),
              maxDocumentBytes: networkMaxDocumentBytes(),
              maxTotalBytes: networkMaxTotalBytes(),
              maxPending: networkMaxPending(),
              settleTimeoutMs: networkCollectorSettleTimeoutMs(),
              requireServerAddress: requireServerAddress(),
            })
          : null;
        if (networkCollector) page.on('response', networkCollector.observe);
        await page.route('**/*', async route => {
          const request = route.request();
          const type = request.resourceType();
          const requestUrl = request.url();
          if (['image', 'media', 'font'].includes(type)) return route.abort('blockedbyclient');
          if (!subresourceAllowed(requestUrl, mainHost)) return route.abort('blockedbyclient');
          if (dnsGuardEnabled()) {
            let parsed;
            try { parsed = new URL(requestUrl); } catch { return route.abort('blockedbyclient'); }
            const host = parsed.hostname.toLowerCase();
            let check = requestDnsChecks.get(host);
            if (!check) {
              state.metrics.requestDnsPreflights += 1;
              check = resolvePublicHost(host, { forceRefresh: true, ttlMs: 30_000 });
              requestDnsChecks.set(host, check);
            }
            try { await check; }
            catch {
              state.metrics.requestDnsFailures += 1;
              return route.abort('blockedbyclient');
            }
          }
          return route.continue();
        });
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
        const serverAddress = await verifyPublicResponseAddress(response);
        let waitStrategy = 'networkidle';
        if (options.waitForSelector) {
          waitStrategy = 'explicit-selector';
          state.metrics.explicitSelectorWaits += 1;
          await page.waitForSelector(options.waitForSelector, { state: 'attached', timeout: Math.min(2500, options.timeoutMs) }).catch(() => {});
        } else {
          state.metrics.networkIdleWaits += 1;
          await page.waitForLoadState('networkidle', { timeout: Math.min(1800, Math.max(500, options.timeoutMs / 4)) }).catch(() => {});
        }
        if (networkCollector && networkSettleMs() > 0) {
          await new Promise(resolve => setTimeout(resolve, networkSettleMs()));
        }
        const networkDocuments = networkCollector ? await networkCollector.settle() : [];
        const networkDiagnostics = networkCollector?.diagnostics?.() || {
          policyVersion: VALORAE_NETWORK_JSON_CAPTURE_POLICY,
          implementation: VALORAE_NETWORK_JSON_CAPTURE_IMPLEMENTATION,
          documents: 0,
          capturedBytes: 0,
        };
        state.metrics.networkResponsesObserved += Number(networkDiagnostics.observed || 0);
        state.metrics.networkJsonDocuments += Number(networkDiagnostics.documents || 0);
        state.metrics.networkCapturedBytes += Number(networkDiagnostics.capturedBytes || 0);
        state.metrics.networkParseFailures += Number(networkDiagnostics.parseFailures || 0);
        const finalUrl = page.url();
        const validatedFinal = validateMainUrl(finalUrl);
        if (!validatedFinal.ok) throw new Error(`redirect-${validatedFinal.reason}`);
        const html = String(await page.content()).slice(0, options.maxHtmlChars);
        return {
          html,
          finalUrl: safeDiagnosticUrl(finalUrl),
          status: response?.status?.() || 200,
          runtime: 'playwright-core',
          waitStrategy,
          browserReused: pooled && state.browserPool.uses > 1,
          serverAddressVerified: Boolean(serverAddress?.verified),
          networkDocuments,
          networkDiagnostics,
        };
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        await context?.close().catch(() => {});
        if (pooled && failed && state.browserPool.browser === browser) await discardPooledBrowser({ rotate: true });
        else if (!pooled) await browser?.close().catch(() => {});
      }
    },
  };
}

export function setDynamicRenderRuntimeForTests(runtime = null) {
  state.runtimeOverride = runtime;
}

export function resetDynamicRenderStateForTests() {
  state.active = 0;
  state.windowStartedAt = Date.now();
  state.windowRuns = 0;
  state.cache.clear();
  state.inflight.clear();
  state.runtimeOverride = null;
  void discardPooledBrowser();
  Object.assign(state.metrics, {
    considered: 0, runs: 0, successes: 0, failures: 0, skipped: 0, unavailable: 0,
    budgetRejected: 0, cacheHits: 0, promoted: 0, gainedKeys: 0, lostKeys: 0,
    totalElapsedMs: 0, lastElapsedMs: 0, lastStatus: 'NEVER', lastReason: '', lastRunAt: '',
    browserLaunches: 0, browserReuses: 0, browserRotations: 0, isolatedContexts: 0,
    explicitSelectorWaits: 0, networkIdleWaits: 0, networkResponsesObserved: 0,
    networkJsonDocuments: 0, networkCapturedBytes: 0, networkParseFailures: 0,
    dnsGuards: 0, dnsGuardFailures: 0, serverAddressChecks: 0, unsafeServerAddresses: 0,
    requestDnsPreflights: 0, requestDnsFailures: 0, popupBlocks: 0, websocketBlocks: 0,
  });
}

export async function runDynamicRenderFallback({ url = '', selectors = null, staticHtml = '', staticResults = {}, options = {}, extractRendered } = {}) {
  state.metrics.considered += 1;
  const mode = dynamicRenderMode();
  const validated = validateMainUrl(url);
  const staticCoverage = coverage(staticResults, selectors || {});
  const skip = reason => {
    record('SKIPPED', 0, reason);
    return { results: staticResults, diagnostics: { version: VALORAE_DYNAMIC_RENDER_VERSION, mode, ran: false, promoted: false, reason, staticCoverage } };
  };
  if (mode === 'disabled') return skip('disabled');
  if (!selectors || !Object.keys(selectors).length) return skip('no-selectors');
  if (!validated.ok) return skip(validated.reason);
  if (options.blocked || wafLike(staticHtml)) return skip('blocked-or-waf');
  const threshold = Math.max(minStaticCoverage(), Number(options.minCoverage || 0));
  if (staticCoverage.ratio >= threshold) return skip('static-coverage-sufficient');
  if (typeof extractRendered !== 'function') return skip('extractor-missing');

  const key = cacheKey(validated.url.toString(), selectors);
  const cached = cacheGet(key);
  if (cached) {
    const comparison = compareResults(staticResults, cached.results, selectors);
    const promoted = mode === 'prefer-rendered' && comparison.promotionSafe && comparison.gainedKeys.length > 0;
    comparison.promoted = promoted;
    return {
      results: promoted ? mergeMissing(staticResults, cached.results, selectors) : staticResults,
      candidateResults: cached.results,
      renderedHtml: cached.html,
      networkDocuments: cached.networkDocuments || [],
      diagnostics: { ...cached.diagnostics, mode, cache: 'HIT', promoted, comparison, outputSource: promoted ? 'rendered-gap-fill' : 'static-preserved' },
    };
  }

  if (!budgetAvailable()) {
    state.metrics.budgetRejected += 1;
    return skip('budget-exhausted');
  }
  if (state.inflight.has(key)) return state.inflight.get(key);

  const promise = (async () => {
    const started = performance.now();
    state.active += 1;
    state.windowRuns += 1;
    try {
      const runtime = await loadPlaywrightRuntime();
      if (!runtime) {
        const elapsed = performance.now() - started;
        record('UNAVAILABLE', elapsed, 'playwright-runtime-unavailable');
        return { results: staticResults, diagnostics: { version: VALORAE_DYNAMIC_RENDER_VERSION, mode, ran: false, promoted: false, reason: 'playwright-runtime-unavailable', runtimeAvailable: false, staticCoverage, elapsedMs: Math.round(elapsed * 100) / 100 } };
      }
      const waitForSelector = chooseDynamicWaitSelector(selectors, staticResults, options.waitForSelector);
      const rendered = await runtime.render(validated.url.toString(), { timeoutMs: timeoutMs(), maxHtmlChars: maxHtmlChars(), waitForSelector });
      const html = String(rendered?.html || '').slice(0, maxHtmlChars());
      if (!html || wafLike(html)) throw new Error(html ? 'rendered-waf-detected' : 'rendered-html-empty');
      const networkDocuments = Array.isArray(rendered?.networkDocuments) ? rendered.networkDocuments : [];
      const extracted = await extractRendered(html, {
        networkDocuments,
        networkDiagnostics: rendered?.networkDiagnostics || {},
        finalUrl: safeDiagnosticUrl(rendered?.finalUrl || validated.url.toString()),
      });
      const renderedResults = extracted?.results || {};
      const renderedCoverage = coverage(renderedResults, selectors);
      const comparison = compareResults(staticResults, renderedResults, selectors);
      const promoted = mode === 'prefer-rendered' && comparison.promotionSafe && comparison.gainedKeys.length > 0;
      comparison.promoted = promoted;
      const elapsed = performance.now() - started;
      const diagnostics = {
        version: VALORAE_DYNAMIC_RENDER_VERSION,
        policyVersion: VALORAE_DYNAMIC_RENDER_POLICY,
        mode,
        ran: true,
        promoted,
        runtimeAvailable: true,
        runtime: rendered.runtime || runtime.type,
        outputSource: promoted ? 'rendered-gap-fill' : 'static-preserved',
        staticCoverage,
        renderedCoverage,
        comparison,
        elapsedMs: Math.round(elapsed * 100) / 100,
        finalUrl: safeDiagnosticUrl(rendered.finalUrl || validated.url.toString()),
        status: Number(rendered.status || 200),
        cache: 'MISS',
        waitForSelector: waitForSelector || undefined,
        waitStrategy: rendered.waitStrategy || (waitForSelector ? 'explicit-selector' : 'networkidle'),
        browserReused: Boolean(rendered.browserReused),
        networkCapture: rendered?.networkDiagnostics || {
          policyVersion: VALORAE_NETWORK_JSON_CAPTURE_POLICY,
          implementation: VALORAE_NETWORK_JSON_CAPTURE_IMPLEMENTATION,
          documents: networkDocuments.length,
        },
      };
      record('OK', elapsed, '', comparison);
      cacheSet(key, { results: renderedResults, html, diagnostics, networkDocuments });
      return { results: promoted ? mergeMissing(staticResults, renderedResults, selectors) : staticResults, candidateResults: renderedResults, renderedHtml: html, networkDocuments, diagnostics };
    } catch (error) {
      const elapsed = performance.now() - started;
      record('ERROR', elapsed, error?.message || String(error));
      return { results: staticResults, diagnostics: { version: VALORAE_DYNAMIC_RENDER_VERSION, policyVersion: VALORAE_DYNAMIC_RENDER_POLICY, mode, ran: true, promoted: false, runtimeAvailable: true, outputSource: 'static-preserved', reason: error?.message || 'render-failed', staticCoverage, elapsedMs: Math.round(elapsed * 100) / 100 } };
    } finally {
      state.active = Math.max(0, state.active - 1);
    }
  })();

  state.inflight.set(key, promise);
  try { return await promise; }
  finally { state.inflight.delete(key); }
}

export async function captureDynamicPageData({ url = '', staticHtml = '', options = {} } = {}) {
  state.metrics.considered += 1;
  const mode = dynamicNetworkCaptureMode();
  const validated = validateMainUrl(url);
  const skipped = reason => ({
    html: '',
    networkDocuments: [],
    diagnostics: {
      version: VALORAE_DYNAMIC_RENDER_VERSION,
      policyVersion: VALORAE_DYNAMIC_RENDER_POLICY,
      networkPolicyVersion: VALORAE_NETWORK_JSON_CAPTURE_POLICY,
      mode,
      ran: false,
      reason,
      promoted: false,
    },
  });
  if (mode === 'disabled' || dynamicRenderMode() === 'disabled') return skipped('disabled');
  if (!validated.ok) return skipped(validated.reason);
  if (options.blocked || wafLike(staticHtml)) return skipped('blocked-or-waf');
  const key = cacheKey(validated.url.toString(), { capture: 'network-json-v1' });
  const cached = cacheGet(key);
  if (cached?.captureOnly) {
    return {
      html: cached.html || '',
      networkDocuments: cached.networkDocuments || [],
      diagnostics: { ...cached.diagnostics, cache: 'HIT' },
    };
  }
  if (!budgetAvailable()) {
    state.metrics.budgetRejected += 1;
    return skipped('budget-exhausted');
  }
  if (state.inflight.has(key)) return state.inflight.get(key);
  const promise = (async () => {
    const started = performance.now();
    state.active += 1;
    state.windowRuns += 1;
    try {
      const runtime = await loadPlaywrightRuntime();
      if (!runtime) {
        const elapsed = performance.now() - started;
        record('UNAVAILABLE', elapsed, 'playwright-runtime-unavailable');
        return skipped('playwright-runtime-unavailable');
      }
      const rendered = await runtime.render(validated.url.toString(), {
        timeoutMs: timeoutMs(),
        maxHtmlChars: maxHtmlChars(),
        waitForSelector: String(options.waitForSelector || '').trim(),
      });
      const html = String(rendered?.html || '').slice(0, maxHtmlChars());
      if (!html || wafLike(html)) throw new Error(html ? 'rendered-waf-detected' : 'rendered-html-empty');
      const networkDocuments = Array.isArray(rendered?.networkDocuments) ? rendered.networkDocuments : [];
      const elapsed = performance.now() - started;
      const diagnostics = {
        version: VALORAE_DYNAMIC_RENDER_VERSION,
        policyVersion: VALORAE_DYNAMIC_RENDER_POLICY,
        networkPolicyVersion: VALORAE_NETWORK_JSON_CAPTURE_POLICY,
        mode,
        ran: true,
        promoted: false,
        outputPolicy: mode === 'known-endpoint-gap-fill' ? 'known-endpoint-json-gap-fill-only' : 'observe-only',
        runtime: rendered.runtime || runtime.type,
        elapsedMs: Math.round(elapsed * 100) / 100,
        finalUrl: safeDiagnosticUrl(rendered.finalUrl || validated.url.toString()),
        status: Number(rendered.status || 200),
        cache: 'MISS',
        waitStrategy: rendered.waitStrategy || 'networkidle',
        browserReused: Boolean(rendered.browserReused),
        networkCapture: rendered?.networkDiagnostics || {
          policyVersion: VALORAE_NETWORK_JSON_CAPTURE_POLICY,
          implementation: VALORAE_NETWORK_JSON_CAPTURE_IMPLEMENTATION,
          documents: networkDocuments.length,
        },
      };
      record('OK', elapsed, 'network-json-candidate-captured');
      cacheSet(key, { captureOnly: true, html, networkDocuments, diagnostics });
      return { html, networkDocuments, diagnostics };
    } catch (error) {
      const elapsed = performance.now() - started;
      record('ERROR', elapsed, error?.message || String(error));
      return {
        ...skipped(error?.message || 'render-failed'),
        diagnostics: {
          ...skipped(error?.message || 'render-failed').diagnostics,
          ran: true,
          elapsedMs: Math.round(elapsed * 100) / 100,
        },
      };
    } finally {
      state.active = Math.max(0, state.active - 1);
    }
  })();
  state.inflight.set(key, promise);
  try { return await promise; }
  finally { state.inflight.delete(key); }
}

export function buildDynamicRenderManifest() {
  const mode = dynamicRenderMode();
  const m = state.metrics;
  return {
    version: VALORAE_DYNAMIC_RENDER_VERSION,
    policyVersion: VALORAE_DYNAMIC_RENDER_POLICY,
    implementation: VALORAE_DYNAMIC_RENDER_IMPLEMENTATION,
    compatibility: 'additive-hidden-from-ui',
    contractImpact: 'none-financial-fields-preserved',
    enabled: mode !== 'disabled',
    mode,
    outputPolicy: mode === 'prefer-rendered' ? 'fill-only-missing-keys-when-no-static-loss' : 'static-output-preserved',
    networkCapturePolicy: dynamicNetworkCaptureMode(),
    triggerPolicy: 'selectors-present-and-static-coverage-below-threshold-and-no-waf-and-budget-available',
    runtime: {
      package: 'playwright-core',
      optional: true,
      requiresBundledOrSystemChromiumOrCdp: true,
      cdpConfigured: Boolean(String(process.env.VALORAE_BROWSER_CDP_URL || '').trim()),
      executableConfigured: Boolean(String(process.env.VALORAE_BROWSER_EXECUTABLE_PATH || '').trim()),
      reuseLocalBrowser: browserReuseEnabled(),
      isolatedContextPerRun: true,
      localBrowserSandboxEnabled: browserSandboxEnabled(),
      maxUsesBeforeRotation: browserMaxUses(),
      maxAgeMsBeforeRotation: browserMaxAgeMs(),
    },
    safety: {
      mainDocumentHttpsOnly: true,
      mainDocumentAllowlist: [...configuredAllowedHosts()].sort(),
      privateNetworkBlocked: true,
      dnsResolutionPreflightEnabled: dnsGuardEnabled(),
      actualServerAddressRequiredByDefault: requireServerAddress(),
      actualServerAddressVerifiedWhenAvailable: true,
      everyAllowedBrowserRequestDnsPreflight: dnsGuardEnabled(),
      localBrowserSandboxEnabledByDefault: browserSandboxEnabled(),
      downloadsPopupsAndWebSocketsBlocked: true,
      serviceWorkersBlockedForDeterministicNetworkVisibility: true,
      credentialsInUrlBlocked: true,
      imagesMediaFontsBlocked: true,
      subresourcesRestrictedToSameSiteOrExplicitAllowlist: true,
      wafResponsesNotRendered: true,
      pageJavaScriptExecutesOnlyInsideIsolatedBrowserContext: true,
      browserProcessMayBeReusedButCookiesStorageAndPagesAreNeverShared: true,
      jsonResponsesCapturedOnlyFromAllowedHostsAndBoundedBodies: true,
      sensitiveEndpointsAndQueryKeysRejected: true,
      capturedJsonSensitiveFieldsRemoved: true,
      capturedJsonPrototypeKeysRemoved: true,
      capturedJsonComplexityBounded: true,
      collectorBackpressureAndSettleTimeout: true,
      dynamicCacheKeysHashed: true,
      requestHeadersBodiesCookiesAndQueryStringsNeverPersisted: true,
      browserIsNeverMandatoryForFinancialContract: true,
    },
    limits: {
      maxConcurrent: maxConcurrent(),
      maxRunsPerMinute: maxRunsPerMinute(),
      timeoutMs: timeoutMs(),
      maxHtmlChars: maxHtmlChars(),
      minStaticCoverage: minStaticCoverage(),
      cacheTtlMs: cacheTtlMs(),
      cacheEntries: cacheEntries(),
      networkMaxDocuments: networkMaxDocuments(),
      networkMaxDocumentBytes: networkMaxDocumentBytes(),
      networkMaxTotalBytes: networkMaxTotalBytes(),
      networkSettleMs: networkSettleMs(),
      networkCollectorSettleTimeoutMs: networkCollectorSettleTimeoutMs(),
      networkMaxPending: networkMaxPending(),
    },
    metrics: {
      ...m,
      averageElapsedMs: m.runs ? Math.round((m.totalElapsedMs / m.runs) * 100) / 100 : 0,
      active: state.active,
      windowRuns: state.windowRuns,
      cacheEntries: state.cache.size,
      inflight: state.inflight.size,
    },
    rollback: {
      disable: 'VALORAE_DYNAMIC_RENDER_ENABLED=0',
      staticOnly: 'VALORAE_DYNAMIC_RENDER_MODE=disabled',
      disableNetworkCapture: 'VALORAE_DYNAMIC_NETWORK_CAPTURE_ENABLED=0',
      disableDnsGuard: 'VALORAE_DYNAMIC_DNS_GUARD_ENABLED=0',
      disableBrowserSandbox: 'VALORAE_BROWSER_DISABLE_SANDBOX=1',
      allowMissingServerAddress: 'VALORAE_DYNAMIC_REQUIRE_SERVER_ADDRESS=0',
    },
    endpoint: 'contract/dynamic-render',
  };
}
