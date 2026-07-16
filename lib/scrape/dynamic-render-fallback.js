import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export const VALORAE_DYNAMIC_RENDER_VERSION = '2026.07.15-checkpoint111-v1';
export const VALORAE_DYNAMIC_RENDER_POLICY = 'controlled-browser-fallback-shadow-v1';
export const VALORAE_DYNAMIC_RENDER_IMPLEMENTATION = 'playwright-core-optional-budgeted-v1';

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
  },
  runtimeOverride: null,
};
globalThis.__VALORAE_DYNAMIC_RENDER_STATE__ = state;

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

function privateHost(hostname = '') {
  const host = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '0.0.0.0') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  const m = host.match(/^172\.(\d{1,3})\./);
  return Boolean(m && Number(m[1]) >= 16 && Number(m[1]) <= 31);
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
  if (url.protocol !== 'https:' || url.username || url.password || privateHost(url.hostname)) return { ok: false, reason: 'unsafe-url' };
  if (!configuredAllowedHosts().has(url.hostname.toLowerCase())) return { ok: false, reason: 'host-not-allowed' };
  url.hash = '';
  return { ok: true, url };
}

function baseDomain(hostname = '') {
  const parts = String(hostname || '').toLowerCase().split('.').filter(Boolean);
  return parts.length > 2 ? parts.slice(-3).join('.') : parts.join('.');
}

function subresourceAllowed(rawUrl, targetHost) {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (!['https:', 'data:'].includes(url.protocol)) return false;
  if (url.protocol === 'data:') return true;
  if (privateHost(url.hostname)) return false;
  const targetBase = baseDomain(targetHost);
  const hostBase = baseDomain(url.hostname);
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

function cacheKey(url, selectors) { return `${url}|${selectorFingerprint(selectors)}`; }

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
      let browser;
      let context;
      try {
        browser = cdpUrl
          ? await chromium.connectOverCDP(cdpUrl, { timeout: options.timeoutMs })
          : await chromium.launch({ headless: true, executablePath: executablePath || undefined, timeout: options.timeoutMs, args: ['--disable-dev-shm-usage', '--no-sandbox'] });
        context = await browser.newContext({ javaScriptEnabled: true, ignoreHTTPSErrors: false, serviceWorkers: 'block' });
        const page = await context.newPage();
        await page.route('**/*', async route => {
          const request = route.request();
          const type = request.resourceType();
          if (['image', 'media', 'font'].includes(type)) return route.abort('blockedbyclient');
          if (!subresourceAllowed(request.url(), new URL(url).hostname)) return route.abort('blockedbyclient');
          return route.continue();
        });
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
        await page.waitForLoadState('networkidle', { timeout: Math.min(1800, Math.max(500, options.timeoutMs / 4)) }).catch(() => {});
        if (options.waitForSelector) await page.waitForSelector(options.waitForSelector, { timeout: Math.min(2500, options.timeoutMs) }).catch(() => {});
        const finalUrl = page.url();
        const validatedFinal = validateMainUrl(finalUrl);
        if (!validatedFinal.ok) throw new Error(`redirect-${validatedFinal.reason}`);
        const html = String(await page.content()).slice(0, options.maxHtmlChars);
        return { html, finalUrl, status: response?.status?.() || 200, runtime: 'playwright-core' };
      } finally {
        await context?.close().catch(() => {});
        await browser?.close().catch(() => {});
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
  Object.assign(state.metrics, {
    considered: 0, runs: 0, successes: 0, failures: 0, skipped: 0, unavailable: 0,
    budgetRejected: 0, cacheHits: 0, promoted: 0, gainedKeys: 0, lostKeys: 0,
    totalElapsedMs: 0, lastElapsedMs: 0, lastStatus: 'NEVER', lastReason: '', lastRunAt: '',
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
      const rendered = await runtime.render(validated.url.toString(), { timeoutMs: timeoutMs(), maxHtmlChars: maxHtmlChars(), waitForSelector: options.waitForSelector });
      const html = String(rendered?.html || '').slice(0, maxHtmlChars());
      if (!html || wafLike(html)) throw new Error(html ? 'rendered-waf-detected' : 'rendered-html-empty');
      const extracted = await extractRendered(html);
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
        finalUrl: rendered.finalUrl || validated.url.toString(),
        status: Number(rendered.status || 200),
        cache: 'MISS',
      };
      record('OK', elapsed, '', comparison);
      cacheSet(key, { results: renderedResults, html, diagnostics });
      return { results: promoted ? mergeMissing(staticResults, renderedResults, selectors) : staticResults, candidateResults: renderedResults, renderedHtml: html, diagnostics };
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
    triggerPolicy: 'selectors-present-and-static-coverage-below-threshold-and-no-waf-and-budget-available',
    runtime: {
      package: 'playwright-core',
      optional: true,
      requiresBundledOrSystemChromiumOrCdp: true,
      cdpConfigured: Boolean(String(process.env.VALORAE_BROWSER_CDP_URL || '').trim()),
      executableConfigured: Boolean(String(process.env.VALORAE_BROWSER_EXECUTABLE_PATH || '').trim()),
    },
    safety: {
      mainDocumentHttpsOnly: true,
      mainDocumentAllowlist: [...configuredAllowedHosts()].sort(),
      privateNetworkBlocked: true,
      credentialsInUrlBlocked: true,
      imagesMediaFontsBlocked: true,
      subresourcesRestrictedToSameSiteOrExplicitAllowlist: true,
      wafResponsesNotRendered: true,
      pageJavaScriptExecutesOnlyInsideIsolatedBrowserContext: true,
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
    },
    endpoint: 'contract/dynamic-render',
  };
}
