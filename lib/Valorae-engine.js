// Valorae-engine.js
import { enrichAssetResults, buildSchemaValidation, augmentQualityReport, buildSourceReport, buildDebugInfo, VALORAE_SCHEMA_VERSION } from './quality/schema.js';
import { buildFieldConfidence } from './quality/confidence.js';
import { buildValoraeScore } from './quality/valorae-score.js';
import { applyPayloadView, resolvePayloadView } from './quality/views.js';
import { isProviderAvailable, recordProviderResult, getProviderHealthSnapshot, providerNameForHost, getProviderCooldown } from './resilience/circuit-breaker.js';
import { resolvePerformanceOptions, performanceCapabilities } from './performance/profile.js';
import { marketCacheStats } from './market/cache.js';
import { buildUniversalNormalized, normalizeDividendHistory } from './normalizers/universal.js';
import { buildAssetDataQualityMatrix, buildSourceReliabilityMatrix } from './quality/data-quality.js';
import { applyResilienceWarnings } from './parsers/resilience.js';
import { buildSchemaStability } from './contract/stability.js';
import { buildHtmlCacheKey, buildHtmlCacheFamilyKey } from './scrape/scrape-input.js';
import { scrapeResultCacheStats, clearScrapeResultCache } from './cache/scrape-result-cache.js';
import { coalesce, inflightStats } from './resilience/inflight.js';
import { classifyFetchOutcome, shouldRetryFetch } from './resilience/error-classifier.js';
import { buildChartReadinessReport } from './quality/chart-readiness.js';
import { buildNormalizedChartSeries } from './quality/chart-series.js';
import { buildPanelReadiness } from './quality/panel-readiness.js';
import { buildConsumerDiagnostics } from './quality/consumer-diagnostics.js';
import { buildAppConsumerPayload } from './quality/app-consumer-payload.js';
import { buildAppRenderContract } from './quality/app-render-contract.js';
import { buildAppDataContract } from './quality/app-data-contract.js';
import { buildAppSyncEnvelope } from './quality/app-sync-envelope.js';
import { buildAppMobileSnapshot } from './quality/app-mobile-snapshot.js';
import { buildAppResponseIntegrity } from './quality/app-response-integrity.js';
import { numberNormalizerStats, parseFinancialNumber, formatPercentLike } from './normalizers/numbers.js';
import { buildEngineProviderPlan, VALORAE_ENGINE_POLICY_VERSION } from './resilience/engine-policy.js';
import { buildEngineEfficiencyReport, buildEngineModuleTree, VALORAE_ENGINE_EFFICIENCY_VERSION } from './quality/engine-efficiency.js';
import { buildAssetClassContract, VALORAE_ASSET_CLASS_CONTRACT_VERSION } from './quality/asset-class-contract.js';
import { analyzeAssetIndicatorCoverage, VALORAE_ASSET_INDICATOR_TAXONOMY_VERSION } from './quality/asset-indicator-taxonomy.js';
import { buildEngineMaturityBooster, VALORAE_ENGINE_MATURITY_BOOSTER_VERSION } from './quality/engine-maturity-booster.js';
import { buildFieldConsistencyGuard, VALORAE_FIELD_CONSISTENCY_GUARD_VERSION } from './quality/field-consistency-guard.js';
import { buildPayloadBudget, VALORAE_PAYLOAD_BUDGET_VERSION } from './quality/payload-budget.js';
import { buildAssetActionPlan, VALORAE_ASSET_ACTION_PLAN_VERSION } from './quality/asset-action-plan.js';
import { createEngineRuntimeProfiler, VALORAE_ENGINE_RUNTIME_PROFILER_VERSION } from './quality/engine-runtime-profiler.js';
import { buildEngineLaunchGate, VALORAE_ENGINE_LAUNCH_GATE_VERSION } from './quality/engine-launch-gate.js';
import { getFailureCache, setFailureCache, clearFailureCache, failureCacheStats } from './resilience/failure-cache.js';
import { applyCanonicalReliabilityLayer, canonicalReliabilityCapabilities, VALORAE_CANONICAL_RELIABILITY_VERSION } from './canonical/cvm-reliability-layer.js';
import { buildInvestidor10CanonicalCharts, discoverInvestidor10ChartApiUrls, VALORAE_I10_CHART_EXTRACTOR_VERSION } from './market/investidor10-chart-extractor.js';
import { buildNativeRequestHeaders, conditionalValidatorHeaders, readTextLimited, responseValidators, retryDelayMs } from './http/native-adaptive-fetch.js';

// Motor novo do Valorae Proxy para Vercel/GitHub.
// Foco: dados públicos de ações/FIIs, diagnóstico claro, sem dados sintéticos.

export const VALORAE_ENGINE_VERSION = '21.12.0';
const VALORAE_ENGINE_ASSEMBLY_LEGACY_TAG = '21.12.32-launch-performance-optimizer';
const VALORAE_ENGINE_ASSEMBLY_COMPAT_TAG = '21.12.23-engine-assembly-sync';

const DEFAULT_TIMEOUT_MS = intEnv('VALORAE_FETCH_TIMEOUT_MS', 12000);
const DEFAULT_MAX_HTML_CHARS = intEnv('VALORAE_MAX_HTML_CHARS', 3_200_000);
const DEFAULT_NEWS_LIMIT = intEnv('VALORAE_NEWS_LIMIT', 8);
const NEWS_CACHE_TTL_MS = intEnv('VALORAE_NEWS_CACHE_TTL_MS', 15 * 60 * 1000);
const NEWS_CACHE_STALE_MS = intEnv('VALORAE_NEWS_CACHE_STALE_MS', 6 * 60 * 60 * 1000);
const NEWS_CACHE_MAX_ENTRIES = intEnv('VALORAE_NEWS_CACHE_MAX_ENTRIES', 150);
const VALORAE_NEWS_RELIABILITY_VERSION = '21.12.187-news-daily-newest-first-saved-proventos';
const HTML_CACHE_TTL_MS = intEnv('VALORAE_HTML_CACHE_TTL_MS', 2 * 60 * 1000);
const HTML_CACHE_STALE_MS = intEnv('VALORAE_HTML_CACHE_STALE_MS', 5 * 60 * 1000);
const HTML_CACHE_MAX_ENTRIES = intEnv('VALORAE_HTML_CACHE_MAX_ENTRIES', 200);
const ENABLE_INVESTIDOR10_INTERNAL_APIS = boolEnv('VALORAE_ENABLE_INTERNAL_APIS', true);
const USE_YAHOO_FOR_CURRENT_QUOTE = boolEnv('VALORAE_USE_YAHOO_FOR_CURRENT_QUOTE', true);
const VALORAE_CANONICAL_DATA_ENABLED = boolEnv('VALORAE_CANONICAL_DATA_ENABLED', true);

// Cache final do JSON, inspirado no Scraper (4), mas com chave versionada e bypass por nocache/refresh.
// Mantém velocidade em instâncias quentes sem repetir HTML+APIs internas para o mesmo ticker.
const ASSET_RESULT_CACHE_ENABLED = boolEnv('VALORAE_ASSET_RESULT_CACHE_ENABLED', true);
const ASSET_RESULT_CACHE_TTL_MS = intEnv('VALORAE_ASSET_RESULT_CACHE_TTL_MS', 5 * 60 * 1000);
const ASSET_RESULT_CACHE_MAX_ENTRIES = intEnv('VALORAE_ASSET_RESULT_CACHE_MAX_ENTRIES', 250);
const ASSET_RESULT_CACHE_MAX_BYTES = intEnv('VALORAE_ASSET_RESULT_CACHE_MAX_BYTES', 32 * 1024 * 1024);
const ASSET_RESULT_CACHE_STALE_MS = intEnv('VALORAE_ASSET_RESULT_CACHE_STALE_MS', 45 * 60 * 1000);


// Camada ValoraeScrape self-contained.
// Em produção, /api/asset chama o próprio /api/scrape do mesmo domínio,
// que retorna HTML + seletores. Não depende de serviço externo de scraping.
const ENV_VALORAE_SCRAPE_URL = (process.env.VALORAE_SCRAPE_URL || '').trim();
const VALORAE_SCRAPE_TIMEOUT_MS = intEnv('VALORAE_SCRAPE_TIMEOUT_MS', 12000);
const VALORAE_SCRAPE_RETRIES = intEnv('VALORAE_SCRAPE_RETRIES', 2);
const VALORAE_FAST_DIRECT_FALLBACK = boolEnv('VALORAE_FAST_DIRECT_FALLBACK', false);
const VALORAE_DIRECT_FETCH_RETRIES = intEnv('VALORAE_DIRECT_FETCH_RETRIES', 1);
const VALORAE_ADAPTIVE_COMPLETION_ENABLED = boolEnv('VALORAE_ADAPTIVE_COMPLETION_ENABLED', true);
const VALORAE_ADAPTIVE_COMPLETION_TIMEOUT_MS = intEnv('VALORAE_ADAPTIVE_COMPLETION_TIMEOUT_MS', 4500);
const VALORAE_COMPLETION_TARGET_KEYS_ACAO = intEnv('VALORAE_COMPLETION_TARGET_KEYS_ACAO', 10);
const VALORAE_COMPLETION_TARGET_KEYS_FII = intEnv('VALORAE_COMPLETION_TARGET_KEYS_FII', 8);
const VALORAE_BEST_SNAPSHOT_STALE_MS = intEnv('VALORAE_BEST_SNAPSHOT_STALE_MS', 6 * 60 * 60 * 1000);
const VALORAE_STATUSINVEST_COMPLEMENT_ENABLED = boolEnv('VALORAE_STATUSINVEST_COMPLEMENT_ENABLED', true);
const VALORAE_STATUSINVEST_COMPLEMENT_TIMEOUT_MS = intEnv('VALORAE_STATUSINVEST_COMPLEMENT_TIMEOUT_MS', 2800);
const VALORAE_HEDGED_STATUSINVEST_ENABLED = boolEnv('VALORAE_HEDGED_STATUSINVEST_ENABLED', true);
const VALORAE_BATCH_DEDUPE_ENABLED = boolEnv('VALORAE_BATCH_DEDUPE_ENABLED', true);
const VALORAE_LOW_LATENCY_BUDGET_MS = intEnv('VALORAE_LOW_LATENCY_BUDGET_MS', 1000);
const VALORAE_MIN_NETWORK_TIMEOUT_MS = intEnv('VALORAE_MIN_NETWORK_TIMEOUT_MS', 350);
const VALORAE_COMPLETENESS_THRESHOLD_ACAO = intEnv('VALORAE_COMPLETENESS_THRESHOLD_ACAO', 65);
const VALORAE_COMPLETENESS_THRESHOLD_FII = intEnv('VALORAE_COMPLETENESS_THRESHOLD_FII', 60);
const VALORAE_SCRAPE_CACHE_TTL_MS = intEnv('VALORAE_SCRAPE_CACHE_TTL_MS', 5 * 60 * 1000);
const VALORAE_SCRAPE_CLIENT_CACHE_MAX_ENTRIES = intEnv('VALORAE_SCRAPE_CLIENT_CACHE_MAX_ENTRIES', 40);
const VALORAE_SCRAPE_CLIENT_CACHE_MAX_BYTES = intEnv('VALORAE_SCRAPE_CLIENT_CACHE_MAX_BYTES', 16 * 1024 * 1024);

const valoraeScrapeResponseCache = new Map();
const valoraeScrapeInFlight = new Map();
let valoraeScrapeResponseCacheBytes = 0;


const ALLOWED_HOSTS = new Set([
  'investidor10.com.br',
  'www.investidor10.com.br',
  'statusinvest.com.br',
  'www.statusinvest.com.br',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'news.google.com',
  'dados.cvm.gov.br',
]);

const KNOWN_B3_UNITS = new Set([
  // Unidades B3: terminam em 11, mas são ações/units, não FIIs.
  // Manter esta lista local evita tratar automaticamente todo ticker 11 como FII.
  'ALUP11','BPAC11','BRBI11','ENGI11','KLBN11','SANB11','SAPR11','TAEE11','AESB11',
  'RNEW11','EQTL11','VIVT11','TIET11','RAPT11','PINE11','APER11','MODL11','SULA11','BIDI11','IGTI11','CPLE11','BBRK11','BRKM11',
  'CESP11','GNDI11','IGTI11','LIGT11','MGLU11','RDOR11','SIMH11','VTRU11'
]);

const ETF_TICKERS = new Set([
  'BOVA11','IVVB11','SMAL11','DIVO11','FIND11','MATB11','GOVE11','ISUS11','XFIX11','GOLD11','SPXI11',
  'HASH11','BOVB11','BOVS11','BRAX11','XINA11','EURP11','FIXA11','ECOO11','ACWI11','NASD11',
  'USTK11','NSDQ11','DEFI11','ESGE11','SUST11','AGRI11','IFRA11','BDIV11','BNDX11','BOVV11',
  'REIT11','TRET11','WRLD11','XBOV11','PIBB11','SMAC11','MOAT11','PORD11','GLDL11','BITI11',
  'SOLB11','TECC11','BITH11','COIN11','EMAG11','MCHI11','MAGO11','BLOK11','USIG11','SPAB11',
  'CRYP11','ESGB11','SEMI11','RNDP11','FIDC11','ARGT11','QBTC11','QETH11','WEB311','META11','B5P211','IRFM11','IB5M11','IMAB11','B5MB11','LFTS11','NTNS11','USDB11','QQQI11','TECK11','USAL11'
]);

const htmlCache = new Map();
const htmlCacheFamilies = new Map();
const htmlCacheMetrics = { hits: 0, familyHits: 0, misses: 0, staleHits: 0, sets: 0, evictions: 0, bypasses: 0, inflightJoins: 0, upgrades: 0 };
const newsCache = new Map();
const newsInFlight = new Map();
const newsCacheMetrics = { hits: 0, misses: 0, staleHits: 0, sets: 0, empty: 0, errors: 0, evictions: 0, inflightJoins: 0 };
const assetResultCache = new Map();
const assetResultInFlight = new Map();
const assetBestSnapshotCache = new Map();
let assetResultCacheBytes = 0;
const assetResultMetrics = { hits: 0, misses: 0, staleHits: 0, sets: 0, evictions: 0, inflightJoins: 0 };
const assetBestSnapshotMetrics = { hits: 0, misses: 0, sets: 0, hydrations: 0, evictions: 0 };


function intEnv(name, fallback) {
  const raw = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function boolEnv(name, fallback = false) {
  const raw = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  if (raw == null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(raw).toLowerCase());
}

function boundedTimeout(...values) {
  const numbers = values.map(Number).filter(n => Number.isFinite(n) && n > 0);
  const selected = numbers.length ? Math.min(...numbers) : DEFAULT_TIMEOUT_MS;
  return Math.max(VALORAE_MIN_NETWORK_TIMEOUT_MS, Math.floor(selected));
}

function isLowLatencyRequest(options = {}) {
  return options.lowLatencyBudget === true || (Number(options.timeoutMs || 0) > 0 && Number(options.timeoutMs) <= VALORAE_LOW_LATENCY_BUDGET_MS);
}

function shouldServeStaleWhileRevalidate(options = {}) {
  if (options.staleWhileRevalidate === false || options.refresh === true || options.nocache === true || options.bypassCache === true) return false;
  return options.staleWhileRevalidate === true || isLowLatencyRequest(options);
}

function nowIso() { return new Date().toISOString(); }
function safeText(v) { return typeof v === 'string' ? v : ''; }
function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }

function decodeHtml(input = '') {
  return String(input)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(input = '') {
  return decodeHtml(String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>|<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactText(input = '') {
  return stripTags(input).replace(/\s+/g, ' ').trim();
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function canonicalizeTicker(raw = '') {
  let ticker = String(raw || '').trim().toUpperCase();
  if (!ticker) return '';
  if (/^\^/.test(ticker) || /^[A-Z]{1,6}=X$/.test(ticker)) return ticker;
  ticker = ticker
    .replace(/^BVMF:/, '')
    .replace(/^BMFBOVESPA:/, '')
    .replace(/^B3:/, '')
    .replace(/\.SA$/, '')
    .replace(/-SA$/, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);
  if (/^(?:[A-Z]{4}[0-9]{1,2}|[A-Z0-9]{3,6}[0-9]{1,2})SA$/.test(ticker)) ticker = ticker.slice(0, -2);
  if (/^[A-Z]{4}[0-9]{1,2}F$/.test(ticker)) ticker = ticker.slice(0, -1);
  return ticker.slice(0, 12);
}

export function validarTicker(ticker = '') {
  const t = canonicalizeTicker(ticker);
  if (!t) return 'Ticker vazio';
  if (/^[\^]/.test(t)) return `Índices não são suportados neste endpoint: ${t}`;
  if (!/^(?:[A-Z]{4}\d{1,2}F?|[A-Z0-9]{3,6}\d{1,2}|[A-Z]{1,5})$/.test(t) || !/[A-Z]/.test(t)) return `Ticker inválido: ${t}`;
  return null;
}

export function isKnownB3Unit(ticker = '') {
  return KNOWN_B3_UNITS.has(canonicalizeTicker(ticker));
}

export function inferAssetType(ticker = '') {
  const t = canonicalizeTicker(ticker);
  if (ETF_TICKERS.has(t)) return 'ETF';
  if (KNOWN_B3_UNITS.has(t)) return 'ACAO';
  if (/^[A-Z]{4}3[0-9]$/.test(t)) return 'BDR';
  if (t.endsWith('11')) return 'FII';
  if (/^[A-Z]{1,5}$/.test(t)) return 'STOCK';
  return 'ACAO';
}

function investidor10Urls(ticker, type) {
  const t = canonicalizeTicker(ticker).toLowerCase();
  const urls = [];
  if (type === 'FII') urls.push(`https://investidor10.com.br/fiis/${t}/`);
  else if (type === 'ETF') urls.push(`https://investidor10.com.br/etfs/${t}/`);
  else if (type === 'BDR') urls.push(`https://investidor10.com.br/bdrs/${t}/`);
  else if (type === 'STOCK') urls.push(`https://investidor10.com.br/stocks/${t}/`);
  else urls.push(`https://investidor10.com.br/acoes/${t}/`);

  // Fallbacks defensivos para tickers que possam estar classificados diferente.
  if (type !== 'ACAO' && type !== 'ACAO_UNIT') urls.push(`https://investidor10.com.br/acoes/${t}/`);
  if (type !== 'FII' && t.endsWith('11') && !KNOWN_B3_UNITS.has(canonicalizeTicker(ticker))) urls.push(`https://investidor10.com.br/fiis/${t}/`);
  return uniq(urls);
}

function statusInvestUrls(ticker, type) {
  const t = canonicalizeTicker(ticker).toLowerCase();
  if (type === 'FII') return [`https://statusinvest.com.br/fundos-imobiliarios/${t}`];
  if (type === 'ETF') return [`https://statusinvest.com.br/etfs/${t}`];
  if (type === 'BDR') return [`https://statusinvest.com.br/bdrs/${t}`];
  return [`https://statusinvest.com.br/acoes/${t}`];
}

function browserHeaders(url) {
  return buildNativeRequestHeaders(url, {}, { profile: process.env.VALORAE_HTTP_CLIENT_PROFILE || 'desktop' });
}


const INVESTIDOR10_SELECTORS = {
  cards: { selector: '._card-header, ._card-body' },
  cells_titles: { selector: '.cell span.d-flex, .cell span.title' },
  cells_values: { selector: '.cell .value' },
  table: { selector: 'table tbody tr td' },
  about: { selector: '.description-text, .content--description, .description p, .link-card--description, .text-description p' },
  logo: { selector: '.header-company img, #header-container img, .logo img, .img-logo', extract: 'src' },
  compareUrl: { selector: '#table-compare-tickers, #table-compare-segments, #table-compare-fiis, [data-url*="comparador"]', extract: 'data-url' },
  props: { selector: 'div.card-propertie h3, div.card-property h3' },
  propsSmall: { selector: 'div.card-propertie small, div.card-property small' }
};


function matchBlocksByClass(html, classNeedles, tag = '[a-z0-9]+', limit = 200) {
  const out = [];
  const source = String(html || '');
  const re = new RegExp(`<(${tag})\\b[^>]*class=["'][^"']*(?:${classNeedles.map(escapeRe).join('|')})[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
  let m;
  while ((m = re.exec(source)) && out.length < limit) out.push(m[0]);
  return out;
}

function extractAttr(fragment, attrName) {
  const re = new RegExp(`${escapeRe(attrName)}=["']([^"']+)["']`, 'i');
  return fragment.match(re)?.[1] || '';
}

function extractInvestidor10SelectorResults(html, url = '') {
  const source = String(html || '');
  const results = {
    cards: [],
    cells_titles: [],
    cells_values: [],
    table: [],
    about: [],
    logo: [],
    compareUrl: [],
    props: [],
    propsSmall: [],
  };

  for (const block of matchBlocksByClass(source, ['_card-header', '_card-body'], '[a-z0-9]+', 120)) {
    const txt = compactText(block);
    if (txt) results.cards.push(txt);
  }

  const cellBlocks = matchBlocksByClass(source, ['cell'], 'div', 300);
  for (const cell of cellBlocks) {
    const title =
      compactText(cell.match(/<span\b[^>]*class=["'][^"']*(?:d-flex|title|name)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '') ||
      compactText(cell.match(/<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    const value =
      compactText(cell.match(/<div\b[^>]*class=["'][^"']*(?:value|simple-value)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '') ||
      compactText(cell.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1] || '');
    if (title) results.cells_titles.push(title);
    if (title) results.cells_values.push(value || '');
  }

  const tdRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  let td;
  while ((td = tdRe.exec(source)) && results.table.length < 1200) {
    const txt = compactText(td[1]);
    if (txt) results.table.push(txt);
  }

  const aboutBlocks = [];
  aboutBlocks.push(...matchBlocksByClass(source, ['description-text', 'content--description', 'link-card--description', 'text-description'], '[a-z0-9]+', 20));
  const metaDesc = source.match(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']+)["']/i)?.[1];
  for (const block of aboutBlocks) {
    const txt = compactText(block);
    if (txt && txt.length > 30) results.about.push(txt);
  }
  if (metaDesc && !results.about.length) results.about.push(decodeHtml(metaDesc));

  const imgRe = /<img\b[^>]*(?:class=["'][^"']*(?:logo|img-logo)[^"']*["'][^>]*|alt=["'][^"']*(?:logo|PETR|GARE|VISC|empresa|fundo)[^"']*["'][^>]*)>/gi;
  let img;
  while ((img = imgRe.exec(source)) && results.logo.length < 5) {
    const src = extractAttr(img[0], 'src') || extractAttr(img[0], 'data-src');
    if (src) results.logo.push(src.startsWith('/') ? `https://investidor10.com.br${src}` : src);
  }

  const dataUrlRe = /data-url=["']([^"']*(?:comparador|compare)[^"']*)["']/gi;
  let du;
  while ((du = dataUrlRe.exec(source)) && results.compareUrl.length < 20) results.compareUrl.push(decodeHtml(du[1]));

  const propertyBlocks = matchBlocksByClass(source, ['card-propertie', 'card-property'], 'div', 300);
  for (const block of propertyBlocks) {
    const h3 = compactText(block.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '');
    if (h3) results.props.push(h3);
    const smallRe = /<small\b[^>]*>([\s\S]*?)<\/small>/gi;
    let sm;
    while ((sm = smallRe.exec(block)) && results.propsSmall.length < 600) {
      const txt = compactText(sm[1]);
      if (txt) results.propsSmall.push(txt);
    }
  }

  for (const key of Object.keys(results)) {
    if (!results[key].length) delete results[key];
  }
  return results;
}

function getValoraeScrapeUrl(options = {}) {
  return String(options.valoraeScrapeUrl || options.scrapeUrl || ENV_VALORAE_SCRAPE_URL || '').trim();
}

function isValoraeScrapeEnabled(options = {}) {
  return boolEnv('VALORAE_SCRAPE_ENABLED', true) && !!getValoraeScrapeUrl(options);
}

function cleanHeaderMap(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {};
  const output = {};
  for (const key of Object.keys(headers).sort()) {
    const value = headers[key];
    if (!key || value === undefined || value === null) continue;
    output[key] = String(value);
  }
  return output;
}

function stableStringify(value) {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function deepClone(value) {
  if (value === undefined || value === null) return value;
  try { return structuredClone(value); } catch (_) {
    try { return JSON.parse(JSON.stringify(value)); } catch (__) { return value; }
  }
}

function cloneAndMeasureJson(value) {
  if (value === undefined || value === null) return { value, bytes: 0, strategy: 'empty' };
  try {
    const json = JSON.stringify(value);
    return { value: JSON.parse(json), bytes: Buffer.byteLength(json, 'utf8'), strategy: 'single-json-pass' };
  } catch (_) {
    const cloned = deepClone(value);
    let bytes = 0;
    try { bytes = Buffer.byteLength(JSON.stringify(cloned), 'utf8'); } catch (__) { bytes = 0; }
    return { value: cloned, bytes, strategy: 'clone-fallback' };
  }
}

function resolveChartSeriesLimit(options = {}) {
  const explicit = Number(options.maxChartSeries || options.chartSeriesLimit);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.min(32, Math.floor(explicit)));
  const resolvedView = resolvePayloadView(options.view || 'full').resolved;
  const profile = String(options.performanceProfile || options.profile || '').toLowerCase();
  if (profile === 'instant') return 4;
  if (resolvedView === 'compact' || profile === 'fast' || profile === 'portfolio') return 6;
  if (profile === 'deep') return 12;
  return 8;
}

const ENGINE_ASSEMBLY_PLAN_CACHE = new Map();

function resolveEngineAssemblyPlan(options = {}) {
  const viewResolution = resolvePayloadView(options.view || 'full');
  const resolvedView = viewResolution.resolved;
  const profile = String(options.performanceProfile || options.profile || 'standard').toLowerCase();
  const debug = options.debug === true || options.debug === '1';
  const requestedContracts = String(options.contracts || options.contractMode || '').toLowerCase();
  const forceFullContracts = debug || requestedContracts === 'full' || requestedContracts === 'complete' || options.fullContracts === true;
  const forceLiteContracts = requestedContracts === 'lite' || requestedContracts === 'light' || options.liteContracts === true;
  const lowLatencyProfile = ['instant', 'fast', 'portfolio'].includes(profile);
  const appOptimized = !forceFullContracts && resolvedView === 'app';
  const mobileOptimized = !forceFullContracts && (forceLiteContracts || resolvedView === 'compact' || appOptimized || lowLatencyProfile);
  const standardOptimized = !forceFullContracts && !mobileOptimized && resolvedView === 'standard';
  const mode = forceFullContracts ? 'full-audit' : appOptimized ? 'app-production-optimized' : mobileOptimized ? 'mobile-optimized' : standardOptimized ? 'standard-balanced' : 'full';
  const cacheKey = `${viewResolution.resolved}|${profile}|${forceFullContracts ? 'full' : forceLiteContracts ? 'lite' : 'auto'}|${debug ? 'debug' : 'nodebug'}`;
  const cached = ENGINE_ASSEMBLY_PLAN_CACHE.get(cacheKey);
  if (cached) return cached;
  const plan = {
    version: '21.12.32-launch-performance-optimizer',
    mode,
    requestedView: viewResolution.requested,
    resolvedView,
    profile,
    lowLatencyProfile,
    forceFullContracts,
    forceLiteContracts,
    buildSchemaAudit: !mobileOptimized && !appOptimized,
    buildHeavyQualityMatrices: forceFullContracts || resolvedView === 'full',
    buildChartReadiness: !mobileOptimized,
    buildConsumerDiagnostics: !mobileOptimized,
    buildFullRenderContract: !mobileOptimized,
    buildDebugInfo: debug,
    appRootsAlwaysBuilt: ['appPayload', 'appSyncEnvelope', 'appMobileSnapshot', 'appResponseIntegrity'],
    skippedRootsWhenMobileOptimized: mobileOptimized ? ['chartReadiness', 'consumerDiagnostics.full', 'appRenderContract.full', 'dataQualityMatrix', 'sourceReliability', appOptimized ? 'public-debug-roots-before-view=app' : undefined].filter(Boolean) : [],
    efficiencyPolicy: 'view-aware-contracts+app-production-view+stable-cache-key+single-runtime-snapshot+indicator-taxonomy+maturity-booster+runtime-profiler+launch-gate',
  };
  ENGINE_ASSEMBLY_PLAN_CACHE.set(cacheKey, plan);
  if (ENGINE_ASSEMBLY_PLAN_CACHE.size > 48) ENGINE_ASSEMBLY_PLAN_CACHE.delete(ENGINE_ASSEMBLY_PLAN_CACHE.keys().next().value);
  return plan;
}

function buildLiteConsumerDiagnostics(payload = {}) {
  const sourcesTried = Array.isArray(payload.metrics?.sourcesTried) ? payload.metrics.sourcesTried : [];
  const okSources = sourcesTried.filter(s => s?.ok || (Number(s?.status || 0) >= 200 && Number(s?.status || 0) < 400));
  const blockedAttempts = sourcesTried.filter(s => [401, 403, 429].includes(Number(s?.status || 0)) || s?.blocked).length;
  const normalizedCount = Object.keys(payload.normalized || {}).filter(k => k !== '_meta').length;
  const chartCount = Array.isArray(payload.chartSeries?.series) ? payload.chartSeries.series.length : 0;
  const metricScore = Math.min(60, normalizedCount * 6);
  const chartScore = chartCount ? 15 : 0;
  const sourceScore = okSources.length ? 20 : 0;
  const penalty = blockedAttempts * 8;
  return {
    version: '21.12.23-lite-consumer-diagnostics',
    mode: 'lite',
    primarySource: payload.sourceReport?.primarySource || payload.metrics?.source || null,
    sourcesUsed: payload.sourceReport?.sourcesUsed || okSources.map(s => s.provider || s.source || s.url).filter(Boolean),
    sourceAttempts: {
      total: sourcesTried.length,
      ok: okSources.length,
      blockedAttempts,
      failed: Math.max(0, sourcesTried.length - okSources.length),
    },
    captureScore: Math.max(0, Math.min(100, Math.round(metricScore + chartScore + sourceScore - penalty))),
    dataMap: {
      normalizedFields: normalizedCount,
      chartSeriesReady: chartCount > 0,
      dividendStatsReady: Boolean(payload.dividendStats),
      appPayloadReady: Boolean(payload.appPayload),
    },
    priorityPaths: ['appMobileSnapshot', 'appPayload', 'normalized', 'results'],
    appContract: {
      partialDataBanner: Boolean(payload.partial || blockedAttempts),
      recommendedRoot: 'appMobileSnapshot',
      fallbackRoot: 'appPayload',
    },
  };
}

function buildLiteAppRenderContract(payload = {}) {
  const panels = Array.isArray(payload.appPayload?.panels) ? payload.appPayload.panels : [];
  const panelByKey = Object.fromEntries(panels.map(p => [p.key, p]));
  const metricCount = Number(payload.appPayload?.metrics?.count || Object.keys(payload.appPayload?.metrics?.canonical || {}).length || 0);
  const charts = Array.isArray(payload.appPayload?.charts?.series) ? payload.appPayload.charts.series : [];
  const card = (key, label, primaryPath, readyFallback = false) => {
    const p = panelByKey[key] || {};
    const ready = Boolean(p.ready || readyFallback);
    return {
      key,
      label,
      state: ready ? 'ready' : metricCount ? 'partial' : 'empty',
      primaryPath,
      fallbackPaths: ['appPayload.metrics.canonical', 'normalized', 'results'],
      renderHint: ready ? 'render' : metricCount ? 'render_partial' : 'keep_previous_or_empty_state',
    };
  };
  const chartTemplates = charts.slice(0, 4).map((s, index) => ({
    id: s.key || `series-${index + 1}`,
    title: s.label || s.name || s.key || `Série ${index + 1}`,
    kind: s.type === 'ohlc' ? 'candlestick' : 'line',
    pointCount: Number(s.pointCount || (Array.isArray(s.points) ? s.points.length : 0)),
    dataPath: `appPayload.charts.series.${index}.points`,
    safeForMainChart: Number(s.pointCount || (Array.isArray(s.points) ? s.points.length : 0)) >= 2,
  }));
  return {
    version: '21.12.23-lite-app-render-contract',
    mode: 'lite-mobile-synced',
    generatedAt: payload.metrics?.generatedAt || new Date().toISOString(),
    ticker: payload.ticker,
    type: payload.type,
    renderState: metricCount >= 2 || charts.length ? 'partial' : 'empty',
    cards: [
      card('quote', 'Cotação', 'appPayload.quote', Boolean(payload.appPayload?.quote?.price || payload.appPayload?.quote?.priceDisplay)),
      card('fundamentals', 'Fundamentos', 'appPayload.metrics.canonical', metricCount >= 3),
      card('charts', 'Gráficos', 'appPayload.charts.series', charts.length > 0),
      card('sourceTrace', 'Fonte/cache', 'appPayload.source', Boolean(payload.appPayload?.source?.primary)),
    ],
    metricGroups: [{ key: 'compact', title: 'Métricas principais', path: 'appPayload.metrics.canonical', metricCount }],
    chartTemplates,
    consistency: { ok: true, issueCount: 0, issues: [], mode: 'lite' },
    offlinePolicy: {
      keepPreviousOnPartial: true,
      preferredFirstPaintRoot: 'appMobileSnapshot',
      hydrateFrom: ['appPayload', 'normalized', 'results'],
    },
  };
}

function assetResultCacheEnabled(options = {}) {
  if (!ASSET_RESULT_CACHE_ENABLED) return false;
  if (options.cache === false || options.bypassCache === true || options.refresh === true || options.nocache === true) return false;
  return true;
}

function assetResultCacheKey(ticker, type, options = {}) {
  return stableStringify({
    v: VALORAE_ENGINE_VERSION,
    ticker: canonicalizeTicker(ticker),
    type: String(type || inferAssetType(ticker)).toUpperCase(),
    mode: options.mode || 'super',
    includeNews: options.includeNews === true || options.includeNews === '1',
    newsLimit: Number(options.newsLimit || DEFAULT_NEWS_LIMIT),
    yahoo: options.useYahooFallback !== false,
    maxHtmlChars: Number(options.maxHtmlChars || DEFAULT_MAX_HTML_CHARS),
    profile: options.performanceProfile || options.profile || 'standard',
    adaptiveCompletion: options.adaptiveCompletion !== false,
    complete: options.complete === true || options.complete === '1',
    statusInvestComplement: options.statusInvestComplement !== false,
    snapshotFallback: options.useBestSnapshotFallback !== false && options.snapshotFallback !== false,
    returnHtml: options.returnHtml !== false,
    internalApis: ENABLE_INVESTIDOR10_INTERNAL_APIS && options.enableInternalApis !== false,
    view: options.view || 'full'
  });
}

function assetResultCacheTouch(key, entry) {
  assetResultCache.delete(key);
  assetResultCache.set(key, entry);
}

function assetResultCacheDelete(key) {
  const entry = assetResultCache.get(key);
  if (!entry) return;
  assetResultCacheBytes = Math.max(0, assetResultCacheBytes - entry.bytes);
  assetResultCache.delete(key);
}

function assetResultCacheGet(key, options = {}) {
  const entry = assetResultCache.get(key);
  if (!entry) { assetResultMetrics.misses += 1; return null; }
  const now = Date.now();
  const expired = now > entry.expiresAt;
  const staleStillUsable = now <= (entry.staleUntil || entry.expiresAt);
  const staleAllowed = options.allowStale === true && staleStillUsable;
  if (expired && !staleAllowed) {
    // Não apaga uma entrada que ainda está dentro da janela stale; isso permite
    // stale-if-error e stale-while-revalidate reais na chamada seguinte.
    if (!staleStillUsable) assetResultCacheDelete(key);
    assetResultMetrics.misses += 1;
    return null;
  }
  assetResultCacheTouch(key, entry);
  const cloned = deepClone(entry.data);
  if (expired) { cloned.__cacheStale = true; assetResultMetrics.staleHits += 1; }
  else assetResultMetrics.hits += 1;
  return cloned;
}

function assetResultCacheSet(key, data, ttlMs = ASSET_RESULT_CACHE_TTL_MS, staleMs = ASSET_RESULT_CACHE_STALE_MS) {
  if (!data || ttlMs <= 0) return;
  const packed = cloneAndMeasureJson(data);
  const cloned = packed.value;
  const bytes = packed.bytes;
  if (!cloned || bytes <= 0 || bytes > ASSET_RESULT_CACHE_MAX_BYTES) return;
  assetResultCacheDelete(key);
  while (
    assetResultCache.size >= ASSET_RESULT_CACHE_MAX_ENTRIES ||
    assetResultCacheBytes + bytes > ASSET_RESULT_CACHE_MAX_BYTES
  ) {
    const oldest = assetResultCache.keys().next().value;
    if (!oldest) break;
    assetResultCacheDelete(oldest);
    assetResultMetrics.evictions += 1;
  }
  const expiresAt = Date.now() + ttlMs;
  assetResultCache.set(key, { data: cloned, bytes, expiresAt, staleUntil: expiresAt + Math.max(0, staleMs) });
  assetResultCacheBytes += bytes;
  assetResultMetrics.sets += 1;
}

function usefulResultKeys(results = {}) {
  return Object.keys(results || {}).filter(k => {
    if (k === 'sections') return false;
    const v = results[k];
    return v !== undefined && v !== null && v !== '';
  });
}

function completionTargetKeys(type) {
  return String(type || '').toUpperCase() === 'FII' ? VALORAE_COMPLETION_TARGET_KEYS_FII : VALORAE_COMPLETION_TARGET_KEYS_ACAO;
}


const EXTRACTION_CRITICAL_FIELDS = Object.freeze({
  ACAO: ['precoAtual', 'variacaoDay', 'dividendYield', 'pl', 'pvp', 'roe', 'roic', 'valorDeMercado', 'liquidezDiaria', 'sobre'],
  FII: ['precoAtual', 'variacaoDay', 'dividendYield', 'pvp', 'valorPatrimonial', 'numeroCotistas', 'ultimoRendimento', 'sobre'],
  ETF: ['precoAtual', 'variacaoDay', 'dividendYield', 'pvp', 'valorPatrimonial', 'sobre'],
  STOCK: ['precoAtual', 'variacaoDay', 'nome', 'sobre'],
  BDR: ['precoAtual', 'variacaoDay', 'nome', 'sobre'],
});

function hasUsefulValue(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function extractionCriticalFields(type) {
  const t = String(type || '').toUpperCase();
  return EXTRACTION_CRITICAL_FIELDS[t] || EXTRACTION_CRITICAL_FIELDS.ACAO;
}

function buildExtractionCompletenessReport(type, results = {}) {
  const targetKeys = completionTargetKeys(type);
  const foundKeys = usefulResultKeys(results).length;
  const criticalFields = extractionCriticalFields(type);
  const presentCriticalFields = criticalFields.filter(k => hasUsefulValue(results?.[k]));
  const sections = results?.sections || {};
  const sectionKeys = Object.entries(sections).filter(([, value]) => hasUsefulValue(value)).map(([key]) => key);
  const criticalScore = criticalFields.length ? (presentCriticalFields.length / criticalFields.length) * 70 : 70;
  const richnessScore = Math.min(25, (foundKeys / Math.max(1, targetKeys)) * 25);
  const sectionScore = Math.min(5, sectionKeys.length * 1.25);
  const score = Math.round(Math.min(100, criticalScore + richnessScore + sectionScore));
  const threshold = String(type || '').toUpperCase() === 'FII' ? VALORAE_COMPLETENESS_THRESHOLD_FII : VALORAE_COMPLETENESS_THRESHOLD_ACAO;
  return {
    version: '21.12.52-news-reliability-upgrade',
    score,
    threshold,
    complete: score >= threshold || (foundKeys >= targetKeys && presentCriticalFields.length >= Math.max(2, Math.ceil(criticalFields.length * 0.35))),
    targetKeys,
    foundKeys,
    criticalFields,
    presentCriticalFields,
    missingCriticalFields: criticalFields.filter(k => !presentCriticalFields.includes(k)),
    sectionKeys,
  };
}

function isExtractionCompleteEnough(type, results = {}) {
  return buildExtractionCompletenessReport(type, results).complete;
}

function needsAdaptiveCompletion(type, parse, options = {}) {
  if (!VALORAE_ADAPTIVE_COMPLETION_ENABLED || options.adaptiveCompletion === false) return false;
  const profile = String(options.performanceProfile || options.profile || '').toLowerCase();
  if (profile === 'instant' && options.complete !== true) return false;
  if (!parse) return true;
  const report = buildExtractionCompletenessReport(type, parse.results || {});
  return parse.selectorOnly || !report.complete || report.foundKeys < completionTargetKeys(type);
}

async function tryAdaptiveHtmlCompletion(ticker, type, urls = [], currentParse, options = {}) {
  if (!needsAdaptiveCompletion(type, currentParse, options)) {
    return { attempted: false, parse: currentParse, fetch: null, report: { attempted: false, reason: 'not-needed' } };
  }
  const beforeKeys = usefulResultKeys(currentParse?.results || {}).length;
  const beforeCompleteness = buildExtractionCompletenessReport(type, currentParse?.results || {});
  const targetKeys = completionTargetKeys(type);
  const timeoutMs = boundedTimeout(
    options.timeoutMs || DEFAULT_TIMEOUT_MS,
    options.adaptiveCompletionTimeoutMs || VALORAE_ADAPTIVE_COMPLETION_TIMEOUT_MS
  );
  const maxChars = Math.min(
    Number(process.env.VALORAE_MAX_HTML_HARD_LIMIT || 4_500_000),
    Math.max(Number(options.maxHtmlChars || 0), String(type || '').toUpperCase() === 'FII' ? 1_600_000 : 2_200_000)
  );
  const attempts = [];
  for (const url of urls.filter(Boolean).slice(0, 2)) {
    const fetched = await fetchPublicHtml(url, {
      ...options,
      provider: 'direct',
      timeoutMs,
      maxChars,
      returnHtml: true,
      includeScripts: true,
      cache: options.cache !== false,
    });
    attempts.push({ url, ok: fetched.ok, status: fetched.status, provider: fetched.provider, cache: fetched.cache, htmlLength: fetched.htmlLength, error: fetched.error });
    if (!fetched.ok || !fetched.html) continue;
    const htmlParse = parseInvestidor10Html(ticker, type, fetched.html, fetched.finalUrl || url);
    const selectorParse = parseSelectorResults(ticker, type, fetched.selectorResults || {});
    const currentResults = currentParse?.results || {};
    const mergedResults = mergeParsedResults(currentResults, mergeParsedResults(selectorParse.results, htmlParse.results));
    const foundKeys = usefulResultKeys(mergedResults);
    const improved = !currentParse || foundKeys.length > beforeKeys;
    if (improved || foundKeys.length >= targetKeys) {
      return {
        attempted: true,
        parse: {
          ...htmlParse,
          selectorOnly: false,
          results: mergedResults,
          foundKeys,
          sourceUrl: fetched.finalUrl || url,
        },
        fetch: fetched,
        report: {
          attempted: true,
          ok: true,
          reason: 'fast-extraction-was-incomplete',
          beforeKeys,
          afterKeys: foundKeys.length,
          targetKeys,
          beforeCompleteness,
          afterCompleteness: buildExtractionCompletenessReport(type, mergedResults),
          timeoutMs,
          maxChars,
          attempts,
        }
      };
    }
  }
  return {
    attempted: true,
    parse: currentParse,
    fetch: null,
    report: {
      attempted: true,
      ok: false,
      reason: 'completion-source-unavailable',
      beforeKeys,
      afterKeys: beforeKeys,
      targetKeys,
      beforeCompleteness,
      afterCompleteness: buildExtractionCompletenessReport(type, currentParse?.results || {}),
      timeoutMs,
      maxChars,
      attempts,
    }
  };
}


function mergeOnlyMissingResults(current = {}, complement = {}) {
  const out = { ...(current || {}) };
  const usedKeys = [];
  for (const [key, value] of Object.entries(complement || {})) {
    if (!hasUsefulValue(value)) continue;
    if (key === 'sections') {
      const before = out.sections || {};
      const merged = mergeSectionsDeep(before, value);
      if (JSON.stringify(merged) !== JSON.stringify(before)) usedKeys.push('sections');
      out.sections = merged;
      continue;
    }
    if (!hasUsefulValue(out[key])) {
      out[key] = deepClone(value);
      usedKeys.push(key);
    }
  }
  return { results: out, usedKeys };
}


function shouldHedgeStatusInvest(options = {}) {
  if (!VALORAE_HEDGED_STATUSINVEST_ENABLED) return false;
  if (options.statusInvestComplement === false || options.hedgedStatusInvest === false) return false;
  const profile = String(options.performanceProfile || options.profile || '').toLowerCase();
  return ['turbo', 'deep'].includes(profile) || options.complete === true || options.complete === '1';
}

async function fetchStatusInvestComplementHtml(ticker, type, options = {}) {
  if (!shouldHedgeStatusInvest(options)) return null;
  if (!isProviderAvailable('StatusInvest')) {
    const health = getProviderHealthSnapshot().StatusInvest;
    return { ok: false, skipped: true, provider: 'CircuitBreaker', status: 0, error: 'StatusInvest em cooldown', cooldownUntil: health?.cooldownUntil, hedged: true };
  }
  const timeoutMs = boundedTimeout(
    options.timeoutMs || DEFAULT_TIMEOUT_MS,
    options.statusInvestTimeoutMs || VALORAE_STATUSINVEST_COMPLEMENT_TIMEOUT_MS,
    options.adaptiveCompletionTimeoutMs || VALORAE_ADAPTIVE_COMPLETION_TIMEOUT_MS
  );
  const maxChars = Math.min(Number(options.maxHtmlChars || DEFAULT_MAX_HTML_CHARS), 1_500_000);
  const url = statusInvestUrls(ticker, type)[0];
  if (!url) return null;
  const fetched = await fetchPublicHtml(url, {
    ...options,
    provider: 'direct',
    timeoutMs,
    maxChars,
    returnHtml: true,
    includeScripts: false,
    cache: options.cache !== false,
  });
  recordProviderResult('StatusInvest', fetched.ok, { status: fetched.status, blocked: fetched.blocked, error: fetched.error });
  return { ...fetched, hedged: true, timeoutMs, maxChars, url: fetched.url || url };
}


function mergeStatusInvestPrimaryForAnalysis(current = {}, statusResults = {}, type = '') {
  const out = { ...(current || {}) };
  const usedKeys = [];
  const analysisKeys = type === 'FII'
    ? ['precoAtual','variacao12m','dividendYield','yield12m','pvp','liquidezDiaria','ultimoRendimento','valorPatrimonial','valorPatrimonialTotal','patrimonioLiquido','numeroCotistas','cotasEmitidas','vacanciaFisica','vacanciaFinanceira']
    : ['precoAtual','variacao12m','dividendYield','pl','psr','pvp','payout','margemLiquida','margemBruta','margemEbit','margemEbitda','evEbitda','evEbit','pEbitda','pEbit','pAtivo','pCapGiro','pAtivoCircLiq','vpa','valorPatrimonial','lpa','giroAtivos','roe','roic','roa','dividaLiquidaPatrimonio','dividaLiquidaEbitda','dividaLiquidaEbit','dividaBrutaPatrimonio','patrimonioAtivos','passivosAtivos','liquidezCorrente','cagrReceitas5a','cagrLucros5a','liquidezMediaDiaria','tagAlong'];
  for (const key of analysisKeys) {
    if (hasUsefulValue(statusResults[key])) {
      out[key] = deepClone(statusResults[key]);
      usedKeys.push(key);
    }
  }
  out.sections = mergeSectionsDeep(out.sections || {}, statusResults.sections || {});
  out.analysisSourcePriority = ['StatusInvest', 'Investidor10', 'YahooChart'];
  out.analysisPrimarySource = usedKeys.length ? 'StatusInvest' : (out.analysisPrimarySource || 'Investidor10');
  out.analysisStatusInvestFields = [...new Set([...(out.analysisStatusInvestFields || []), ...usedKeys])];
  return { results: out, usedKeys };
}

async function tryStatusInvestComplement(ticker, type, currentResults = {}, options = {}, prefetchedFetch = null) {
  if (!VALORAE_STATUSINVEST_COMPLEMENT_ENABLED || options.statusInvestComplement === false) {
    return { results: currentResults, fetch: null, usedKeys: [], report: { attempted: false, reason: 'disabled' } };
  }
  const beforeCompleteness = buildExtractionCompletenessReport(type, currentResults || {});
  if (beforeCompleteness.complete && beforeCompleteness.foundKeys >= beforeCompleteness.targetKeys) {
    return { results: currentResults, fetch: null, usedKeys: [], report: { attempted: false, reason: 'already-complete', beforeCompleteness } };
  }
  if (!isProviderAvailable('StatusInvest')) {
    const health = getProviderHealthSnapshot().StatusInvest;
    return { results: currentResults, fetch: null, usedKeys: [], report: { attempted: true, ok: false, reason: 'statusinvest-cooldown', beforeCompleteness, cooldownUntil: health?.cooldownUntil } };
  }
  const timeoutMs = boundedTimeout(
    options.timeoutMs || DEFAULT_TIMEOUT_MS,
    options.statusInvestTimeoutMs || VALORAE_STATUSINVEST_COMPLEMENT_TIMEOUT_MS,
    options.adaptiveCompletionTimeoutMs || VALORAE_ADAPTIVE_COMPLETION_TIMEOUT_MS
  );
  const maxChars = Math.min(Number(options.maxHtmlChars || DEFAULT_MAX_HTML_CHARS), 1_500_000);
  const attempts = [];
  const urls = statusInvestUrls(ticker, type).slice(0, 1);
  const candidates = [];
  if (prefetchedFetch) candidates.push({ url: prefetchedFetch.finalUrl || prefetchedFetch.url || urls[0], fetched: prefetchedFetch, prefetched: true });
  for (const url of urls) {
    const alreadyPrefetched = prefetchedFetch && String(prefetchedFetch.finalUrl || prefetchedFetch.url || '').includes(new URL(url).hostname);
    if (!alreadyPrefetched) candidates.push({ url, fetched: null, prefetched: false });
  }
  for (const candidate of candidates) {
    const url = candidate.url;
    const fetched = candidate.fetched || await fetchPublicHtml(url, {
      ...options,
      provider: 'direct',
      timeoutMs,
      maxChars,
      returnHtml: true,
      includeScripts: false,
      cache: options.cache !== false,
    });
    if (!candidate.prefetched) recordProviderResult('StatusInvest', fetched.ok, { status: fetched.status, blocked: fetched.blocked, error: fetched.error });
    attempts.push({ url, ok: fetched.ok, status: fetched.status, provider: fetched.provider, cache: fetched.cache, htmlLength: fetched.htmlLength, error: fetched.error, prefetched: Boolean(candidate.prefetched || fetched.hedged) });
    if (!fetched.ok || !fetched.html) continue;
    const parsed = parseInvestidor10Html(ticker, type, fetched.html, fetched.finalUrl || url);
    const complement = postProcessResultsByType(ticker, type, parsed.results || {});
    const merged = mergeOnlyMissingResults(currentResults, complement);
    const afterCompleteness = buildExtractionCompletenessReport(type, merged.results);
    if (merged.usedKeys.length || afterCompleteness.score > beforeCompleteness.score) {
      return {
        results: merged.results,
        fetch: fetched,
        usedKeys: merged.usedKeys,
        report: { attempted: true, ok: true, reason: 'filled-missing-fields', beforeCompleteness, afterCompleteness, timeoutMs, maxChars, attempts },
      };
    }
  }
  return {
    results: currentResults,
    fetch: null,
    usedKeys: [],
    report: { attempted: true, ok: false, reason: 'no-complement-gain', beforeCompleteness, afterCompleteness: buildExtractionCompletenessReport(type, currentResults || {}), timeoutMs, maxChars, attempts },
  };
}

function assetBestSnapshotKey(ticker, type) {
  return `${canonicalizeTicker(ticker)}:${String(type || inferAssetType(ticker)).toUpperCase()}`;
}

function assetSnapshotScore(snapshot = {}) {
  const keys = usefulResultKeys(snapshot.results || {}).length;
  const quality = Number(snapshot.qualityScore || 0);
  const okBonus = snapshot.status === 'OK' ? 30 : 0;
  return keys * 3 + quality + okBonus;
}

function assetBestSnapshotGet(ticker, type) {
  const key = assetBestSnapshotKey(ticker, type);
  const entry = assetBestSnapshotCache.get(key);
  if (!entry) { assetBestSnapshotMetrics.misses += 1; return null; }
  if (Date.now() > entry.expiresAt) {
    assetBestSnapshotCache.delete(key);
    assetBestSnapshotMetrics.evictions += 1;
    assetBestSnapshotMetrics.misses += 1;
    return null;
  }
  assetBestSnapshotCache.delete(key);
  assetBestSnapshotCache.set(key, entry);
  assetBestSnapshotMetrics.hits += 1;
  return deepClone(entry.snapshot);
}

function assetBestSnapshotSet(ticker, type, payload = {}) {
  if (payload.metrics?.extractionCompleteness?.bestSnapshotHydration?.used && (!payload.metrics?.source || payload.metrics.source === 'None')) return false;
  const results = payload.results || {};
  const keys = usefulResultKeys(results);
  if (!keys.length) return false;
  const key = assetBestSnapshotKey(ticker, type);
  const snapshot = {
    ticker: canonicalizeTicker(ticker),
    type: String(type || inferAssetType(ticker)).toUpperCase(),
    status: payload.status,
    partial: Boolean(payload.partial),
    results: deepClone(results),
    coverage: deepClone(payload.coverage || {}),
    qualityScore: Number(payload.quality?.score || 0),
    source: payload.metrics?.source || payload.source || 'unknown',
    capturedAt: nowIso(),
    foundKeys: keys,
    foundKeysCount: keys.length,
  };
  const existing = assetBestSnapshotCache.get(key)?.snapshot;
  if (existing && assetSnapshotScore(existing) > assetSnapshotScore(snapshot)) return false;
  assetBestSnapshotCache.set(key, { snapshot, expiresAt: Date.now() + VALORAE_BEST_SNAPSHOT_STALE_MS });
  assetBestSnapshotMetrics.sets += 1;
  return true;
}

function mergeMissingSectionsFromSnapshot(current = {}, snapshot = {}, prefix = 'sections') {
  const out = { ...(current || {}) };
  const used = [];
  for (const [key, value] of Object.entries(snapshot || {})) {
    if (value === undefined || value === null || value === '') continue;
    const path = `${prefix}.${key}`;
    const cur = out[key];
    if (cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && !cur.length)) {
      out[key] = deepClone(value);
      used.push(path);
    } else if (typeof cur === 'object' && !Array.isArray(cur) && typeof value === 'object' && !Array.isArray(value)) {
      const merged = mergeMissingSectionsFromSnapshot(cur, value, path);
      out[key] = merged.value;
      used.push(...merged.used);
    }
  }
  return { value: out, used };
}

function hydrateMissingResultsFromBestSnapshot(ticker, type, results = {}, options = {}) {
  if (options.useBestSnapshotFallback === false || options.snapshotFallback === false) return { results, usedFields: [], snapshot: null };
  const snapshot = assetBestSnapshotGet(ticker, type);
  if (!snapshot?.results) return { results, usedFields: [], snapshot: null };
  const out = { ...(results || {}) };
  const usedFields = [];
  for (const [key, value] of Object.entries(snapshot.results || {})) {
    if (key === 'sections') continue;
    if (value === undefined || value === null || value === '') continue;
    const cur = out[key];
    if (cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && !cur.length)) {
      out[key] = deepClone(value);
      usedFields.push(key);
    }
  }
  const mergedSections = mergeMissingSectionsFromSnapshot(out.sections || {}, snapshot.results.sections || {});
  if (mergedSections.used.length) {
    out.sections = mergedSections.value;
    usedFields.push(...mergedSections.used);
  }
  if (usedFields.length) assetBestSnapshotMetrics.hydrations += 1;
  return { results: out, usedFields, snapshot: { ...snapshot, results: undefined } };
}

function cloneHtmlCacheValue(entry, requestedMaxChars) {
  const value = deepClone(entry.value);
  if (value && typeof value.html === 'string' && requestedMaxChars > 0 && value.html.length > requestedMaxChars) {
    value.html = value.html.slice(0, requestedMaxChars);
    value.htmlLength = value.html.length;
    value.truncated = true;
  }
  value.cacheAgeMs = Math.max(0, Date.now() - entry.createdAt);
  value.cacheExpiresInMs = Math.max(0, entry.expiresAt - Date.now());
  return value;
}

function htmlCacheFamilyRegister(familyKey, key) {
  if (!familyKey || !key) return;
  if (!htmlCacheFamilies.has(familyKey)) htmlCacheFamilies.set(familyKey, new Set());
  htmlCacheFamilies.get(familyKey).add(key);
}

function htmlCacheFamilyUnregisterKey(key) {
  for (const [family, keys] of htmlCacheFamilies.entries()) {
    if (keys.delete(key) && !keys.size) htmlCacheFamilies.delete(family);
  }
}

function htmlCacheDelete(key) {
  if (!htmlCache.has(key)) return;
  htmlCache.delete(key);
  htmlCacheFamilyUnregisterKey(key);
}

function htmlCacheEntryUsable(entry, requestedMaxChars, { allowStale = false } = {}) {
  if (!entry) return false;
  const now = Date.now();
  const stale = now > entry.expiresAt;
  if (stale && !(allowStale && now <= entry.staleUntil)) return false;
  if (entry.truncated && Number(entry.maxChars || 0) < Number(requestedMaxChars || 0)) return false;
  return true;
}

function htmlCacheTouch(key, entry) {
  htmlCache.delete(key);
  htmlCache.set(key, entry);
}

function htmlCacheShapeHit(key, entry, requestedMaxChars, { familyHit = false } = {}) {
  htmlCacheTouch(key, entry);
  const stale = Date.now() > entry.expiresAt;
  if (stale) htmlCacheMetrics.staleHits += 1;
  else if (familyHit) htmlCacheMetrics.familyHits += 1;
  else htmlCacheMetrics.hits += 1;
  const value = cloneHtmlCacheValue(entry, requestedMaxChars);
  value.cache = stale ? 'STALE_HIT' : (familyHit ? 'HTML_FAMILY_HIT' : (value.provider === 'ValoraeScrape' ? 'VALORAE_SCRAPE_HTML_HIT' : 'HTML_HIT'));
  value.cacheLayers = { ...(value.cacheLayers || {}), html: stale ? 'STALE_HIT' : (familyHit ? 'FAMILY_HIT' : 'HIT'), network: 'SKIPPED' };
  value.htmlCacheFamilyHit = Boolean(familyHit);
  value.htmlCacheStoredMaxChars = Number(entry.maxChars || 0);
  if (stale) value.network = { ...(value.network || {}), usedStale: true };
  return value;
}

function findFamilyHtmlCacheEntry(familyKey, requestedMaxChars, opts = {}) {
  const keys = [...(htmlCacheFamilies.get(familyKey) || [])];
  let best = null;
  for (const key of keys) {
    const entry = htmlCache.get(key);
    if (!entry) { htmlCacheFamilyUnregisterKey(key); continue; }
    if (!htmlCacheEntryUsable(entry, requestedMaxChars, opts)) continue;
    const maxChars = Number(entry.maxChars || 0);
    // Prefer the smallest usable entry to reduce slice/copy cost, but never use a truncated entry smaller than requested.
    if (!best || maxChars < Number(best.entry.maxChars || Infinity)) best = { key, entry };
  }
  return best;
}

function htmlCacheGet(key, requestedMaxChars, { allowStale = false, familyKey = '' } = {}) {
  const entry = htmlCache.get(key);
  if (entry && htmlCacheEntryUsable(entry, requestedMaxChars, { allowStale })) {
    return htmlCacheShapeHit(key, entry, requestedMaxChars);
  }
  if (entry && !htmlCacheEntryUsable(entry, requestedMaxChars, { allowStale: true }) && Date.now() > entry.staleUntil) {
    htmlCacheDelete(key);
  }
  if (familyKey) {
    const family = findFamilyHtmlCacheEntry(familyKey, requestedMaxChars, { allowStale });
    if (family) return htmlCacheShapeHit(family.key, family.entry, requestedMaxChars, { familyHit: true });
  }
  htmlCacheMetrics.misses += 1;
  return null;
}

function htmlCacheValidators(key, requestedMaxChars, familyKey = '') {
  const direct = htmlCache.get(key);
  if (direct && htmlCacheEntryUsable(direct, requestedMaxChars, { allowStale: true })) return direct.value?.validators || {};
  if (familyKey) {
    const family = findFamilyHtmlCacheEntry(familyKey, requestedMaxChars, { allowStale: true });
    if (family?.entry) return family.entry.value?.validators || {};
  }
  return {};
}

function htmlCacheSet(key, value, maxChars, familyKey = '') {
  if (!value?.ok) return false;
  while (htmlCache.size >= HTML_CACHE_MAX_ENTRIES) {
    const oldest = htmlCache.keys().next().value;
    if (!oldest) break;
    htmlCacheDelete(oldest);
    htmlCacheMetrics.evictions += 1;
  }
  const htmlLength = Number(value.htmlLength || value.html?.length || 0);
  const truncated = Boolean(value.truncated || (Number(maxChars || 0) > 0 && htmlLength >= Number(maxChars || 0)));
  const existing = htmlCache.get(key);
  if (existing && Number(existing.maxChars || 0) > Number(maxChars || 0) && existing.truncated === false) {
    htmlCacheMetrics.upgrades += 1;
    return true;
  }
  const entry = { value: deepClone({ ...value, htmlLength }), createdAt: Date.now(), expiresAt: Date.now() + HTML_CACHE_TTL_MS, staleUntil: Date.now() + HTML_CACHE_TTL_MS + HTML_CACHE_STALE_MS, maxChars: Number(maxChars || DEFAULT_MAX_HTML_CHARS), truncated, familyKey };
  htmlCache.set(key, entry);
  htmlCacheFamilyRegister(familyKey, key);
  htmlCacheMetrics.sets += 1;
  return true;
}

function htmlCacheStats() {
  return { entries: htmlCache.size, families: htmlCacheFamilies.size, ttlMs: HTML_CACHE_TTL_MS, staleMs: HTML_CACHE_STALE_MS, maxEntries: HTML_CACHE_MAX_ENTRIES, metrics: { ...htmlCacheMetrics }, inFlight: inflightStats('html:') };
}

function buildEngineCoreStats() {
  const htmlStats = htmlCacheStats();
  const scrapeStats = scrapeResultCacheStats();
  const failureStats = failureCacheStats();
  const providers = getProviderHealthSnapshot();
  const providerList = Object.values(providers || {});
  const degraded = providerList.filter(p => ['degraded','half-open','cooldown'].includes(String(p.status || '').toLowerCase()) || Number(p.failures || 0) > 0 || Number(p.score ?? 100) < 70);
  const htmlHits = Number(htmlStats.metrics?.hits || 0) + Number(htmlStats.metrics?.familyHits || 0) + Number(htmlStats.metrics?.staleHits || 0);
  const htmlMisses = Number(htmlStats.metrics?.misses || 0);
  const htmlHitRate = htmlHits + htmlMisses ? Math.round((htmlHits / (htmlHits + htmlMisses)) * 10000) / 100 : 100;
  const familyHitRate = htmlHits ? Math.round((Number(htmlStats.metrics?.familyHits || 0) / htmlHits) * 10000) / 100 : 0;
  const scrapeHitRate = Number(scrapeStats.hitRatePercent ?? scrapeStats.hitRate ?? 100);
  const providerScore = providerList.length ? Math.round(providerList.reduce((sum, p) => sum + Number(p.score ?? 100), 0) / providerList.length) : 100;
  const inFlight = inflightStats();
  const score = Math.max(0, Math.min(100, Math.round(
    100 - degraded.length * 8 - Math.max(0, 70 - htmlHitRate) * 0.16 - Math.max(0, 70 - scrapeHitRate) * 0.16 - Math.max(0, 76 - providerScore) * 0.38 - Math.max(0, Number(inFlight.size || 0) - 8) * 3
  )));
  return {
    version: '21.12.0-vercel-build-safe',
    score,
    state: score >= 85 ? 'healthy' : score >= 70 ? 'attention' : 'degraded',
    htmlCacheHitRatePercent: htmlHitRate,
    htmlFamilyHitRatePercent: familyHitRate,
    scrapeResultHitRatePercent: scrapeHitRate,
    providerScore,
    degradedProviders: degraded.map(p => ({ provider: p.provider, status: p.status, score: p.score, failures: p.failures, errorRatePercent: p.errorRatePercent, avgLatencyMs: p.avgLatencyMs, cooldownUntil: p.cooldownUntil, lastError: p.lastError, lastErrorType: p.lastErrorType })).slice(0, 8),
    providers: providerList.map(p => ({ provider: p.provider, status: p.status, score: p.score, errorRatePercent: p.errorRatePercent, avgLatencyMs: p.avgLatencyMs, sampleSize: p.sampleSize })).slice(0, 12),
    inflight: inFlight,
    cachePolicy: {
      htmlFamilies: htmlStats.families,
      staleMs: htmlStats.staleMs,
      resultCacheEnabled: scrapeStats.enabled,
      failureCacheEnabled: failureStats.enabled,
      enginePolicy: VALORAE_ENGINE_POLICY_VERSION,
    },
    failureCache: { entries: failureStats.entries, ttlMs: failureStats.ttlMs, hits: failureStats.metrics?.hits || 0, sets: failureStats.metrics?.sets || 0 },
    recommendations: [
      ...(degraded.length ? ['Usar cache stale e reduzir insistência em fontes degradadas até o cooldown terminar.'] : []),
      ...(htmlHitRate < 55 ? ['Aumentar TTL do HTML cache para rotas repetitivas ou revisar variação de headers/cache keys.'] : []),
      ...(familyHitRate > 15 ? ['HTML cache familiar está reaproveitando documentos maiores para pedidos menores com segurança.'] : []),
      ...(scrapeHitRate < 55 ? ['Padronizar selectors/fields nos consumidores para elevar RESULT_HIT.'] : []),
      ...(providerScore < 76 ? ['Há fonte com qualidade operacional baixa; verificar erros 403/429/timeout e usar fallback/stale.'] : []),
      ...(Number(inFlight.size || 0) > 8 ? ['Reduzir concorrência ou aumentar coalescing de chamadas simultâneas.'] : []),
      ...(failureStats.metrics?.hits ? ['Failure cache curto evitou repetição de chamadas com falha recente.'] : []),
    ],
  };
}

export function getValoraeRuntimeStats() {
  return {
    version: VALORAE_ENGINE_VERSION,
    caches: {
      assetResult: { enabled: ASSET_RESULT_CACHE_ENABLED, entries: assetResultCache.size, bytes: assetResultCacheBytes, ttlMs: ASSET_RESULT_CACHE_TTL_MS, metrics: { ...assetResultMetrics }, hitRate: assetResultMetrics.hits + assetResultMetrics.misses ? Math.round(assetResultMetrics.hits / (assetResultMetrics.hits + assetResultMetrics.misses) * 10000) / 100 : null },
      bestSnapshot: { enabled: true, entries: assetBestSnapshotCache.size, ttlMs: VALORAE_BEST_SNAPSHOT_STALE_MS, metrics: { ...assetBestSnapshotMetrics } },
      html: htmlCacheStats(),
      scrapeResult: scrapeResultCacheStats(),
      failure: failureCacheStats(),
      scrapeResponse: { entries: valoraeScrapeResponseCache.size, bytes: valoraeScrapeResponseCacheBytes, ttlMs: VALORAE_SCRAPE_CACHE_TTL_MS },
      news: { entries: newsCache.size, ttlMs: NEWS_CACHE_TTL_MS, staleMs: NEWS_CACHE_STALE_MS, maxEntries: NEWS_CACHE_MAX_ENTRIES, inflight: newsInFlight.size, metrics: { ...newsCacheMetrics }, reliabilityVersion: VALORAE_NEWS_RELIABILITY_VERSION },
      market: marketCacheStats()
    },
    providers: getProviderHealthSnapshot(),
    engineCore: buildEngineCoreStats(),
    cacheDriver: 'memory',
    performance: performanceCapabilities(),
    canonicalReliability: canonicalReliabilityCapabilities(),
    normalizers: { numbers: numberNormalizerStats() },
    inFlight: inflightStats()
  };
}

function valoraeScrapeTargetHeaders(url) {
  const headers = browserHeaders(url);
  // Mantém o conjunto simples e estável que o proxy funcional usa para melhor cache/coalescing.
  return cleanHeaderMap({
    'User-Agent': process.env.VALORAE_SCRAPE_TARGET_USER_AGENT || process.env.VALORAE_USER_AGENT || headers['User-Agent'],
    'Accept-Language': headers['Accept-Language'],
    'Referer': (() => {
      try {
        const h = new URL(url).hostname.toLowerCase();
        if (h.endsWith('investidor10.com.br')) return 'https://investidor10.com.br/';
        return `https://${h}/`;
      } catch { return 'https://investidor10.com.br/'; }
    })()
  });
}

function buildValoraeScrapePayload(url, options = {}) {
  const parsed = validateUrl(url);
  const host = parsed.hostname.toLowerCase();
  const isInvestidor10 = host.endsWith('investidor10.com.br');
  return {
    url,
    returnHtml: options.returnHtml !== false,
    includeScripts: options.includeScripts ?? true,
    selectors: isInvestidor10 ? INVESTIDOR10_SELECTORS : undefined,
    cacheTtl: Number(options.cacheTtl || (isInvestidor10 ? 4 * 60 * 60 * 1000 : 60 * 1000)),
    headers: cleanHeaderMap({
      ...valoraeScrapeTargetHeaders(url),
      ...cleanHeaderMap(options.headers)
    })
  };
}

function valoraeScrapeCacheKey(payload) {
  return stableStringify(payload);
}

function valoraeScrapeCacheDelete(key) {
  const entry = valoraeScrapeResponseCache.get(key);
  if (!entry) return;
  valoraeScrapeResponseCacheBytes = Math.max(0, valoraeScrapeResponseCacheBytes - entry.bytes);
  valoraeScrapeResponseCache.delete(key);
}

function valoraeScrapeCacheGet(key) {
  const entry = valoraeScrapeResponseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    valoraeScrapeCacheDelete(key);
    return null;
  }
  valoraeScrapeResponseCache.delete(key);
  valoraeScrapeResponseCache.set(key, entry);
  return { ...entry.data, cache: 'VALORAE_SCRAPE_HIT' };
}

function valoraeScrapeCacheSet(key, data) {
  if (!data) return;
  const bytes = Buffer.byteLength(JSON.stringify({ ...data, html: data.html ? `[${data.html.length} chars]` : '' }), 'utf8') + Buffer.byteLength(data.html || '', 'utf8');
  if (bytes > VALORAE_SCRAPE_CLIENT_CACHE_MAX_BYTES) return;
  valoraeScrapeCacheDelete(key);
  while (valoraeScrapeResponseCache.size >= VALORAE_SCRAPE_CLIENT_CACHE_MAX_ENTRIES || valoraeScrapeResponseCacheBytes + bytes > VALORAE_SCRAPE_CLIENT_CACHE_MAX_BYTES) {
    const oldest = valoraeScrapeResponseCache.keys().next().value;
    if (!oldest) break;
    valoraeScrapeCacheDelete(oldest);
  }
  valoraeScrapeResponseCache.set(key, { data, bytes, expiresAt: Date.now() + VALORAE_SCRAPE_CACHE_TTL_MS });
  valoraeScrapeResponseCacheBytes += bytes;
}

function shouldRetryValoraeScrape(status) {
  return shouldRetryFetch(Number(status || 0));
}

async function sleep(ms) {
  if (ms > 0) await new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeValoraeScrapeResponse(data, url, started, maxChars) {
  const htmlRaw = data?.html || data?.body || data?.content || data?.text || '';
  const html = typeof htmlRaw === 'string' && htmlRaw.length > maxChars ? htmlRaw.slice(0, maxChars) : String(htmlRaw || '');
  const selectorResults = data?.results && typeof data.results === 'object' ? data.results : {};
  const targetStatus = Number(data?.targetStatus || data?.statusCode || data?.status || (data?.success === false ? 500 : 200));
  const contentType = data?.contentType || data?.headers?.['content-type'] || data?.headers?.['Content-Type'] || (html ? 'text/html' : 'application/json');
  const blocked = [401, 403, 429].includes(targetStatus) || /cloudflare|access denied|forbidden|captcha|waf/i.test(html.slice(0, 4000)) || /403|blocked|forbidden/i.test(String(data?.error || ''));
  const classification = classifyFetchOutcome({ status: targetStatus, ok: targetStatus >= 200 && targetStatus < 400, contentType, html, error: data?.error, blocked });
  const hasSelectorResults = Object.keys(selectorResults).some(k => Array.isArray(selectorResults[k]) ? selectorResults[k].length > 0 : selectorResults[k]);
  const ok = !blocked && (html.length > 200 || hasSelectorResults);
  return {
    ok,
    status: targetStatus,
    url,
    finalUrl: data?.finalUrl || data?.url || url,
    hostname: new URL(url).hostname,
    contentType,
    html: html || '',
    htmlLength: html.length,
    selectorResults,
    selectorResultKeys: Object.keys(selectorResults).filter(k => Array.isArray(selectorResults[k]) ? selectorResults[k].length > 0 : selectorResults[k]),
    blocked,
    elapsedMs: Math.round(performance.now() - started),
    error: blocked ? `ValoraeScrape/WAF HTTP ${targetStatus}` : (!ok ? (data?.error || 'ValoraeScrape sem HTML/seletores úteis') : undefined),
    errorType: ok ? undefined : classification.type,
    retryable: ok ? false : classification.retryable,
    sourceSignals: classification.signals,
    cache: 'VALORAE_SCRAPE_MISS',
    provider: 'ValoraeScrape'
  };
}

async function fetchViaValoraeScrape(url, options = {}) {
  if (!isValoraeScrapeEnabled(options)) return { ok: false, status: 0, url, finalUrl: url, hostname: new URL(url).hostname, contentType: '', html: '', htmlLength: 0, selectorResults: {}, blocked: false, elapsedMs: 0, error: 'ValoraeScrape desativado', cache: 'VALORAE_SCRAPE_DISABLED', provider: 'ValoraeScrape' };
  const scrapeUrl = getValoraeScrapeUrl(options);
  const timeoutMs = boundedTimeout(options.timeoutMs || DEFAULT_TIMEOUT_MS, options.valoraeScrapeTimeoutMs || VALORAE_SCRAPE_TIMEOUT_MS);
  const retryBudget = isLowLatencyRequest(options) ? 0 : Math.max(0, Number(options.valoraeScrapeRetries ?? VALORAE_SCRAPE_RETRIES));
  const maxChars = Number(options.maxChars || DEFAULT_MAX_HTML_CHARS);
  const payload = buildValoraeScrapePayload(url, options);
  const cacheKey = valoraeScrapeCacheKey(payload);
  const cached = options.cache === false ? null : valoraeScrapeCacheGet(cacheKey);
  if (cached) return cached;
  const inFlight = valoraeScrapeInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const promise = (async () => {
    let lastError = null;
    for (let attempt = 0; attempt <= retryBudget; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const started = performance.now();
      try {
        const res = await fetch(scrapeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'X-ValoraeScrape-Client': 'valorae-engine'
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = null; }
        if (!res.ok) {
          const err = new Error(data?.error || text.slice(0, 180) || `ValoraeScrape HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }
        if (!data || typeof data !== 'object') throw new Error('ValoraeScrape retornou resposta inválida');
        const normalized = normalizeValoraeScrapeResponse(data, url, started, maxChars);
        normalized.attempt = attempt + 1;
        if (options.cache !== false && normalized.ok) valoraeScrapeCacheSet(cacheKey, normalized);
        return normalized;
      } catch (err) {
        lastError = err;
        const classification = classifyFetchOutcome({ status: err?.status || 0, ok: false, error: err });
        const retryable = shouldRetryFetch(classification);
        if (attempt >= retryBudget || !retryable) break;
        await sleep(Math.min(350 * Math.pow(2, attempt) + Math.floor(Math.random() * 150), Math.max(0, timeoutMs - 50)));
      } finally {
        clearTimeout(timer);
      }
    }
    return {
      ok: false,
      status: lastError?.status || 0,
      url,
      finalUrl: url,
      hostname: new URL(url).hostname,
      contentType: '',
      html: '',
      htmlLength: 0,
      selectorResults: {},
      selectorResultKeys: [],
      blocked: [401, 403, 429].includes(lastError?.status),
      elapsedMs: 0,
      error: lastError?.message || 'ValoraeScrape indisponível',
      errorType: classifyFetchOutcome({ status: lastError?.status || 0, ok: false, error: lastError }).type,
      retryable: shouldRetryFetch(classifyFetchOutcome({ status: lastError?.status || 0, ok: false, error: lastError })),
      cache: 'VALORAE_SCRAPE_ERROR',
      provider: 'ValoraeScrape'
    };
  })();

  valoraeScrapeInFlight.set(cacheKey, promise);
  promise.then(() => valoraeScrapeInFlight.delete(cacheKey), () => valoraeScrapeInFlight.delete(cacheKey));
  return promise;
}

function isPrivateIpLiteral(hostname = '') {
  const h = String(hostname || '').replace(/^\[|\]$/g, '');
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  const m = h.match(/^172\.(\d{1,3})\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (['localhost','0.0.0.0','::1'].includes(h.toLowerCase())) return true;
  return false;
}

function makeScrapeValidationError(message, status = 400, code = 'INVALID_TARGET_URL') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function allowedTargetHosts() {
  const hosts = new Set(ALLOWED_HOSTS);
  String(process.env.VALORAE_ALLOWED_SCRAPE_HOSTS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .filter(h => /^[a-z0-9.-]+$/.test(h) && h !== '*')
    .forEach(h => hosts.add(h));
  return hosts;
}

function validateUrl(url) {
  if (String(url || '').length > intEnv('VALORAE_MAX_TARGET_URL_LENGTH', 2048)) {
    throw makeScrapeValidationError('URL de destino muito longa.', 414, 'TARGET_URL_TOO_LONG');
  }
  let parsed;
  try { parsed = new URL(url); } catch {
    throw makeScrapeValidationError('URL inválida. Envie uma URL HTTPS completa de uma fonte permitida.', 400, 'INVALID_TARGET_URL');
  }
  if (parsed.protocol !== 'https:') {
    throw makeScrapeValidationError('Apenas URLs HTTPS são permitidas para scraping direto.', 400, 'INVALID_TARGET_URL_PROTOCOL');
  }
  if (parsed.username || parsed.password) {
    throw makeScrapeValidationError('Credenciais embutidas na URL não são permitidas.', 400, 'TARGET_URL_CREDENTIALS_NOT_ALLOWED');
  }
  if (!parsed.hostname || parsed.hostname.endsWith('.localhost') || isPrivateIpLiteral(parsed.hostname)) {
    throw makeScrapeValidationError('Host privado/local não permitido para evitar SSRF.', 403, 'TARGET_HOST_PRIVATE');
  }
  const allowed = allowedTargetHosts();
  if (!allowed.has(parsed.hostname.toLowerCase())) {
    throw makeScrapeValidationError(`Domínio não permitido para scraping direto: ${parsed.hostname}.`, 403, 'SCRAPE_HOST_NOT_ALLOWED');
  }
  return parsed;
}

export async function fetchPublicHtml(url, options = {}) {
  const parsed = validateUrl(url);
  const timeoutMs = boundedTimeout(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const maxChars = Number(options.maxChars || DEFAULT_MAX_HTML_CHARS);
  const htmlCacheOptions = {
    provider: options.provider || 'auto',
    maxChars,
    returnHtml: options.returnHtml !== false,
    includeScripts: options.includeScripts ?? true,
    headers: cleanHeaderMap(options.headers),
  };
  const cacheKey = buildHtmlCacheKey(url, htmlCacheOptions);
  const cacheFamilyKey = buildHtmlCacheFamilyKey(url, htmlCacheOptions);
  const useCache = options.cache !== false && (parsed.hostname.includes('investidor10.com.br') || parsed.hostname.includes('statusinvest.com.br'));
  const sourceProviderName = providerNameForHost(parsed.hostname);

  if (useCache) {
    const cached = htmlCacheGet(cacheKey, maxChars, { familyKey: cacheFamilyKey });
    if (cached) return cached;
  } else {
    htmlCacheMetrics.bypasses += 1;
  }

  if (useCache && options.refresh !== true && options.cacheBypassed !== true) {
    const recentFailure = getFailureCache(cacheKey);
    if (recentFailure) return recentFailure;
  }

  const fetchWork = async () => {
    const sourceHealth = getProviderCooldown(sourceProviderName);
    const enginePlan = buildEngineProviderPlan({
      optionProvider: options.provider || 'auto',
      scrapeFirst: options.provider === 'valorae-scrape' || (options.provider !== 'direct' && boolEnv('VALORAE_SCRAPE_FIRST', true)),
      sourceHealth,
      directRetries: VALORAE_DIRECT_FETCH_RETRIES,
    });
    const providers = enginePlan.providers;
    const directRetryBudget = isLowLatencyRequest(options) ? 0 : enginePlan.directRetryBudget;
    const attempts = [{ provider: 'EnginePolicy', ok: true, skipped: true, plan: enginePlan.reason, directRetryBudget, stalePreferred: enginePlan.stalePreferred, sourceScore: enginePlan.sourceScore, lowLatencyBudget: isLowLatencyRequest(options) }];
    if (!sourceHealth.available) {
      attempts.push({ provider: sourceProviderName, status: 0, ok: false, blocked: false, skipped: true, error: 'Fonte em cooldown pelo circuit breaker', cooldownUntil: sourceHealth.cooldownUntil, retryAfterMs: sourceHealth.retryAfterMs });
      if (useCache) {
        const stale = htmlCacheGet(cacheKey, maxChars, { allowStale: true, familyKey: cacheFamilyKey });
        if (stale) return { ...stale, cache: 'STALE_HIT', network: { attemptedRefresh: false, usedStale: true, refreshErrorType: 'SOURCE_COOLDOWN', retryAfterMs: sourceHealth.retryAfterMs, enginePolicy: enginePlan.reason }, attempts };
      }
    }

    for (const provider of providers) {
      if (provider === 'valorae-scrape') {
        const valoraeScrape = await fetchViaValoraeScrape(url, {
          ...options,
          maxChars,
          cache: options.cache,
          returnHtml: options.returnHtml !== false,
          includeScripts: options.includeScripts ?? (options.returnHtml !== false),
        });
        attempts.push({ provider: 'ValoraeScrape', status: valoraeScrape.status, ok: valoraeScrape.ok, blocked: valoraeScrape.blocked, error: valoraeScrape.error, htmlLength: valoraeScrape.htmlLength, selectorResultKeys: valoraeScrape.selectorResultKeys || [] });
        if (valoraeScrape.ok) {
          const withAttempts = { ...valoraeScrape, attempts, truncated: Boolean(valoraeScrape.truncated), enginePolicy: enginePlan, cacheLayers: { result: 'MISS', html: 'MISS', network: 'FETCH' } };
          if (useCache) htmlCacheSet(cacheKey, withAttempts, maxChars, cacheFamilyKey);
          return withAttempts;
        }
        if (Object.keys(valoraeScrape.selectorResults || {}).length > 0) {
          return { ...valoraeScrape, attempts, enginePolicy: enginePlan, cacheLayers: { result: 'MISS', html: 'SKIPPED', network: 'FETCH' } };
        }
        continue;
      }

      if (provider === 'direct' && options.returnHtml === false && VALORAE_FAST_DIRECT_FALLBACK !== true) {
        attempts.push({ provider: 'DirectFetch', status: 0, ok: false, blocked: false, error: 'DirectFetch pulado em perfil selector-only/fast', htmlLength: 0, skipped: true });
        continue;
      }
      for (let directAttempt = 0; directAttempt <= directRetryBudget; directAttempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const started = performance.now();
        let classification = null;
        try {
          const baseHeaders = cleanHeaderMap({ ...browserHeaders(url), ...cleanHeaderMap(options.headers) });
          const validatorHeaders = useCache ? conditionalValidatorHeaders(htmlCacheValidators(cacheKey, maxChars, cacheFamilyKey), baseHeaders) : {};
          const requestHeaders = cleanHeaderMap({ ...baseHeaders, ...validatorHeaders });
          const res = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: requestHeaders,
          });
          const contentType = res.headers.get('content-type') || '';
          const finalUrl = res.url || url;
          const status = res.status;
          if (status === 304 && useCache) {
            const revalidated = htmlCacheGet(cacheKey, maxChars, { allowStale: true, familyKey: cacheFamilyKey });
            if (revalidated) {
              attempts.push({ provider: 'DirectFetch', attempt: directAttempt + 1, status, ok: true, blocked: false, error: undefined, errorType: undefined, retryable: false, htmlLength: revalidated.htmlLength || 0, elapsedMs: Math.round(performance.now() - started), revalidated: true });
              recordProviderResult(sourceProviderName, true, { status, blocked: false, latencyMs: Math.round(performance.now() - started) });
              return { ...revalidated, cache: 'REVALIDATED_HIT', network: { ...(revalidated.network || {}), revalidated: true }, attempts, enginePolicy: enginePlan };
            }
          }
          const okContent = /text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType || 'text/html');
          let text = '';
          let rawLength = 0;
          if (okContent || status < 500) {
            const bodyLimit = Math.max(1024, Number(process.env.VALORAE_MAX_REMOTE_BODY_BYTES || 6_000_000));
            const body = await readTextLimited(res, { maxBytes: bodyLimit });
            text = body.text;
            rawLength = body.rawBytes || text.length;
            if (text.length > maxChars) text = text.slice(0, maxChars);
          }
          const blocked = [401, 403, 429].includes(status) || /cloudflare|access denied|forbidden|captcha|waf/i.test(text.slice(0, 4000));
          const selectorResults = okContent && text && parsed.hostname.endsWith('investidor10.com.br')
            ? extractInvestidor10SelectorResults(text, finalUrl)
            : {};
          const selectorResultKeys = Object.keys(selectorResults).filter(k => Array.isArray(selectorResults[k]) ? selectorResults[k].length > 0 : selectorResults[k]);
          const ok = res.ok && okContent && !blocked && text.length > 200;
          classification = classifyFetchOutcome({ status, ok, contentType, html: text, blocked });
          const value = {
            ok,
            status,
            url,
            finalUrl,
            hostname: parsed.hostname,
            contentType,
            html: okContent ? text : '',
            htmlLength: okContent ? text.length : 0,
            rawHtmlLength: rawLength,
            truncated: okContent ? rawLength > text.length : false,
            selectorResults,
            selectorResultKeys,
            blocked: classification.blocked,
            elapsedMs: Math.round(performance.now() - started),
            error: classification.blocked ? `WAF HTTP ${status}` : (!ok ? (classification.type === 'INVALID_CONTENT_TYPE' ? `Content-Type inválido: ${contentType || 'vazio'}` : `HTTP ${status}`) : undefined),
            errorType: ok ? undefined : classification.type,
            retryable: ok ? false : classification.retryable,
            sourceSignals: classification.signals,
            directAttempt: directAttempt + 1,
            cache: 'MISS',
            validators: responseValidators(res),
            provider: 'DirectFetch',
            cacheLayers: { result: 'MISS', html: 'MISS', network: 'FETCH' },
          };
          attempts.push({ provider: 'DirectFetch', attempt: directAttempt + 1, status: value.status, ok: value.ok, blocked: value.blocked, error: value.error, errorType: value.errorType, retryable: value.retryable, htmlLength: value.htmlLength, elapsedMs: value.elapsedMs });
          recordProviderResult(sourceProviderName, value.ok, { status: value.status, blocked: value.blocked, error: value.error, errorType: value.errorType, retryable: value.retryable, latencyMs: value.elapsedMs });
          if (value.ok) {
            const withAttempts = { ...value, attempts, enginePolicy: enginePlan };
            if (useCache) htmlCacheSet(cacheKey, withAttempts, maxChars, cacheFamilyKey);
            return withAttempts;
          }
          if (!shouldRetryFetch(classification) || directAttempt >= directRetryBudget) break;
          await sleep(Math.min(retryDelayMs(directAttempt, { baseMs: 180, maxMs: 2500 }), Math.max(0, timeoutMs - 50)));
        } catch (err) {
          classification = classifyFetchOutcome({ status: 0, ok: false, error: err });
          attempts.push({ provider: 'DirectFetch', attempt: directAttempt + 1, status: 0, ok: false, blocked: false, error: err?.name === 'AbortError' ? `Timeout após ${timeoutMs}ms` : (err?.message || 'Erro de rede'), errorType: classification.type, retryable: classification.retryable, htmlLength: 0, elapsedMs: Math.round(performance.now() - started) });
          recordProviderResult(sourceProviderName, false, { status: 0, blocked: false, error: err?.message || 'Erro de rede', errorType: classification.type, retryable: classification.retryable, latencyMs: Math.round(performance.now() - started) });
          if (!shouldRetryFetch(classification) || directAttempt >= directRetryBudget) break;
          await sleep(Math.min(retryDelayMs(directAttempt, { baseMs: 180, maxMs: 2500 }), Math.max(0, timeoutMs - 50)));
        } finally {
          clearTimeout(timer);
        }
      }
    }

    if (useCache) {
      const stale = htmlCacheGet(cacheKey, maxChars, { allowStale: true, familyKey: cacheFamilyKey });
      if (stale) return { ...stale, cache: 'STALE_HIT', network: { attemptedRefresh: true, usedStale: true, refreshErrorType: attempts.find(a => a.errorType)?.errorType || attempts.find(a => a.error)?.error || 'REFRESH_FAILED', enginePolicy: enginePlan.reason }, attempts, enginePolicy: enginePlan };
    }

    const last = attempts[attempts.length - 1] || {};
    const failure = {
      ok: false,
      status: last.status || 0,
      url,
      finalUrl: url,
      hostname: parsed.hostname,
      contentType: '',
      html: '',
      htmlLength: 0,
      selectorResults: {},
      selectorResultKeys: [],
      blocked: attempts.some(a => a.blocked),
      elapsedMs: 0,
      error: attempts.find(a => a.error)?.error || 'Nenhum provedor retornou HTML útil',
      errorType: attempts.find(a => a.errorType)?.errorType || last.errorType || 'NO_PROVIDER_DATA',
      retryable: attempts.some(a => a.retryable),
      cache: 'MISS',
      cacheLayers: { result: 'MISS', html: 'MISS', network: 'FAILED' },
      provider: 'None',
      enginePolicy: enginePlan,
      attempts,
    };
    if (useCache) setFailureCache(cacheKey, failure);
    return failure;
  };

  const before = inflightStats('html:').size;
  const result = await coalesce(`html:${cacheKey}`, fetchWork);
  const after = inflightStats('html:').size;
  if (before > 0 || after > 0) htmlCacheMetrics.inflightJoins = inflightStats('html:').metrics.joins;
  return result;
}

function normalizeBRNumber(raw) {
  const n = parseFinancialNumber(raw);
  return n !== null ? n : undefined;
}

function normalizeNumericString(raw) {
  const n = parseFinancialNumber(raw);
  return n !== null ? n : undefined;
}

function normalizePercent(raw) {
  return formatPercentLike(raw);
}

function firstMatch(text, regex, group = 1) {
  const m = text.match(regex);
  return m?.[group]?.trim();
}

function valueAfterLabel(text, labels, kind = 'number', window = 180) {
  const clean = ` ${text.replace(/\s+/g, ' ')} `;
  for (const label of labels) {
    const re = new RegExp(`(?:^|\\s)${escapeRe(label)}(?:\\s|:|-)+(.{0,${window}})`, 'i');
    const m = clean.match(re);
    if (!m) continue;
    const chunk = m[1];
    let raw;
    if (kind === 'percent') raw = firstMatch(chunk, /([+-]?[\d,.]+\s*%)/);
    else if (kind === 'money') raw = firstMatch(chunk, /((?:R\$|US\$)?\s*[+-]?[\d,.]+\s*(?:Bilhões|Bilhão|Milhões|Milhão|Trilhões|Trilhão|[KMB])?)/i);
    else if (kind === 'string') raw = firstMatch(chunk, /([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 .,/%()ºª-]{1,90})/);
    else raw = firstMatch(chunk, /([+-]?[\d,.]+\s*(?:Bilhões|Bilhão|Milhões|Milhão|Trilhões|Trilhão|[KMB])?)/i);
    if (raw && !/^[-—–]+$/.test(raw)) {
      if (kind === 'percent') return normalizePercent(raw);
      if (kind === 'string') return raw.trim();
      return normalizeNumericString(raw);
    }
  }
  return undefined;
}

function getPageTitle(html) {
  return decodeHtml(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || '')
    .replace(/\s*\|\s*Investidor10.*$/i, '')
    .trim();
}

function getH1(html) {
  return stripTags(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || '').trim();
}

function extractCnpj(text) {
  return firstMatch(text, /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
}

const ACAO_FIELDS = [
  ['precoAtual', ['Cotação','Preço Atual','Valor atual'], 'money'],
  ['variacaoDay', ['Variação','Var. Dia','Variação no dia'], 'percent'],
  ['variacao12m', ['Variação 12M','VARIAÇÃO (12M)','Var 12M','Valorização (12m)','Valorização 12m','Valorização'], 'percent'],
  ['dividendYield', ['Dividend Yield','DY atual','DY','D.Y'], 'percent'],
  ['dyMedio5a', ['DY médio 5 anos','DY Médio 5 anos','DY médio'], 'percent'],
  ['pl', ['P/L','P / L','Preço/Lucro'], 'number'],
  ['pvp', ['P/VP','P / VP','Preço/Valor Patrimonial'], 'number'],
  ['psr', ['P/Receita','PSR','P/SR','P/Receita (PSR)'], 'number'],
  ['payout', ['Payout'], 'percent'],
  ['margemLiquida', ['Margem Líquida','Margem Liquida','M. Líquida','M. Liquida'], 'percent'],
  ['margemBruta', ['Margem Bruta','M. Bruta'], 'percent'],
  ['margemEbit', ['Margem EBIT','Margem Ebit','Margem Operacional','M. EBIT','M. Ebit'], 'percent'],
  ['margemEbitda', ['Margem EBITDA','Margem Ebitda','M. EBITDA','M. Ebitda'], 'percent'],
  ['evEbitda', ['EV/EBITDA'], 'number'],
  ['evEbit', ['EV/EBIT'], 'number'],
  ['pEbitda', ['P/EBITDA'], 'number'],
  ['pEbit', ['P/EBIT'], 'number'],
  ['pAtivo', ['P/Ativo'], 'number'],
  ['pCapGiro', ['P/Cap.Giro','P/Capital de Giro','P/Cap Giro'], 'number'],
  ['pAtivoCircLiq', ['P/Ativo Circ. Liq.','P/ACL'], 'number'],
  ['vpa', ['VPA','Valor Patrimonial por Ação'], 'number'],
  ['lpa', ['LPA','Lucro por Ação'], 'number'],
  ['giroAtivos', ['Giro Ativos','Giro de Ativos'], 'number'],
  ['roe', ['ROE'], 'percent'],
  ['roic', ['ROIC'], 'percent'],
  ['roa', ['ROA'], 'percent'],
  ['dividaLiquidaPatrimonio', ['Dívida Líquida / Patrimônio','Dívida Liq/Patrimônio','Div Liq/PL','Dív. líquida/PL','Divida liquida/PL','Dívida Líquida/PL'], 'number'],
  ['dividaLiquidaEbitda', ['Dívida Líquida / Ebitda','Dívida Liq/EBITDA','Dív. líquida/EBITDA','Divida liquida/EBITDA'], 'number'],
  ['dividaLiquidaEbit', ['Dívida Líquida / Ebit','Dívida Liq/EBIT','Dív. líquida/EBIT','Divida liquida/EBIT'], 'number'],
  ['dividaBrutaPatrimonio', ['Dívida Bruta / Patrimônio','Dívida Bruta/PL','Dív. bruta/PL','Divida bruta/PL'], 'number'],
  ['patrimonioAtivos', ['Patrimônio / Ativos','Patrimônio/Ativos','PL/Ativos'], 'number'],
  ['passivosAtivos', ['Passivos / Ativos','Passivos/Ativos'], 'number'],
  ['liquidezCorrente', ['Liquidez Corrente','Liq. corrente'], 'number'],
  ['cagrReceitas5a', ['CAGR Receitas 5 anos','CAGR Receitas'], 'percent'],
  ['cagrLucros5a', ['CAGR Lucros 5 anos','CAGR Lucros'], 'percent'],
  ['valorDeMercado', ['Valor de Mercado'], 'money'],
  ['valorDeFirma', ['Valor de Firma','Enterprise Value'], 'money'],
  ['patrimonioLiquido', ['Patrimônio Líquido'], 'money'],
  ['ativosTotais', ['Ativos Totais','Total de Ativos'], 'money'],
  ['faturamento12m', ['Faturamento','Receita Líquida','Receita (12M)'], 'money'],
  ['lucro12m', ['Lucro Líquido','Lucro (12M)'], 'money'],
  ['liquidezMediaDiaria', ['Liquidez Média Diária','Liquidez Diária'], 'money'],
  ['freeFloat', ['Free Float'], 'percent'],
  ['tagAlong', ['Tag Along'], 'percent'],
  ['anoEstreiaBolsa', ['Ano de estreia na bolsa', 'Estreia na bolsa'], 'number'],
  ['numeroFuncionarios', ['Número de funcionários', 'Numero de funcionarios', 'Funcionários', 'Funcionarios'], 'number'],
  ['anoFundacao', ['Ano de fundação', 'Ano de fundacao', 'Fundação', 'Fundacao'], 'number'],
  ['segmentoListagem', ['Segmento de Listagem', 'Segmento Listagem'], 'string'],
];

const FII_FIELDS = [
  ['precoAtual', ['Cotação','Preço Atual','Valor atual'], 'money'],
  ['variacaoDay', ['Variação','Var. Dia','Variação no dia'], 'percent'],
  ['variacao12m', ['Variação 12M','VARIAÇÃO (12M)','Var 12M','Valorização (12m)','Valorização 12m','Valorização'], 'percent'],
  ['dividendYield', ['Dividend Yield','DY atual','DY','D.Y'], 'percent'],
  ['pvp', ['P/VP','P / VP'], 'number'],
  ['liquidezDiaria', ['Liquidez Diária','Liquidez'], 'money'],
  ['yield1m', ['Yield 1 mês','Yield 1M','1 mês'], 'percent'],
  ['yield3m', ['Yield 3 meses','Yield 3M','3 meses'], 'percent'],
  ['yield6m', ['Yield 6 meses','Yield 6M','6 meses'], 'percent'],
  ['yield12m', ['Yield 12 meses','Yield 12M','12 meses'], 'percent'],
  ['dyMedio5a', ['DY médio 5 anos','DY Médio 5 anos','DY médio'], 'percent'],
  ['totalDividendos12m', ['Total pago nos últimos 12 meses','Total pago (12M)','Total pago'], 'money'],
  ['ultimoRendimento', ['Último Rendimento','Ultimo Rendimento'], 'money'],
  ['valorPatrimonial', ['Valor Patrimonial por cota','Val. Patrimonial por cota','VP por cota'], 'money'],
  ['valorPatrimonialTotal', ['Valor Patrimonial Total','Val. Patrimonial Total'], 'money'],
  ['patrimonioLiquido', ['Patrimônio Líquido'], 'money'],
  ['numeroCotistas', ['Nº de Cotistas','Número de Cotistas','Cotistas'], 'number'],
  ['cotasEmitidas', ['Cotas Emitidas','Nº de Cotas'], 'number'],
  ['taxaAdministracao', ['Taxa de Administração','Taxa Administração'], 'string'],
  ['tipoFundo', ['Tipo de Fundo','Tipo do Fundo'], 'string'],
  ['segmentoFii', ['Segmento'], 'string'],
  ['mandato', ['Mandato'], 'string'],
  ['publicoAlvo', ['Público Alvo','Publico Alvo'], 'string'],
  ['tipoGestao', ['Tipo de Gestão','Tipo Gestão'], 'string'],
  ['prazoDuracao', ['Prazo de Duração','Prazo Duração'], 'string'],
  ['vacanciaFisica', ['Vacância Física','Vacancia Fisica'], 'percent'],
  ['vacanciaFinanceira', ['Vacância Financeira','Vacancia Financeira'], 'percent'],
  ['pvpMedioTipo', ['P/VP Médio do tipo','P/VP médio'], 'number'],
  ['dyMedioTipo', ['DY Médio do tipo','DY médio do tipo'], 'percent'],
];

function applyFields(text, fields) {
  const out = {};
  for (const [key, labels, kind] of fields) {
    const value = valueAfterLabel(text, labels, kind);
    if (value !== undefined && value !== '') out[key] = value;
  }
  return out;
}

function applyFieldsScoped(text, fields, options = {}) {
  const out = {};
  const stopLabels = options.stopLabels || fields.flatMap(([, labels]) => labels);
  for (const [key, labels, kind] of fields) {
    const value = valueAfterLabelBounded(text, labels, kind, stopLabels);
    if (value !== undefined && value !== '') out[key] = value;
  }
  return out;
}

const FII_STOP_LABELS = [
  'CNPJ', 'MANDATO', 'SEGMENTO', 'TIPO DE FUNDO', 'PRAZO DE DURAÇÃO', 'PRAZO DE DURACAO',
  'TIPO DE GESTÃO', 'TIPO DE GESTAO', 'TAXA DE ADMINISTRAÇÃO', 'TAXA DE ADMINISTRACAO',
  'VACÂNCIA', 'VACANCIA', 'VACÂNCIA FÍSICA', 'VACANCIA FISICA', 'VACÂNCIA FINANCEIRA',
  'VACANCIA FINANCEIRA', 'NÚMERO DE COTISTAS', 'NUMERO DE COTISTAS', 'Nº DE COTISTAS',
  'COTAS EMITIDAS', 'NÚMERO DE COTAS', 'NUMERO DE COTAS', 'PÚBLICO ALVO', 'PUBLICO ALVO',
  'VALOR PATRIMONIAL', 'VAL. PATRIMONIAL', 'VALOR PATRIMONIAL TOTAL', 'PATRIMÔNIO LÍQUIDO',
  'PATRIMONIO LIQUIDO', 'LIQUIDEZ DIÁRIA', 'LIQUIDEZ DIARIA', 'ÚLTIMO RENDIMENTO',
  'ULTIMO RENDIMENTO', 'TOTAL PAGO', 'DIVIDEND YIELD', 'DY', 'P/VP'
];

function trimAtNextLabel(raw = '', stopLabels = [], currentLabels = []) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  const norm = normalizeLoose(text);
  const current = new Set(currentLabels.map(normalizeLoose));
  let cut = text.length;
  for (const label of stopLabels) {
    const nl = normalizeLoose(label);
    if (!nl || current.has(nl)) continue;
    const pos = norm.indexOf(nl, 1);
    if (pos > 0 && pos < cut) cut = pos;
  }
  return text.slice(0, cut).replace(/^[\s:;|–—-]+|[\s:;|–—-]+$/g, '').trim();
}

function valueAfterLabelBounded(text, labels, kind = 'number', stopLabels = [], window = 260) {
  const clean = ` ${String(text || '').replace(/\s+/g, ' ')} `;
  const norm = normalizeLoose(clean);
  for (const label of labels) {
    const nl = normalizeLoose(label);
    const idx = norm.indexOf(nl);
    if (idx === -1) continue;
    const rawAfter = clean.slice(Math.max(0, idx + String(label).length), Math.max(0, idx + String(label).length) + window);
    const chunk = trimAtNextLabel(rawAfter, stopLabels, labels);
    if (!chunk || /^[-—–]+$/.test(chunk)) continue;

    let raw;
    if (kind === 'percent') raw = firstMatch(chunk, /([+-]?\d{1,3}(?:[.,]\d{1,4})?\s*%)/);
    else if (kind === 'money') raw = firstMatch(chunk, /((?:R\$|US\$)?\s*[+-]?\d[\d.]*,?\d*\s*(?:Bilhões|Bilhão|Milhões|Milhão|Trilhões|Trilhão|milhões|milhão|bilhões|bilhão|[KMB])?)/i);
    else if (kind === 'string') raw = chunk;
    else raw = firstMatch(chunk, /([+-]?\d[\d.]*,?\d*\s*(?:Bilhões|Bilhão|Milhões|Milhão|Trilhões|Trilhão|milhões|milhão|bilhões|bilhão|[KMB])?)/i);

    if (raw && !/^[-—–]+$/.test(raw)) {
      if (kind === 'percent') return normalizePercent(raw);
      if (kind === 'string') return cleanFiiTextValue(raw);
      return normalizeNumericString(raw);
    }
  }
  return undefined;
}

function extractFiiInfoSection(text, ticker = '') {
  const t = canonicalizeTicker(ticker);
  const headings = [
    `INFORMAÇÕES SOBRE ${t}`, `Informações sobre ${t}`, 'INFORMAÇÕES SOBRE O FUNDO',
    'INFORMAÇÕES SOBRE', 'DADOS DO FUNDO', 'Dados do Fundo'
  ];
  return sectionSlice(text, headings, [
    'HISTÓRICO DE INDICADORES', 'COMPARAÇÃO DE', 'COMPARANDO COM OUTROS FIIS',
    'Checklist do investidor', 'Distribuições nos últimos', 'DIVIDEND YIELD', 'SOBRE A',
    'Lista de Imóveis', 'COMUNICADOS'
  ], 6500).text;
}

function extractFiiPreciseFields(text, ticker = '') {
  const info = extractFiiInfoSection(text, ticker) || String(text || '').slice(0, 50000);
  const scoped = info.replace(/\s+/g, ' ').trim();
  const out = {};
  const get = (labels, kind, extraStops = []) => valueAfterLabelBounded(scoped, labels, kind, uniq([...FII_STOP_LABELS, ...extraStops]));

  const cnpj = extractCnpj(scoped);
  if (cnpj) out.cnpj = cnpj;

  const mandato = get(['MANDATO'], 'string');
  if (mandato) out.mandato = mandato;
  const segmento = get(['SEGMENTO'], 'string');
  if (segmento) out.segmentoFii = segmento;
  const tipoFundo = get(['TIPO DE FUNDO', 'Tipo do Fundo'], 'string');
  if (tipoFundo) out.tipoFundo = tipoFundo;
  const prazo = get(['PRAZO DE DURAÇÃO', 'PRAZO DE DURACAO'], 'string');
  if (prazo) out.prazoDuracao = prazo;
  const gestao = get(['TIPO DE GESTÃO', 'TIPO DE GESTAO'], 'string');
  if (gestao) out.tipoGestao = gestao;
  const taxa = get(['TAXA DE ADMINISTRAÇÃO', 'TAXA DE ADMINISTRACAO'], 'string');
  if (taxa) out.taxaAdministracao = taxa;
  const publico = get(['PÚBLICO ALVO', 'PUBLICO ALVO'], 'string');
  if (publico) out.publicoAlvo = publico;

  const vacFis = get(['VACÂNCIA FÍSICA', 'VACANCIA FISICA'], 'percent');
  const vacFin = get(['VACÂNCIA FINANCEIRA', 'VACANCIA FINANCEIRA'], 'percent');
  const vac = get(['VACÂNCIA', 'VACANCIA'], 'percent');
  if (vacFis) out.vacanciaFisica = vacFis;
  else if (vac) out.vacanciaFisica = vac;
  if (vacFin) out.vacanciaFinanceira = vacFin;

  const cotistas = get(['NÚMERO DE COTISTAS', 'NUMERO DE COTISTAS', 'Nº DE COTISTAS'], 'number');
  if (cotistas !== undefined) out.numeroCotistas = cotistas;
  const cotas = get(['COTAS EMITIDAS', 'NÚMERO DE COTAS', 'NUMERO DE COTAS'], 'number');
  if (cotas !== undefined) out.cotasEmitidas = cotas;

  const vpCota = get(['VAL. PATRIMONIAL P/ COTA', 'VALOR PATRIMONIAL POR COTA', 'VP POR COTA'], 'money');
  if (vpCota !== undefined) out.valorPatrimonial = vpCota;
  const vpTotal = get(['VALOR PATRIMONIAL TOTAL', 'VAL. PATRIMONIAL TOTAL'], 'money');
  if (vpTotal !== undefined) {
    out.valorPatrimonialTotal = vpTotal;
    out.patrimonioLiquido = vpTotal;
  }

  out._sourceTextLength = scoped.length;
  return out;
}

function parseComparisonValue(raw, kind = 'number') {
  if (!raw) return undefined;
  const clean = String(raw).replace(/\s+/g, ' ').trim();
  if (kind === 'percent') return normalizePercent(clean);
  if (kind === 'money') return normalizeNumericString(clean);
  return normalizeNumericString(clean);
}

function extractMediaTipoSegmentoStructured(text, ticker = '') {
  const tickerUpper = canonicalizeTicker(ticker);
  const sec = sectionSlice(text, ['Média do Tipo e Segmento', 'Média do Tipo', 'Média do Segmento'], ['Comentários', 'Últimas notícias', 'COMUNICADOS', 'SOBRE', 'Lista de Imóveis'], 7000).text;
  if (!sec) return null;
  const compact = sec.replace(/\s+/g, ' ').trim();
  const find = (label, kind) => {
    const idx = normalizeLoose(compact).indexOf(normalizeLoose(label));
    if (idx === -1) return null;
    const chunk = compact.slice(idx + label.length, idx + label.length + 220).replace(new RegExp(`^\\s*${escapeRe(tickerUpper)}\\s*`, 'i'), '');
    const beforeComp = chunk.split(/Comparação|Comparacao/i)[0];
    const afterComp = chunk.split(/Comparação|Comparacao/i)[1] || '';
    let ativoRaw;
    let compRaw;
    if (kind === 'percent') {
      ativoRaw = firstMatch(beforeComp, /([+-]?\d[\d.,]*\s*%)/);
      compRaw = firstMatch(afterComp, /([+-]?\d[\d.,]*\s*%)/);
    } else if (kind === 'money') {
      ativoRaw = firstMatch(beforeComp, /((?:R\$)?\s*\d[\d.,]*\s*(?:Bilhões|Bilhão|Milhões|Milhão|milhões|bilhões)?)/i);
      compRaw = firstMatch(afterComp, /((?:R\$)?\s*\d[\d.,]*\s*(?:Bilhões|Bilhão|Milhões|Milhão|milhões|bilhões)?)/i);
    } else {
      ativoRaw = firstMatch(beforeComp, /(\d[\d.,]*)/);
      compRaw = firstMatch(afterComp, /(\d[\d.,]*)/);
    }
    const ativo = parseComparisonValue(ativoRaw, kind);
    const comparacao = parseComparisonValue(compRaw, kind);
    return ativo !== undefined || comparacao !== undefined ? { ativo, comparacao, ativoRaw: ativoRaw || '', comparacaoRaw: compRaw || '' } : null;
  };
  const out = {
    pvp: find('P/VP', 'number'),
    dy12m: find('DY (12M)', 'percent') || find('Dividend Yield', 'percent') || find('DY 12M', 'percent'),
    valorPatrimonial: find('VALOR PATRIMONIAL', 'money'),
    valorPatrimonialPorCota: find('VAL. PATRIMONIAL P/ COTA', 'money') || find('VALOR PATRIMONIAL POR COTA', 'money') || find('VP/COTA', 'money'),
    rawText: compact.slice(0, 2200),
  };
  // Fallback para o layout textual que vem como: "GARE11 P/VP : 0,89 Comparação 0,81".
  const rx = (label, regex, kind) => {
    if (out[label]) return;
    const m = compact.match(regex);
    if (!m) return;
    const ativoRaw = m[1];
    const comparacaoRaw = m[2] || '';
    out[label] = { ativo: parseComparisonValue(ativoRaw, kind), comparacao: parseComparisonValue(comparacaoRaw, kind), ativoRaw, comparacaoRaw };
  };
  rx('pvp', new RegExp(`${escapeRe(tickerUpper)}\s+P\/VP\s*:?\s*(\d[\d.,]*)(?:\s+Compara[cç][aã]o\s*(\d[\d.,]*))?`, 'i'), 'number');
  rx('dy12m', new RegExp(`${escapeRe(tickerUpper)}\s+(?:DY\s*\(12M\)|Dividend Yield)\s*:?\s*([+-]?\d[\d.,]*\s*%)(?:\s+Compara[cç][aã]o\s*([+-]?\d[\d.,]*\s*%))?`, 'i'), 'percent');
  rx('valorPatrimonial', new RegExp(`${escapeRe(tickerUpper)}\s+VALOR PATRIMONIAL\s*:?\s*((?:R\$)?\s*\d[\d.,]*\s*(?:Bilhões|Bilhão|Milhões|Milhão|[KMB])?)(?:\s+Compara[cç][aã]o\s*((?:R\$)?\s*\d[\d.,]*\s*(?:Bilhões|Bilhão|Milhões|Milhão|[KMB])?))?`, 'i'), 'money');
  rx('valorPatrimonialPorCota', new RegExp(`${escapeRe(tickerUpper)}\s+VAL\.?\s*PATRIMONIAL\s*P\/?\s*COTA\s*:?\s*((?:R\$)?\s*\d[\d.,]*)(?:\s+Compara[cç][aã]o\s*((?:R\$)?\s*\d[\d.,]*))?`, 'i'), 'money');
  return Object.values(out).some(v => v && typeof v === 'object' && (v.ativo !== undefined || v.comparacao !== undefined)) ? out : { rawText: compact.slice(0, 2200) };
}

function pruneBadSectionSummaries(sections = {}) {
  for (const key of ['rentabilidade', 'indicadores', 'mediaTipoSegmento']) {
    const item = sections[key];
    if (item && typeof item === 'object' && typeof item.text === 'string' && looksLikeNavigationBlock(item.text)) {
      delete sections[key];
    }
  }
  return sections;
}

function sanitizeFiiBaseFields(baseFields, text, ticker, genericSections) {
  const precise = extractFiiPreciseFields(text, ticker);
  delete precise._sourceTextLength;
  const out = { ...baseFields, ...precise };

  // Remove valores capturados do checklist em vez da seção cadastral.
  if (out.numeroCotistas !== undefined && Number(out.numeroCotistas) <= 1000 && precise.numeroCotistas === undefined) delete out.numeroCotistas;
  if (out.vacanciaFisica === '10%' && precise.vacanciaFisica === undefined) delete out.vacanciaFisica;
  if (out.vacanciaFinanceira === '10%' && precise.vacanciaFinanceira === undefined) delete out.vacanciaFinanceira;

  for (const k of ['taxaAdministracao','tipoFundo','segmentoFii','mandato','tipoGestao','prazoDuracao','publicoAlvo']) {
    if (typeof out[k] === 'string') {
      out[k] = cleanFiiTextValue(trimAtNextLabel(out[k], FII_STOP_LABELS)).slice(0, 160).trim();
      if (!out[k]) delete out[k];
    }
  }

  const media = extractMediaTipoSegmentoStructured(text, ticker);
  if (media) {
    if (media.pvp?.ativo !== undefined) out.pvp = media.pvp.ativo;
    if (media.dy12m?.ativo !== undefined) out.yield12m = media.dy12m.ativo;
    if (media.valorPatrimonial?.ativo !== undefined) {
      out.valorPatrimonialTotal = media.valorPatrimonial.ativo;
      out.patrimonioLiquido = media.valorPatrimonial.ativo;
    }
    if (media.valorPatrimonialPorCota?.ativo !== undefined) out.valorPatrimonial = media.valorPatrimonialPorCota.ativo;
    genericSections.mediaTipoSegmento = media;
  }
  return out;
}

function normalizeLoose(input = '') {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%$.,/()\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeNavigationBlock(snippet = '') {
  const n = normalizeLoose(snippet);
  const hits = [
    'ativos mais buscados', 'acoes mais buscadas', 'fiis mais buscados',
    'rankings de acoes', 'rankings de fiis', 'ferramentas gerenciador',
    'ver todos setores', 'mais buscados petr4', 'mais buscados kncr11',
    'conversor de criptos', 'renda fixa mais buscadas'
  ].filter(x => n.includes(x)).length;
  const manyMenus = (n.match(/mais buscad/g) || []).length >= 3 || (n.match(/ver todos/g) || []).length >= 3;
  return hits >= 2 || manyMenus;
}

function sectionSlice(text, headings, nextHeadings = [], maxLen = 7000) {
  const source = String(text || '');
  const lower = source.toLowerCase();
  const candidates = [];

  for (const h of headings) {
    const needle = h.toLowerCase();
    let from = 0;
    while (needle && from < lower.length) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const snippet = source.slice(idx, idx + Math.min(1600, maxLen));
      let score = idx;
      if (looksLikeNavigationBlock(snippet)) score += 2_000_000;
      // Prefer headings that look like actual content blocks, often followed by useful domain words.
      const useful = normalizeLoose(snippet).match(/dividend|cotista|patrimonial|p\/vp|yield|comunicado|imoveis|balanco|receita|lucro|checklist|vacancia|comparacao/);
      if (useful) score -= 10_000;
      candidates.push({ idx, heading: h, score });
      from = idx + needle.length;
    }
  }

  if (!candidates.length) return { heading: '', text: '' };
  candidates.sort((a, b) => a.score - b.score || a.idx - b.idx);
  const { idx: start, heading: used } = candidates[0];

  let end = Math.min(source.length, start + maxLen);
  const defaultNext = [
    'Histórico de Dividendos', 'RADAR DE DIVIDENDOS', 'COMPARADOR', 'COMPARAÇÃO',
    'SOBRE A EMPRESA', 'SOBRE O FUNDO', 'DADOS SOBRE', 'INFORMAÇÕES SOBRE',
    'Regiões onde', 'Negócios que', 'POSIÇÃO ACIONÁRIA', 'Receitas e Lucros',
    'LUCRO X COTAÇÃO', 'Resultados', 'EVOLUÇÃO DO PATRIMÔNIO', 'BALANÇO PATRIMONIAL',
    'COMUNICADOS', 'Lista de Imóveis', 'Distribuições nos últimos', 'DIVIDEND YIELD',
    'Média do Tipo', 'Média do Segmento', 'Comentários', 'Últimas notícias'
  ];
  const stops = uniq([...(nextHeadings || []), ...defaultNext]).filter(h => normalizeLoose(h) !== normalizeLoose(used));
  for (const h of stops) {
    const needle = h.toLowerCase();
    const found = lower.indexOf(needle, start + used.length + 20);
    if (found !== -1 && found < end) end = found;
  }
  return { heading: used, text: source.slice(start, end).trim() };
}

function normalizeDividendDateText(d) {
  const m = String(d || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/);
  if (!m) return '';
  const yy = String(m[3]);
  const year = yy.length === 2 ? `20${yy}` : yy;
  return `${String(m[1]).padStart(2, '0')}/${String(m[2]).padStart(2, '0')}/${year}`;
}

function extractDividendHistory(text) {
  const out = [];
  const seen = new Set();
  const typePattern = 'Dividendos|JSCP|JCP|Rend\.?\s*Trib\.?|Rendimento|Rendimentos|Amortização|Amortizacao|Red\.?\s*Cap\.?';
  const datePattern = '\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})';
  const re = new RegExp(`(${typePattern})\s+(${datePattern})\s+(?:(${datePattern})\s+)?(?:R\$\s*)?([-\d,.]{1,18})`, 'gi');
  let m;
  while ((m = re.exec(text)) && out.length < 360) {
    const valor = Number(String(m[4]).replace(/R\$/gi, '').replace(/-/g, '0').replace(/\./g, '').replace(',', '.'));
    const tipo = m[1].replace(/\s+/g, ' ').trim().replace(/Amortizacao/i, 'Amortização');
    const dataCom = normalizeDividendDateText(m[2]);
    const dataPagamento = normalizeDividendDateText(m[3] || '');
    const item = {
      tipo,
      type: tipo,
      dataCom,
      dateCom: dataCom,
      dataPagamento,
      paymentDate: dataPagamento,
      valor,
      valuePerShare: valor,
      source: 'Investidor10 Página do Ativo'
    };
    const key = `${item.tipo}|${item.dataCom}|${item.dataPagamento}|${item.valor}`;
    if (Number.isFinite(item.valor) && (item.dataCom || item.dataPagamento) && !seen.has(key)) { seen.add(key); out.push(item); }
  }
  return out;
}

function parseHtmlTables(html, maxTables = 40) {
  const tables = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let t;
  while ((t = tableRe.exec(html)) && tables.length < maxTables) {
    const tableHtml = t[0];
    const rows = [];
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    let r;
    while ((r = rowRe.exec(tableHtml)) && rows.length < 200) {
      const cells = [];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let c;
      while ((c = cellRe.exec(r[0])) && cells.length < 30) {
        cells.push(stripTags(c[1]).replace(/\s+/g, ' ').trim());
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push({ index: tables.length, rows });
  }
  return tables;
}

function extractTablesByKeywords(tables, keywords) {
  const lowKeys = keywords.map(k => k.toLowerCase());
  return tables.filter(table => {
    const text = table.rows.flat().join(' ').toLowerCase();
    return lowKeys.some(k => text.includes(k));
  });
}

function extractChecklist(text, type = '') {
  const sec = sectionSlice(text, ['Checklist do investidor buy and hold', 'Checklist Buy and Hold', 'Buy and Hold'],
    ['Histórico de Dividendos', 'Radar de Dividendos', 'Payout', 'Comparador', 'Sobre a empresa', 'COMUNICADOS', 'Carteira Investidor'], 7000).text;
  if (!sec) return [];
  const normalized = sec.replace(/\s+/g, ' ').trim();
  const known = String(type || '').toUpperCase() === 'FII' ? [
    'FII com mais de 5 anos listado em Bolsa',
    'Dividend Yield médio dos últimos 24 meses acima de 9%',
    'Dividend Yield médio dos últimos 5 anos acima de 8%',
    'Liquidez média diária acima de R$ 1 milhão',
    'Liquidez média diária acima de R$ 700 mil',
    'Número de cotistas acima de 20 mil',
    'Patrimônio líquido acima de R$ 500 milhões',
    'Patrimônio líquido acima de R$ 1 bilhão',
    '5 ou mais imóveis no portfólio',
    'Vacância física média dos últimos 12 meses abaixo de 10%',
    'Vacância financeira média dos últimos 12 meses abaixo de 10%'
  ] : [
    'Empresa com mais de 5 anos de Bolsa',
    'Empresa nunca deu prejuízo (ano fiscal)',
    'Empresa com lucro nos últimos 20 trimestres (5 anos)',
    'Empresa pagou +5% de dividendos/ano nos últimos 5 anos',
    'Empresa possui ROE acima de 10%',
    'Empresa possui dívida menor que patrimônio',
    'Empresa apresentou crescimento de receita nos últimos 5 anos',
    'Empresa apresentou crescimento de lucros nos últimos 5 anos',
    'Empresa possui liquidez diária acima de US$ 2M',
    'Empresa é bem avaliada pelos usuários do Investidor10'
  ];
  const out = [];
  const seen = new Set();
  for (const label of known) {
    if (normalized.toLowerCase().includes(label.toLowerCase())) {
      const key = normalizeLoose(label);
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ criterio: label, aprovado: undefined, source: 'Investidor10 checklist buy and hold' });
      }
    }
  }
  if (out.length) return out;
  const lines = normalized
    .replace(/(Empresa|FII)\s+(?=(?:com|nunca|pagou|possui|apresentou|é|listado))/g, '\n$1 ')
    .split(/\n|(?<=\?)\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (out.length >= 30) break;
    if (/checklist|buy and hold|ranking|pontua|recomendação|recomendacao|clique aqui/i.test(line)) continue;
    if (line.length < 10) continue;
    const aprovado = /sim|aprovado|ok|✓|positivo/i.test(line) ? true : (/não|nao|reprovado|negativo|x/i.test(line) ? false : undefined);
    out.push({ criterio: line.slice(0, 260), aprovado, source: 'Investidor10 checklist buy and hold' });
  }
  return out;
}

function extractComunicados(html, text) {
  const section = sectionSlice(text, ['COMUNICADOS', 'Comunicados'], ['Veja também', 'Mais sobre', 'Indicadores'], 9000).text;
  const candidates = [];
  const linkRe = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html)) && candidates.length < 300) {
    const href = absolutize(m[1], 'https://investidor10.com.br');
    const label = stripTags(m[2]).replace(/\s+/g, ' ').trim();
    const hay = `${href} ${label}`.toLowerCase();
    if (!label || label.length < 4) continue;
    if (/comunic|fato-relevante|informe|relatorio|resultado|provento|dividendo|noticia|news/i.test(hay)) {
      candidates.push({ title: label.slice(0, 220), link: href, date: firstMatch(label, /(\d{2}\/\d{2}\/\d{4})/) });
    }
  }
  const fromText = [];
  const re = /(\d{2}\/\d{2}\/\d{4})\s+([^\n]{8,220})/g;
  let x;
  while (section && (x = re.exec(section)) && fromText.length < 80) {
    fromText.push({ date: x[1], title: x[2].trim() });
  }
  const all = [...candidates, ...fromText];
  const seen = new Set();
  return all.filter(item => {
    const key = `${item.date || ''}|${item.title}|${item.link || ''}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 80);
}

function absolutize(href, base) {
  try { return new URL(href, base).toString(); } catch { return href; }
}

function extractLinks(html, baseUrl) {
  const links = [];
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && links.length < 400) {
    const title = stripTags(m[2]).replace(/\s+/g, ' ').trim();
    if (title) links.push({ title: title.slice(0, 180), href: absolutize(m[1], baseUrl) });
  }
  return links;
}

function extractImoveis(text, tables) {
  const sec = sectionSlice(text, ['Lista de Imóveis', 'Imóveis', 'Lista de Imoveis'], ['COMUNICADOS', 'Média do Tipo', 'Dividend Yield'], 12000).text;
  const imovelTables = extractTablesByKeywords(tables, ['ABL', 'Estado', 'Cidade', 'Área', 'Vacância', 'Imóvel']);
  const fromTables = imovelTables.flatMap(table => table.rows.slice(1).map(row => ({ row }))).slice(0, 150);
  const fromText = [];
  const re = /([A-Z]{2})\s+([^\n]{3,90})\s+(?:ABL\s*)?([\d.,]+\s*m²|[\d.,]+\s?m2)?/gi;
  let m;
  while (sec && (m = re.exec(sec)) && fromText.length < 80) {
    fromText.push({ estado: m[1], nome: m[2].trim(), abl: m[3] || undefined });
  }
  return fromTables.length ? fromTables : fromText;
}

function extractGenericSectionData(text, tables) {
  const headings = {
    rentabilidade: ['Rentabilidade'],
    indicadores: ['INDICADORES', 'Indicadores'],
    historicoIndicadores: ['Histórico de Indicadores', 'HISTÓRICO DE INDICADORES'],
    checklistBah: ['Checklist do investidor buy and hold', 'CHECKLIST DO INVESTIDOR BUY AND HOLD'],
    radarDividendos: ['RADAR DE DIVIDENDOS', 'Radar de Dividendos'],
    comparadorAcoes: ['COMPARADOR DE AÇÕES', 'Comparador de Ações'],
    comparador: ['COMPARADOR', 'Comparador'],
    comparacaoIndices: ['COMPARAÇÃO DE', 'Comparação com Índices', 'COMPARAÇÃO COM ÍNDICES'],
    comparacaoFiis: ['COMPARANDO COM OUTROS FIIS', 'Comparando com outros FIIs', 'Outros FIIs'],
    comparacaoCommodity: ['Petróleo Brent', 'Brent'],
    sobre: ['SOBRE A EMPRESA', 'SOBRE O FUNDO', 'SOBRE A', 'Sobre a empresa', 'Sobre o fundo'],
    dadosEmpresa: ['DADOS SOBRE A EMPRESA', 'Dados sobre a empresa'],
    informacoesEmpresa: ['INFORMAÇÕES SOBRE A EMPRESA', 'Informações sobre a empresa'],
    regioesReceita: ['Regiões onde', 'Regiões onde gera receita'],
    negociosReceita: ['Negócios que geram receita', 'Negocios que geram receita'],
    posicaoAcionaria: ['POSIÇÃO ACIONÁRIA', 'Posição acionária'],
    receitasLucros: ['Receitas e Lucros'],
    lucroCotacao: ['LUCRO X COTAÇÃO', 'Lucro x Cotação'],
    resultados: ['Resultados'],
    evolucaoPatrimonio: ['EVOLUÇÃO DO PATRIMÔNIO', 'Evolução do Patrimônio'],
    balancoPatrimonial: ['BALANÇO PATRIMONIAL', 'Balanço Patrimonial'],
    distribuicoes12m: ['Distribuições nos últimos 12 meses', 'Distribuicoes nos ultimos 12 meses'],
    dividendYieldSecao: ['DIVIDEND YIELD', 'Dividend Yield'],
    valorPatrimonial: ['Informações sobre valor patrimonial', 'Valor Patrimonial'],
    mediaTipoSegmento: ['Média do Tipo e Segmento', 'Média do Tipo', 'Média do Segmento'],
  };
  const sections = {};
  for (const [key, hs] of Object.entries(headings)) {
    const s = sectionSlice(text, hs, [], key === 'sobre' ? 3000 : 9000).text;
    if (s) sections[key] = summarizeSection(s);
  }
  sections.tables = {
    dividendos: extractTablesByKeywords(tables, ['data com', 'pagamento', 'valor', 'dividendos', 'jscp']).slice(0, 4),
    indicadores: extractTablesByKeywords(tables, ['p/l', 'p/vp', 'roe', 'dy', 'ev/ebitda']).slice(0, 6),
    demonstrativos: extractTablesByKeywords(tables, ['receita', 'lucro', 'patrimônio', 'ativo', 'passivo']).slice(0, 8),
  };
  return sections;
}

function summarizeSection(sec) {
  const compact = sec.replace(/\s+/g, ' ').trim();
  const pairs = extractPairsFromText(compact);
  return {
    text: compact.slice(0, 1800),
    keyValues: pairs.slice(0, 80),
    length: compact.length,
  };
}

function extractPairsFromText(text) {
  const out = [];
  const re = /([A-Za-zÀ-ÿ0-9 ./%()ºª-]{2,45})\s+(R\$\s*[\d.,]+(?:\s*(?:Bilhões|Bilhão|Milhões|Milhão|Trilhões|Trilhão))?|[+-]?[\d.,]+\s*%|[+-]?[\d.,]+)/gi;
  let m;
  while ((m = re.exec(text)) && out.length < 120) {
    const label = m[1].trim();
    if (label.length < 2 || /^(R\$|US\$)$/.test(label)) continue;
    out.push({ label, value: m[2].trim() });
  }
  return out;
}

function extractChartCandidates(html) {
  const scripts = [];
  const re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) && scripts.length < 40) {
    const body = m[1];
    if (/series|categories|labels|data:|chart|grafico|Highcharts|ApexCharts|Chart\(/i.test(body)) {
      const candidate = body.replace(/\s+/g, ' ').trim();
      if (candidate.length > 80) {
        scripts.push({
          kind: detectChartKind(candidate),
          size: candidate.length,
          preview: candidate.slice(0, 1200),
          numbersFound: (candidate.match(/[+-]?\d+(?:[.,]\d+)?/g) || []).slice(0, 80),
        });
      }
    }
  }
  return scripts.slice(0, 12);
}

function detectChartKind(text) {
  if (/Highcharts/i.test(text)) return 'highcharts';
  if (/ApexCharts/i.test(text)) return 'apexcharts';
  if (/Chart\(/i.test(text)) return 'chartjs';
  return 'script-data';
}


function isGenericInvestidor10Logo(url = '') {
  const u = String(url || '').trim();
  return !u || /(?:assets\/front\/images\/logo|logo\.webp|favicon|icon)/i.test(u);
}

function isGenericAboutText(text = '') {
  const compact = stripTags(text).replace(/\s+/g, ' ').trim();
  if (!compact) return true;
  if (/^Tudo sobre finanças, investimentos, ações, indicadores fundamentalistas/i.test(compact)) return true;
  if (/^Tudo sobre (?:as ações|a ação|o ativo|os FIIs|o FII|fundos imobiliários)/i.test(compact)) return true;
  if (/resultados, dividendos.*cotação.*indicadores fundamentalistas.*gráficos/i.test(compact) && compact.length < 360) return true;
  if (/Preço Justo|Graham|Bazin|Radar de Dividendos|Calculadora|Comparador de/i.test(compact)) return true;
  if (/Mostra o rendimento|Magic Number|valor patrimonial é um item determinante|Um maior Yield sugere|Fórmula do Magic Number/i.test(compact)) return true;
  if (/Publicado em|ADICIONAR NA CARTEIRA|Saiba mais/i.test(compact) && compact.length < 500) return true;
  if (looksLikeNavigationBlock(compact)) return true;
  return false;
}

function cleanAboutCandidate(text = '') {
  const compact = stripTags(text).replace(/\s+/g, ' ').trim();
  if (compact.length < 80) return '';
  if (isGenericAboutText(compact)) return '';
  return compact.slice(0, 4500);
}

function cleanFiiTextValue(value = '') {
  let s = stripTags(value).replace(/\s+/g, ' ').trim();
  s = s.replace(/^[:;|–—-]+\s*/, '').trim();
  // Algumas páginas inserem um "O" isolado antes do valor por causa de marcação/ícone do card.
  s = s.replace(/^O\s+(?=(?:Fundo|H[ií]brid|Ativ|Passiv|Indeterminad|Determinado|Investidor|Cotista|0|R\$|\d))/i, '');
  s = s.replace(/\s+O\s*$/i, '').trim();
  return s;
}

function extractMetaDescription(html = '') {
  const source = String(html || '');
  const meta = source.match(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
               source.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["'](?:description|og:description)["']/i)?.[1];
  return meta ? decodeHtml(meta).replace(/\s+/g, ' ').trim() : '';
}

function extractJsonLdDescriptions(html = '') {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) && out.length < 8) {
    try {
      const parsed = JSON.parse(decodeHtml(m[1]).trim());
      const list = Array.isArray(parsed) ? parsed : (parsed?.['@graph'] ? parsed['@graph'] : [parsed]);
      for (const item of list) {
        const d = item?.description || item?.articleBody || item?.about?.description;
        const c = cleanAboutCandidate(d || '');
        if (c) out.push(c);
      }
    } catch { /* ignora jsonld ruim */ }
  }
  return out;
}

function looksLikeAboutSubheading(line = '') {
  const clean = String(line || '').replace(/^[#\s]+/, '').replace(/[:;]+$/, '').trim();
  if (clean.length < 5 || clean.length > 100) return false;
  return /^(?:sobre\s+a|sobre\s+o|hist[oó]ria|estrat[eé]gia|composi[cç][aã]o|diversifica[cç][aã]o|exposi[cç][aã]o|estrutura|taxas|portf[oó]lio|carteira|opera[cç][oõ]es|atividade|atua[cç][aã]o|o que faz)/i.test(clean);
}

function cleanAboutNarrativeLine(line = '') {
  return String(line || '')
    .replace(/^[#*\s]+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

function cleanAboutSectionText(raw = '', type = '') {
  let s = stripTags(raw || '').replace(/\u00a0/g, ' ').replace(/\r/g, '\n');
  s = s.replace(/M[eé]dia de avalia[cç][oõ]es dos usu[aá]rios:[\s\S]*?(?=SOBRE A EMPRESA|SOBRE O FUNDO|Sobre a|Sobre o|$)/i, ' ');
  s = s.replace(/Avalie\s+Deixar de seguir\s+Seguir/gi, ' ');
  s = s.replace(/Avalie\s+Seguir/gi, ' ');
  s = s.replace(/Isso n[aã]o [eé] uma recomenda[cç][aã]o de compra\/venda\.?/gi, ' ');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  const stopMatch = s.search(/\n+\s*(?:DADOS SOBRE|INFORMAÇÕES SOBRE|COMUNICADOS|Informações sobre valor patrimonial|M[eé]dia do Tipo|Notícias sobre|FIIs Relacionad[ao]s|Ativos Relacionados)\b/i);
  if (stopMatch > 0) s = s.slice(0, stopMatch).trim();
  if (type === 'FII') {
    const stopAdditional = s.search(/\n+\s*Informações Adicionais\b/i);
    if (stopAdditional > 0) s = s.slice(0, stopAdditional).trim();
  }
  s = s.replace(/^SOBRE\s+(?:A|O)[^\n]*\n?/i, '').trim();
  return s;
}

function splitAboutNarrativeBlocks(sectionText = '', type = '', ticker = '') {
  const lines = cleanAboutSectionText(sectionText, type)
    .split(/\n+/)
    .map(cleanAboutNarrativeLine)
    .filter(Boolean)
    .filter(line => !/^(?:Avalie|Deixar de seguir|Seguir|×|Fechar|Adicionar ativo|Compartilhar ativo)$/i.test(line));
  const blocks = [];
  let current = { title: type === 'FII' ? 'Sobre o fundo' : 'Sobre a empresa', parts: [] };
  const flush = () => {
    const textBlock = current.parts.join(' ').replace(/\s+/g, ' ').trim();
    if (textBlock.length >= 80 && !isGenericAboutText(textBlock)) {
      blocks.push({
        title: current.title,
        text: textBlock.slice(0, 1600),
        source: 'Investidor10 Página do Ativo'
      });
    }
  };
  for (const line of lines) {
    if (/^SOBRE\s+(?:A|O)\b/i.test(line)) continue;
    if (looksLikeAboutSubheading(line)) {
      flush();
      current = { title: line.replace(/^#+\s*/, '').slice(0, 90), parts: [] };
      continue;
    }
    if (/^Informações Adicionais$/i.test(line)) break;
    if (/^M[eé]dia de avalia[cç][oõ]es/i.test(line)) continue;
    current.parts.push(line);
  }
  flush();
  return uniqBy(blocks, b => `${normalizeLoose(b.title)}|${normalizeLoose(b.text).slice(0, 120)}`).slice(0, 8);
}

function extractInvestidor10AboutPresentation(html = '', text = '', ticker = '', type = '') {
  const section = sectionSlice(text, [
    'SOBRE A EMPRESA', 'Sobre a empresa', `SOBRE A ${ticker}`, 'SOBRE O FUNDO', 'Sobre o fundo', `SOBRE A ${ticker}`
  ], [
    'DADOS SOBRE A EMPRESA', 'INFORMAÇÕES SOBRE A EMPRESA', 'DADOS SOBRE O FUNDO', 'INFORMAÇÕES SOBRE O FUNDO',
    'COMUNICADOS', 'Lista de Imóveis', 'Média do Tipo', 'Dividend Yield', 'Informações sobre valor patrimonial', 'Notícias sobre'
  ], 10000).text;

  const blocks = splitAboutNarrativeBlocks(section, type, ticker);
  const summary = blocks[0]?.text || '';
  if (summary) {
    return {
      summary,
      sections: blocks,
      source: 'Investidor10 Página do Ativo',
      sourceFidelity: 'exact',
      capturedFrom: type === 'FII' ? 'SOBRE O FUNDO' : 'SOBRE A EMPRESA',
      updatedAt: new Date().toISOString(),
    };
  }

  const fallbackCandidates = [...extractJsonLdDescriptions(html), extractMetaDescription(html)].map(cleanAboutCandidate).filter(Boolean);
  const fallback = fallbackCandidates.find(candidate => !isGenericAboutText(candidate)) || '';
  if (!fallback) return null;
  return {
    summary: fallback,
    sections: [{ title: type === 'FII' ? 'Sobre o fundo' : 'Sobre a empresa', text: fallback, source: 'Investidor10 descrição SEO' }],
    source: 'Investidor10 descrição SEO',
    sourceFidelity: 'derived',
    capturedFrom: 'meta-description'
  };
}

function extractCompanyCadastroInfo(text = '') {
  const dataSection = sectionSlice(text, ['DADOS SOBRE A EMPRESA', 'Dados sobre a empresa'], ['INFORMAÇÕES SOBRE A EMPRESA', 'Regiões onde', 'Negócios que', 'POSIÇÃO ACIONÁRIA', 'Receitas e Lucros'], 2500).text;
  const infoSection = sectionSlice(text, ['INFORMAÇÕES SOBRE A EMPRESA', 'Informações sobre a empresa'], ['Regiões onde', 'Negócios que', 'POSIÇÃO ACIONÁRIA', 'Receitas e Lucros'], 4200).text;
  const compactData = dataSection.replace(/\s+/g, ' ').trim();
  const compactInfo = infoSection.replace(/\s+/g, ' ').trim();
  const out = {};
  const numberFrom = (source, label) => valueAfterLabelBounded(source, [label], 'number', [
    'Nome da Empresa', 'CNPJ', 'Ano de estreia na bolsa', 'Número de funcionários', 'Ano de fundação', 'Papéis da empresa', 'Papéis Fracionados'
  ], 180);
  const stringFrom = (source, label, stops) => valueAfterLabelBounded(source, [label], 'string', stops, 240);
  const cnpj = extractCnpj(compactData);
  if (cnpj) out.cnpj = cnpj;
  const nomeCompleto = stringFrom(compactData, 'Nome da Empresa', ['CNPJ', 'Ano de estreia na bolsa', 'Número de funcionários', 'Ano de fundação']);
  if (nomeCompleto) out.nomeCompleto = nomeCompleto;
  const anoEstreiaBolsa = numberFrom(compactData, 'Ano de estreia na bolsa');
  if (anoEstreiaBolsa !== undefined) out.anoEstreiaBolsa = anoEstreiaBolsa;
  const numeroFuncionarios = numberFrom(compactData, 'Número de funcionários');
  if (numeroFuncionarios !== undefined) out.numeroFuncionarios = numeroFuncionarios;
  const anoFundacao = numberFrom(compactData, 'Ano de fundação');
  if (anoFundacao !== undefined) out.anoFundacao = anoFundacao;
  const papelMatches = [...compactData.matchAll(/\b([A-Z]{4}\d{1,2}F?)\b/g)].map(m => m[1]);
  const papeis = uniq(papelMatches.filter(code => !/F$/.test(code))).slice(0, 8);
  const fracionados = uniq(papelMatches.filter(code => /F$/.test(code))).slice(0, 8);
  if (papeis.length) out.papeisEmpresa = papeis.join(', ');
  if (fracionados.length) out.papeisFracionados = fracionados.join(', ');

  const getInfo = (label, kind, aliases = []) => valueAfterLabelBounded(compactInfo, [label, ...aliases], kind, [
    'Valor de mercado', 'Valor de firma', 'Patrimônio Líquido', 'Nº total de papeis', 'Ativos', 'Ativo Circulante',
    'Dívida Bruta', 'Dívida Líquida', 'Disponibilidade', 'Segmento de Listagem', 'Free Float', 'Tag Along', 'Liquidez Média Diária', 'Setor', 'Segmento'
  ], 280);
  const listing = getInfo('Segmento de Listagem', 'string');
  if (listing) out.segmentoListagem = listing;
  const shares = getInfo('Nº total de papeis', 'number', ['Nº total de papéis', 'Total de papéis']);
  if (shares !== undefined) out.numeroAcoes = shares;
  return out;
}

function extractAboutCompany(html = '', text = '', ticker = '', type = '') {
  const presentation = extractInvestidor10AboutPresentation(html, text, ticker, type);
  if (presentation?.summary && !isGenericAboutText(presentation.summary)) return presentation.summary;

  const candidates = [];
  for (const d of extractJsonLdDescriptions(html)) candidates.push(d);
  const meta = extractMetaDescription(html);
  if (meta) candidates.push(meta);

  for (const c of candidates) {
    const cleaned = cleanAboutCandidate(c);
    if (cleaned) return cleaned;
  }
  return '';
}

function normalizeJsLikeJson(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (s.endsWith(';')) s = s.slice(0, -1).trim();
  s = s
    .replace(/\bundefined\b/g, 'null')
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bInfinity\b/g, 'null')
    .replace(/,\s*([}\]])/g, '$1');
  // Converte chaves JS-like simples para JSON sem executar conteúdo externo.
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3');
  // Converte strings com aspas simples em strings JSON simples. Não tenta suportar
  // expressões, funções ou template strings: se não for JSON seguro, retorna null.
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => JSON.stringify(String(inner).replace(/\\'/g, "'")));
  return s;
}

function safeParseJson(raw) {
  if (!raw) return null;
  const candidates = [String(raw).trim(), decodeHtml(String(raw).trim())]
    .flatMap(s => [s, normalizeJsLikeJson(s)]);
  for (const candidate of candidates) {
    if (!candidate) continue;
    try { return JSON.parse(candidate); } catch {}
  }
  return null;
}

function extractJsonAssignment(html = '', patterns = []) {
  const source = String(html || '');
  for (const pattern of patterns) {
    const re = typeof pattern === 'string'
      ? new RegExp(`${escapeRe(pattern)}\s*=\s*([\{\[])`, 'i')
      : pattern;
    const m = source.match(re);
    if (!m) continue;
    let raw = m[1];
    // Alguns padrões antigos capturavam o objeto inteiro com regex não gananciosa
    // (ex.: /foo = (\{[\s\S]*?\})/), cortando o JSON no primeiro fechamento interno.
    // Sempre que a captura começar por { ou [, reprocessamos o literal por balanceamento.
    if (raw && (raw[0] === '{' || raw[0] === '[')) {
      const captureOffset = m[0].indexOf(raw);
      const start = m.index + (captureOffset >= 0 ? captureOffset : m[0].lastIndexOf(raw[0]));
      raw = extractBalancedJsonLiteral(source, start);
    }
    const parsed = safeParseJson(raw);
    if (parsed) return parsed;
  }
  return null;
}



function extractBalancedJsonLiteral(source = '', startIndex = 0) {
  const open = source[startIndex];
  const close = open === '{' ? '}' : open === '[' ? ']' : '';
  if (!close) return '';
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return source.slice(startIndex, i + 1);
    }
  }
  return '';
}

function extractNamedJsonAssignments(html = '', namePatterns = [], limit = 24) {
  const source = String(html || '');
  const out = [];
  const assignRe = /(?:^|[;\n\r])\s*(?:var|let|const|window\.)?\s*([A-Za-z_$][\w$]*)\s*=\s*([\[{])/g;
  let m;
  while ((m = assignRe.exec(source)) && out.length < limit) {
    const name = String(m[1] || '');
    if (!namePatterns.some(pattern => pattern.test(name))) continue;
    const start = m.index + m[0].lastIndexOf(m[2]);
    const raw = extractBalancedJsonLiteral(source, start);
    if (!raw) continue;
    const parsed = safeParseJson(raw);
    if (parsed) out.push({ name, data: parsed, rawBytes: raw.length });
    assignRe.lastIndex = Math.max(assignRe.lastIndex, start + Math.max(raw.length, 1));
  }
  return out;
}

function extractDataJsonByKeywords(html = '', keywordPatterns = [], limit = 12) {
  const source = String(html || '');
  const out = [];
  const attrRe = /data-[\w-]+=["']([^"']{20,20000})["']/gi;
  let m;
  while ((m = attrRe.exec(source)) && out.length < limit) {
    const decoded = decodeHtml(m[1] || '');
    if (!keywordPatterns.some(pattern => pattern.test(decoded))) continue;
    const parsed = safeParseJson(decoded);
    if (parsed) out.push({ name: 'data-attribute', data: parsed, rawBytes: decoded.length });
  }
  return out;
}

function scoreRevenueBreakdownCandidate(data, preferredKind = '') {
  const text = JSON.stringify(data || {}).slice(0, 90000);
  if (!text || text.length < 20) return 0;
  let score = 0;
  if (/labels|categories|series|datasets|data|points|percent|percentage|share|valor|value|name|label/i.test(text)) score += 4;
  if (/receita|faturamento|revenue|segment|business|neg[oó]cio|regi[aã]o|region|geograph/i.test(text)) score += 5;
  if (/\b20\d{2}\b/.test(text)) score += 2;
  if (preferredKind === 'region' && /regi[aã]o|region|geograph|country|pa[ií]s|exterior|brasil|america|europa|asia/i.test(text)) score += 7;
  if (preferredKind === 'business' && /business|bussines|neg[oó]cio|segment|segmento|produto|servi[cç]o|industrial|energia|equipamento/i.test(text)) score += 7;
  if (/Highcharts|ApexCharts|Chart\.js/.test(text)) score += 2;
  if (/function\s*\(|=>/.test(text)) score -= 8;
  return score;
}

function pickBestRevenueCandidate(candidates = [], kind = '') {
  return candidates
    .map(c => ({ ...c, score: scoreRevenueBreakdownCandidate(c.data, kind) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score || b.rawBytes - a.rawBytes)[0] || null;
}

function extractRevenueBreakdownEmbeds(html = '') {
  const generic = [
    /revenue/i, /revenues/i, /receita/i, /faturamento/i,
    /company.*chart.*pie/i, /chart.*pie/i,
    /business/i, /bussines/i, /negocio/i, /segment/i, /geograph/i, /region/i, /regiao/i
  ];
  const assignments = extractNamedJsonAssignments(html, generic, 80);
  const dataAttrs = extractDataJsonByKeywords(html, generic, 30);
  const all = [...assignments, ...dataAttrs];
  const region = pickBestRevenueCandidate(
    all.filter(c => /geograph|region|regiao|regi[aã]o|country|pais|pa[ií]s|revenue/i.test(c.name) || scoreRevenueBreakdownCandidate(c.data, 'region') >= 9),
    'region'
  );
  const business = pickBestRevenueCandidate(
    all.filter(c => /business|bussines|negocio|neg[oó]cio|segment|segmento|revenue/i.test(c.name) || scoreRevenueBreakdownCandidate(c.data, 'business') >= 9),
    'business'
  );
  return {
    revenueGeography: region?.data || null,
    revenueSegment: business?.data || null,
    revenueBreakdownSources: {
      geography: region ? { name: region.name, score: region.score, rawBytes: region.rawBytes } : null,
      business: business ? { name: business.name, score: business.score, rawBytes: business.rawBytes } : null,
      candidates: all.slice(0, 12).map(c => ({ name: c.name, rawBytes: c.rawBytes, scoreRegion: scoreRevenueBreakdownCandidate(c.data, 'region'), scoreBusiness: scoreRevenueBreakdownCandidate(c.data, 'business') }))
    }
  };
}

function extractBacktickJson(html = '', label = '') {
  const source = String(html || '');
  const re = new RegExp(escapeRe(label) + '[\"\']?\\s*:\\s*JSON\\.parse\\(`([^`]+)`\\)', 'gi');
  const out = [];
  let m;
  while ((m = re.exec(source)) && out.length < 20) {
    const parsed = safeParseJson(m[1]);
    if (parsed) out.push(parsed);
  }
  return out;
}

function extractRentabilidadeChart(html = '') {
  const last = extractBacktickJson(html, 'lastProfitability')[0] || null;
  const profitabilities = extractBacktickJson(html, 'profitabilities');
  const legends = extractBacktickJson(html, 'legend');
  if (!last && !profitabilities.length && !legends.length) return null;

  let bestProfitabilities = [];
  for (const item of profitabilities) {
    if (Array.isArray(item) && JSON.stringify(item).length > JSON.stringify(bestProfitabilities).length) bestProfitabilities = item;
  }
  const legend = legends.find(l => Array.isArray(l) && (!bestProfitabilities.length || l.length === bestProfitabilities.length)) || legends[0] || [];
  return { lastProfitability: last, legend, profitabilities: bestProfitabilities };
}

function extractEmbeddedInvestidor10Data(html = '') {
  const advancedMetrics = extractJsonAssignment(html, [/_sectorIndicators\s*=\s*(\{[\s\S]*?\})\s*;/i, /sectorIndicators\s*=\s*(\{[\s\S]*?\})\s*;/i]);
  const revenueEmbeds = extractRevenueBreakdownEmbeds(html);
  const revenueGeography = extractJsonAssignment(html, [/companyRevenuesChartPie\s*=\s*(\{[\s\S]*?\})\s*;/i]) || revenueEmbeds.revenueGeography;
  const revenueSegment = extractJsonAssignment(html, [/companyBussinesRevenuesChartPie\s*=\s*(\{[\s\S]*?\})\s*;/i, /companyBusinessRevenuesChartPie\s*=\s*(\{[\s\S]*?\})\s*;/i]) || revenueEmbeds.revenueSegment;
  const revenueBreakdownSources = revenueEmbeds.revenueBreakdownSources;
  const rentabilidadeChart = extractRentabilidadeChart(html);
  const pickId = (patterns) => {
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return m[1];
    }
    return '';
  };
  const companyId = pickId([
    /\/api\/balancos\/receitaliquida\/chart\/(\d+)\//i,
    /\/api\/balancos\/ativospassivos\/chart\/(\d+)\//i,
    /(?:companyId|company_id|companyID|idCompany|empresaId|idEmpresa)\s*[:=]\s*['"]?(\d+)['"]?/i,
    /["'](?:companyId|company_id|companyID|idCompany|empresaId|idEmpresa)["']\s*:\s*["']?(\d+)["']?/i,
    /data-(?:company|empresa|company-id|empresa-id)-id=["'](\d+)["']/i,
  ]);
  const tickerId = pickId([
    /tickerId\s*[:=]\s*['"]?(\d+)['"]?/i,
    /(?:ticker_id|idTicker|stockId|stock_id|acaoId|idAcao|assetId|asset_id)\s*[:=]\s*['"]?(\d+)['"]?/i,
    /["'](?:tickerId|ticker_id|idTicker|stockId|stock_id|acaoId|idAcao|assetId|asset_id)["']\s*:\s*["']?(\d+)["']?/i,
    /data-(?:ticker|stock|asset|acao)-id=["'](\d+)["']/i,
    /\/api\/acoes\/payout-chart\/\d+\/(\d+)\//i,
  ]);
  const fiiId = pickId([
    /\/api\/fii\/historico-indicadores\/(\d+)\//i,
    /\/api\/fii\/comparador\/table\/(\d+)\//i,
    /(?:fiiId|fii_id|idFii|fundId|fund_id)\s*[:=]\s*['"]?(\d+)['"]?/i,
    /["'](?:fiiId|fii_id|idFii|fundId|fund_id)["']\s*:\s*["']?(\d+)["']?/i,
    /data-(?:fii|fund)-id=["'](\d+)["']/i,
  ]);
  return { advancedMetrics, revenueGeography, revenueSegment, revenueBreakdownSources, rentabilidadeChart, companyId, tickerId, fiiId };
}

async function fetchJsonUrl(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': browserHeaders(url)['User-Agent'],
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://investidor10.com.br/'
      }
    });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    const text = await res.text();
    const json = safeParseJson(text);
    if (!json) return { ok: false, status: res.status, error: 'JSON inválido' };
    return { ok: true, status: res.status, data: json };
  } catch (err) {
    return { ok: false, status: 0, error: err?.name === 'AbortError' ? `Timeout ${timeoutMs}ms` : (err?.message || 'Falha de rede') };
  } finally {
    clearTimeout(timer);
  }
}

function formatIndicatorHistoryValue(rawValue, rawType) {
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return stripTags(String(rawValue || '-')) || '-';
  const type = String(rawType || '').toLowerCase();
  const dec = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const abbr = (v, d = 2, space = true) => {
    const abs = Math.abs(v);
    if (abs >= 1e9) return `${dec(v / 1e9, d)}${space ? ' ' : ''}B`;
    if (abs >= 1e6) return `${dec(v / 1e6, d)}${space ? ' ' : ''}M`;
    if (abs >= 1e3) return `${dec(v / 1e3, d)}${space ? ' ' : ''}K`;
    return dec(v, 0);
  };
  if (type === 'money_abbr') return `R$ ${abbr(n, 2, true)}`;
  if (type === 'number_abbr') return abbr(n, 0, false);
  if (type === 'money') return `R$ ${dec(n, 2)}`;
  if (type === 'percent') return `${dec(n, 2)}%`;
  if (type === 'number') return dec(n, 0);
  return dec(n, 2);
}

function normalizeFiiHistoricalIndicatorsApi(data) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(([, values]) => Array.isArray(values) && values.length > 0);
  if (!entries.length) return null;
  const years = [];
  for (const [, values] of entries) {
    for (const item of values) {
      const y = String(item?.year || '').trim();
      if (y && !years.includes(y)) years.push(y);
    }
  }
  const colunas = years.length ? years : ['Atual'];
  const linhas = entries.map(([indicador, values]) => {
    const byYear = new Map(values.map(item => [String(item?.year || '').trim(), item]));
    const valores = {};
    for (const col of colunas) {
      const item = byYear.get(col);
      valores[col] = item ? formatIndicatorHistoryValue(item.value, item.type) : '-';
    }
    return { indicador, valores };
  });
  return { colunas, linhas };
}

async function fetchInvestidor10ApiExtras(ticker, type, html, options = {}) {
  if (!ENABLE_INVESTIDOR10_INTERNAL_APIS || options.enableInternalApis === false) return { apiExtras: {}, apiWarnings: [] };
  const ids = extractEmbeddedInvestidor10Data(html);
  const apiExtras = { embedded: {}, chartsFinanceiros: {}, rawJson: {}, apiStatus: [] };
  const apiWarnings = [];
  if (ids.advancedMetrics) apiExtras.embedded.advancedMetrics = ids.advancedMetrics;
  if (ids.revenueGeography) apiExtras.embedded.revenueGeography = ids.revenueGeography;
  if (ids.revenueSegment) apiExtras.embedded.revenueSegment = ids.revenueSegment;
  if (ids.revenueBreakdownSources) apiExtras.embedded.revenueBreakdownSources = ids.revenueBreakdownSources;
  if (ids.rentabilidadeChart) apiExtras.embedded.rentabilidadeChart = ids.rentabilidadeChart;

  const timeoutMs = boundedTimeout(options.timeoutMs || DEFAULT_TIMEOUT_MS, options.internalApiTimeoutMs || process.env.VALORAE_INTERNAL_API_TIMEOUT_MS || 7000);
  const chartFastMode = String(options.performanceProfile || options.profile || options.chartProfile || options.mode || '').toLowerCase().includes('chartfast') ||
    String(options.chartProfile || '').toLowerCase().includes('mobile-fast') ||
    String(options.mode || '').toLowerCase().includes('charts-fast');
  const base = 'https://investidor10.com.br';
  const tasks = [];
  if (type !== 'FII' && ids.companyId) {
    tasks.push(['receitasLucros', `${base}/api/balancos/receitaliquida/chart/${ids.companyId}/3650/false/`]);
    tasks.push(['lucroCotacao', `${base}/api/cotacao-lucro/${ticker.toLowerCase()}/adjusted/`]);
    tasks.push(['evolucaoPatrimonio', `${base}/api/balancos/ativospassivos/chart/${ids.companyId}/3650/`]);
    if (ids.tickerId) tasks.push(['payoutHistorico', `${base}/api/acoes/payout-chart/${ids.companyId}/${ids.tickerId}/${ticker.toUpperCase()}/3650`]);
  }
  if (type === 'FII' && ids.fiiId) {
    tasks.push(['historicoIndicadoresFii', `${base}/api/fii/historico-indicadores/${ids.fiiId}/10`]);
    tasks.push(['comparadorFiis', `${base}/api/fii/comparador/table/${ids.fiiId}/`]);
  }

  const discoveredChartUrls = discoverInvestidor10ChartApiUrls(html, ticker, type);
  const existingUrls = new Set(tasks.map(([, url]) => String(url)));
  for (const url of discoveredChartUrls) {
    if (existingUrls.has(url)) continue;
    if (chartFastMode && tasks.length >= 6) continue;
    existingUrls.add(url);
    const key = `i10Api_${String(url).split('/api/')[1].replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70)}`;
    tasks.push([key, url]);
  }

  const boundedTasks = chartFastMode ? tasks.slice(0, 6) : tasks;
  const responses = await Promise.all(boundedTasks.map(async ([key, url]) => [key, url, await fetchJsonUrl(url, timeoutMs)]));
  for (const [key, url, r] of responses) {
    apiExtras.apiStatus.push({ key, url, ok: r.ok, status: r.status, error: r.error });
    if (!r.ok) continue;
    apiExtras.rawJson[key] = r.data;
    if (key === 'historicoIndicadoresFii') apiExtras.historicoIndicadoresFii = normalizeFiiHistoricalIndicatorsApi(r.data);
    else if (key === 'comparadorFiis' || /comparador|compare|indices/i.test(key)) apiExtras.rawJson[key] = r.data;
    else apiExtras.chartsFinanceiros[key] = r.data;
  }
  apiExtras.canonicalCharts = buildInvestidor10CanonicalCharts({ ticker, type, html, apiExtras });
  apiExtras.embedded.chartExtractorVersion = VALORAE_I10_CHART_EXTRACTOR_VERSION;
  if (apiExtras.apiStatus.some(x => !x.ok)) apiWarnings.push('Algumas APIs internas do Investidor10 não responderam; o JSON manteve os dados disponíveis no HTML.');
  return { apiExtras, apiWarnings };
}

function mergeSectionsDeep(a = {}, b = {}) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) out[k] = Array.isArray(out[k]) && out[k].length ? out[k] : v;
    else if (typeof v === 'object' && !Array.isArray(v)) out[k] = mergeSectionsDeep(out[k] || {}, v);
    else if (out[k] === undefined || out[k] === null || out[k] === '') out[k] = v;
  }
  return out;
}


function text(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function toFiniteNumber(value) {
  const n = parseFinancialNumber(value, { maxAbs: 1e16 });
  return n === null || !Number.isFinite(n) ? null : n;
}

function toMobileIndicatorPoint(point = {}, fallbackLabel = '', fallbackUnit = '') {
  if (!point || typeof point !== 'object') return null;
  const label = text(firstDefined(point.label, point.period, point.year, point.ano, point.name, point.key, fallbackLabel));
  const value = toFiniteNumber(firstDefined(point.value, point.valor, point.amount, point.total, point.yieldPercent, point.percent, point.percentage, point.y));
  if (!label && value === null) return null;
  return {
    label: label || fallbackLabel || 'Valor',
    value: value ?? 0,
    display: text(firstDefined(point.display, point.displayValue, point.formatted, point.valorFormatado, point.valueFormatted, point.text)),
    unit: text(firstDefined(point.unit, point.unidade, fallbackUnit)),
    year: text(firstDefined(point.year, point.ano)),
    period: text(firstDefined(point.period, point.periodo, point.month, point.mes)),
    source: text(firstDefined(point.source, point.fonte, 'VALORAE Proxy / Investidor10')),
  };
}

function toMobileFinancialPoint(point = {}) {
  if (!point || typeof point !== 'object') return null;
  const label = text(firstDefined(point.label, point.period, point.periodo, point.date, point.data, point.year, point.ano));
  const year = text(firstDefined(point.year, point.ano, String(label).match(/(20\d{2}|19\d{2})/)?.[1], label));
  const out = {
    label: label || year,
    year: year || label,
    quarter: text(firstDefined(point.quarter, point.trimestre, point.q)),
    netRevenue: toFiniteNumber(firstDefined(point.netRevenue, point.net_revenue, point.revenue, point.receitaLiquida, point.receita)) ?? 0,
    cost: toFiniteNumber(firstDefined(point.cost, point.custo, point.costs)) ?? 0,
    grossProfit: toFiniteNumber(firstDefined(point.grossProfit, point.lucroBruto)) ?? 0,
    ebitda: toFiniteNumber(firstDefined(point.ebitda)) ?? 0,
    ebit: toFiniteNumber(firstDefined(point.ebit)) ?? 0,
    netProfit: toFiniteNumber(firstDefined(point.netProfit, point.net_profit, point.profit, point.lucroLiquido, point.lucro)) ?? 0,
    netWorth: toFiniteNumber(firstDefined(point.netWorth, point.equity, point.patrimonioLiquido, point.pl)) ?? 0,
    totalAssets: toFiniteNumber(firstDefined(point.totalAssets, point.assets, point.ativos, point.ativoTotal)) ?? 0,
    totalLiabilities: toFiniteNumber(firstDefined(point.totalLiabilities, point.liabilities, point.passivos, point.passivoTotal)) ?? 0,
  };
  return Object.values(out).some(v => typeof v === 'number' && Number.isFinite(v) && v !== 0) ? out : null;
}

function toMobileComparisonPoint(point = {}, fallbackLabel = '') {
  if (!point || typeof point !== 'object') return null;
  const label = text(firstDefined(point.label, point.dateLabel, point.date, point.data, point.period, point.year, point.x, fallbackLabel));
  const value = toFiniteNumber(firstDefined(point.value, point.returnPercent, point.accumulatedPercent, point.percent, point.percentage, point.valuePercent, point.y, point.quote, point.current));
  const secondaryValue = toFiniteNumber(firstDefined(point.secondaryValue, point.profit, point.average, point.media, point.peer, point.benchmark)) ?? 0;
  if (!label && value === null && secondaryValue === 0) return null;
  return {
    label: label || fallbackLabel || 'Ponto',
    value: value ?? 0,
    secondaryValue,
    dateMillis: toFiniteNumber(firstDefined(point.dateMillis, point.timestampMs, point.timeMillis)) ?? 0,
  };
}

function toMobileComparisonSeries(series = {}, ticker = '') {
  if (!series || typeof series !== 'object') return null;
  const name = text(firstDefined(series.name, series.label, series.key, series.title, ticker, 'Ativo')).toUpperCase();
  const sourcePoints = Array.isArray(series.points) ? series.points
    : Array.isArray(series.data) ? series.data
      : Array.isArray(series.items) ? series.items
        : Array.isArray(series.values) ? series.values
          : [];
  const points = sourcePoints.map((point, i) => toMobileComparisonPoint(point, `P${i + 1}`)).filter(Boolean);
  return name && points.length ? { name, points } : null;
}

function toMobileDividendEvent(event = {}, ticker = '') {
  if (!event || typeof event !== 'object') return null;
  const valuePerShare = toFiniteNumber(firstDefined(event.valuePerShare, event.valorPorAcao, event.valorPorCota, event.value, event.valor, event.amountPerShare, event.amount)) ?? 0;
  const out = {
    ticker: text(firstDefined(event.ticker, event.symbol, event.codigo, ticker)).toUpperCase(),
    dateCom: text(firstDefined(event.dateCom, event.dataCom, event.data_com, event.recordDate, event.dataBase, event.baseDate)),
    exDate: text(firstDefined(event.exDate, event.dataEx, event.exDividendDate)),
    paymentDate: text(firstDefined(event.paymentDate, event.dataPagamento, event.payDate, event.date_payment, event.data_pagamento, event.pagamento, event.pgto, event.date, event.data)),
    valuePerShare,
    quantity: toFiniteNumber(firstDefined(event.quantity, event.quantidade, event.shares, event.cotas)) ?? 0,
    estimatedAmount: toFiniteNumber(firstDefined(event.estimatedAmount, event.total, event.totalAmount)) ?? 0,
    dividendType: text(firstDefined(event.dividendType, event.type, event.tipo, event.kind, 'Provento')),
    status: text(firstDefined(event.status, event.paymentStatus, event.situacao, 'Provento')),
    source: text(firstDefined(event.source, event.fonte, 'VALORAE Proxy / Investidor10')),
  };
  return (out.ticker || out.dateCom || out.paymentDate || out.valuePerShare) ? out : null;
}

function mapBreakdownPayload(source) {
  if (!source || typeof source !== 'object') return {};
  if (Array.isArray(source)) return { Atual: source };
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) out[key] = value;
    else if (value && typeof value === 'object') out[key] = Array.isArray(value.items) ? value.items : Array.isArray(value.data) ? value.data : Object.entries(value).map(([name, val]) => ({ name, valuePercent: val }));
  }
  return out;
}

function buildMobileAssetChartBundle(payload = {}) {
  const results = payload.results || {};
  const canonical = results.assetChartsCanonical || payload.assetChartsCanonical || results.sections?.assetChartsCanonical || {};
  const canonicalFinancial = canonical.financial || results.financialChartsCanonical || {};
  const canonicalFii = canonical.fii || results.fiiChartsCanonical || {};
  const ticker = text(payload.ticker || canonical.ticker || results.ticker || results.symbol).toUpperCase();
  const type = text(payload.type || canonical.type || results.type || results.tipo || 'ACAO').toUpperCase();
  const profitability = Array.isArray(canonical.profitability?.nominal) ? canonical.profitability.nominal.map(p => ({ period: text(firstDefined(p.period, p.label)), label: text(firstDefined(p.label, p.period)), valuePercent: toFiniteNumber(firstDefined(p.valuePercent, p.value, p.percent, p.percentage)) ?? 0, kind: 'nominal' })).filter(p => p.period) : [];
  const realProfitability = Array.isArray(canonical.profitability?.real) ? canonical.profitability.real.map(p => ({ period: text(firstDefined(p.period, p.label)), label: text(firstDefined(p.label, p.period)), valuePercent: toFiniteNumber(firstDefined(p.valuePercent, p.value, p.percent, p.percentage)) ?? 0, kind: 'real' })).filter(p => p.period) : [];
  const dividendEvents = (Array.isArray(canonical.dividendHistory) ? canonical.dividendHistory : Array.isArray(canonicalFii.dividendHistory) ? canonicalFii.dividendHistory : Array.isArray(canonical.company?.dividendHistory) ? canonical.company.dividendHistory : [])
    .map(ev => toMobileDividendEvent(ev, ticker)).filter(Boolean);
  const dividendMonthly = (Array.isArray(canonical.dividendMonthly) ? canonical.dividendMonthly : Array.isArray(canonicalFii.dividendMonthly) ? canonicalFii.dividendMonthly : Array.isArray(canonical.company?.dividendMonthly) ? canonical.company.dividendMonthly : [])
    .map(p => toMobileIndicatorPoint(p, 'Mensal', 'BRL')).filter(Boolean);
  const dividendYearly = (Array.isArray(canonical.dividendYearly) ? canonical.dividendYearly : Array.isArray(canonicalFii.dividendYearly) ? canonicalFii.dividendYearly : Array.isArray(canonical.company?.dividendYearly) ? canonical.company.dividendYearly : [])
    .map(p => toMobileIndicatorPoint(p, 'Anual', 'BRL')).filter(Boolean);
  const dividendYieldHistory = (Array.isArray(canonical.dividendYieldHistory) ? canonical.dividendYieldHistory : Array.isArray(canonicalFii.dividendYieldHistory) ? canonicalFii.dividendYieldHistory : Array.isArray(canonical.company?.dividendYieldHistory) ? canonical.company.dividendYieldHistory : [])
    .map(p => toMobileIndicatorPoint(p, 'DY %', '%')).filter(Boolean);
  const indexComparison = (Array.isArray(canonical.indexComparison) ? canonical.indexComparison : Array.isArray(results.indexComparison) ? results.indexComparison : [])
    .map(s => toMobileComparisonSeries(s, ticker)).filter(Boolean);
  const commodityComparison = (Array.isArray(canonical.commodityComparison) ? canonical.commodityComparison : Array.isArray(results.commodityComparison) ? results.commodityComparison : [])
    .map(s => toMobileComparisonSeries(s, ticker)).filter(Boolean);
  const revenueProfit = (Array.isArray(canonicalFinancial.revenueProfit) ? canonicalFinancial.revenueProfit : Array.isArray(results.revenueProfit) ? results.revenueProfit : [])
    .map(toMobileFinancialPoint).filter(Boolean);
  const profitVsQuote = (Array.isArray(canonicalFinancial.profitVsQuote) ? canonicalFinancial.profitVsQuote : Array.isArray(results.profitVsQuote) ? results.profitVsQuote : [])
    .map(p => toMobileComparisonPoint({ label: p.label || p.year, value: firstDefined(p.quote, p.value), secondaryValue: firstDefined(p.profit, p.secondaryValue) }, text(p.label || p.year))).filter(Boolean);
  const equityEvolution = (Array.isArray(canonicalFinancial.equityEvolution) ? canonicalFinancial.equityEvolution : Array.isArray(results.equityEvolution) ? results.equityEvolution : [])
    .map(toMobileFinancialPoint).filter(Boolean);
  const balanceSheet = (Array.isArray(canonicalFinancial.balanceSheet) ? canonicalFinancial.balanceSheet : Array.isArray(results.balanceSheet) ? results.balanceSheet : [])
    .map(toMobileFinancialPoint).filter(Boolean);
  const payoutHistory = (Array.isArray(canonicalFinancial.payoutHistory) ? canonicalFinancial.payoutHistory : Array.isArray(results.payoutHistory) ? results.payoutHistory : [])
    .map(p => toMobileIndicatorPoint(p, 'Payout', '%')).filter(Boolean);
  const fiiDistribution12m = (Array.isArray(canonicalFii.distribution12m) ? canonicalFii.distribution12m : Array.isArray(results.distribuicoes12m) ? results.distribuicoes12m : [])
    .map(p => toMobileIndicatorPoint({ ...p, value: firstDefined(p.value, p.yieldPercent), display: firstDefined(p.display, p.amount), period: firstDefined(p.period, p.label) }, 'Distribuição 12M', '%')).filter(Boolean);
  const fiiPeerAverage = (Array.isArray(canonicalFii.peerComparison) ? canonicalFii.peerComparison : Array.isArray(results.fiiPeerComparison) ? results.fiiPeerComparison : [])
    .flatMap(s => Array.isArray(s?.points) ? s.points.map((p, i) => toMobileComparisonPoint(p, `${s.name || 'Média'} ${i + 1}`)).filter(Boolean) : [toMobileComparisonPoint(s, text(s?.label || s?.name || 'Média'))].filter(Boolean));
  const info = canonicalFii.info || results.informacoesFundo || {};
  const fiiPatrimonialInfo = Object.entries(info || {}).map(([label, value]) => toMobileIndicatorPoint({ label, value, display: value }, label)).filter(Boolean);
  const revenueByRegion = mapBreakdownPayload(canonical.revenueByRegion || canonical.revenueGeography || results.revenueByRegion || results.revenueGeography || results.regioesReceita);
  const revenueByBusiness = mapBreakdownPayload(canonical.revenueByBusiness || canonical.revenueSegment || results.revenueByBusiness || results.revenueSegment || results.negociosReceita || results.segmentosReceita);
  const fiiAssetDistribution = mapBreakdownPayload(canonicalFii.physicalAssets || canonicalFii.assetDistribution || canonicalFii.fundAssetDistribution || canonicalFii.assetAllocation || results.listaImoveis || results.ativosFundo || results.distribuicaoAtivosFundo || results.distribuicaoAtivos || results.assetDistribution);
  const coverage = canonical.coverage || results.assetChartsCoverage || {};
  const presentation = canonical.presentation || canonical.profilePresentation || canonical.company?.presentation || canonical.fii?.presentation || results.profilePresentation || results.assetPresentation || null;
  const companyProfile = { ...(canonical.company?.info || results.informacoesEmpresa || {}), ...(presentation?.summary ? { sobre: presentation.summary, presentation } : {}) };
  const fundProfile = { ...(canonicalFii.info || results.informacoesFundo || {}), ...(presentation?.summary ? { sobre: presentation.summary, presentation } : {}) };
  const bundle = {
    version: '21.12.84-asset-chart-mobile-bundle',
    ticker,
    type,
    range: 'MAX',
    priceHistory: [],
    profitability,
    realProfitability,
    indicatorCards: [],
    indicatorHistory: {},
    dividendEvents,
    dividendMonthly,
    dividendYearly,
    dividendYieldHistory,
    indexComparison,
    commodityComparison,
    revenueProfit,
    profitVsQuote,
    equityEvolution,
    balanceSheet,
    payoutHistory,
    revenueByRegion,
    revenueByBusiness,
    fiiDistribution12m,
    fiiPeerAverage,
    fiiPatrimonialInfo,
    fiiAssetDistribution,
    warnings: Array.isArray(coverage.warnings) ? coverage.warnings.slice(0, 8) : [],
    coverageCaptured: Array.isArray(coverage.requiredCaptured) ? coverage.requiredCaptured : Array.isArray(coverage.captured) ? coverage.captured : [],
    coverageMissing: Array.isArray(coverage.requiredMissing) ? coverage.requiredMissing.map(x => typeof x === 'string' ? x : x.key || x.title).filter(Boolean) : Array.isArray(coverage.missing) ? coverage.missing : [],
    coverageNotApplicable: Array.isArray(coverage.notApplicable) ? coverage.notApplicable : [],
    source: 'VALORAE Proxy / Investidor10 / assetChartBundle',
    assetPresentation: presentation,
    profilePresentation: presentation,
    companyProfile,
    fundProfile,
    sourceStatus: {
      cacheStatus: payload.cacheStatus,
      partial: Boolean(payload.partial),
      profile: payload.performance?.profile || payload.metrics?.performanceProfile,
      canonicalSource: canonical.source,
      generatedAt: payload.metrics?.generatedAt,
    },
    counts: {},
  };
  const keys = ['priceHistory','profitability','realProfitability','dividendEvents','dividendMonthly','dividendYearly','dividendYieldHistory','indexComparison','commodityComparison','revenueProfit','profitVsQuote','equityEvolution','balanceSheet','payoutHistory','fiiDistribution12m','fiiPeerAverage','fiiPatrimonialInfo'];
  bundle.counts = Object.fromEntries(keys.map(k => [k, Array.isArray(bundle[k]) ? bundle[k].length : 0]));
  const hasRenderable = keys.some(k => Array.isArray(bundle[k]) && bundle[k].length) || Object.keys(revenueByRegion).length || Object.keys(revenueByBusiness).length || Object.keys(fiiAssetDistribution).length;
  return hasRenderable ? bundle : null;
}

function attachMobileAssetChartBundle(payload = {}) {
  const bundle = buildMobileAssetChartBundle(payload);
  if (!bundle) return payload;
  payload.assetChartBundle = bundle;
  payload.assetChartsMobile = bundle;
  payload.results = payload.results || {};
  payload.results.assetChartBundle = bundle;
  payload.results.assetChartsMobile = bundle;
  payload.results.sections = payload.results.sections || {};
  payload.results.sections.assetChartBundle = bundle;
  payload.results.sections.assetChartsMobile = bundle;
  payload.appPayload = payload.appPayload || {};
  payload.appPayload.assetChartBundle = bundle;
  payload.appPayload.charts = payload.appPayload.charts || {};
  payload.appPayload.charts.assetChartBundle = bundle;
  payload.appMobileSnapshot = payload.appMobileSnapshot || {};
  payload.appMobileSnapshot.assetChartBundle = bundle;
  return payload;
}



function applyApiExtrasToResults(results, apiExtras = {}, type = '') {
  const out = { ...results };
  const sections = { ...(out.sections || {}) };
  if (apiExtras.embedded) {
    if (apiExtras.embedded.rentabilidadeChart) sections.rentabilidadeChart = apiExtras.embedded.rentabilidadeChart;
    if (apiExtras.embedded.advancedMetrics) {
      out.advancedMetrics = apiExtras.embedded.advancedMetrics;
      sections.indicadoresAvancados = apiExtras.embedded.advancedMetrics;
    }
    if (apiExtras.embedded.revenueGeography) {
      out.revenueGeography = apiExtras.embedded.revenueGeography;
      out.regioesReceita = out.regioesReceita || apiExtras.embedded.revenueGeography;
      sections.empresa = mergeSectionsDeep(sections.empresa || {}, { regioesReceita: apiExtras.embedded.revenueGeography, revenueGeography: apiExtras.embedded.revenueGeography });
    }
    if (apiExtras.embedded.revenueSegment) {
      out.revenueSegment = apiExtras.embedded.revenueSegment;
      out.revenueByBusiness = out.revenueByBusiness || apiExtras.embedded.revenueSegment;
      out.negociosReceita = out.negociosReceita || apiExtras.embedded.revenueSegment;
      out.segmentosReceita = out.segmentosReceita || apiExtras.embedded.revenueSegment;
      sections.empresa = mergeSectionsDeep(sections.empresa || {}, { negociosReceita: apiExtras.embedded.revenueSegment, segmentosReceita: apiExtras.embedded.revenueSegment, revenueSegment: apiExtras.embedded.revenueSegment, revenueByBusiness: apiExtras.embedded.revenueSegment });
    }
    if (apiExtras.embedded.revenueBreakdownSources) {
      out.revenueBreakdownSources = apiExtras.embedded.revenueBreakdownSources;
      sections.apiRevenueBreakdownSources = apiExtras.embedded.revenueBreakdownSources;
    }
  }
  if (apiExtras.chartsFinanceiros && Object.keys(apiExtras.chartsFinanceiros).length) {
    out.chartsFinanceiros = apiExtras.chartsFinanceiros;
    sections.demonstrativos = mergeSectionsDeep(sections.demonstrativos || {}, apiExtras.chartsFinanceiros);
  }
  if (apiExtras.canonicalCharts) {
    const canonical = apiExtras.canonicalCharts;
    out.assetChartsCanonical = canonical;
    sections.assetChartsCanonical = canonical;
    if (canonical.profitability) {
      out.profitability = canonical.profitability;
      out.rentabilidadeCanonical = canonical.profitability;
      sections.rentabilidadeCanonical = canonical.profitability;
      sections.rentabilidade = mergeSectionsDeep(sections.rentabilidade || {}, canonical.profitability);
    }
    if (Array.isArray(canonical.indexComparison) && canonical.indexComparison.length) {
      out.indexComparison = canonical.indexComparison;
      out.comparacaoIndices = canonical.indexComparison;
      sections.comparacaoIndices = { source: canonical.source, series: canonical.indexComparison };
    }
    if (Array.isArray(canonical.commodityComparison) && canonical.commodityComparison.length) {
      out.commodityComparison = canonical.commodityComparison;
      out.comparacaoCommodity = canonical.commodityComparison;
      sections.comparacaoCommodity = { source: canonical.source, series: canonical.commodityComparison };
    }
    if (canonical.coverage) {
      out.assetChartsCoverage = canonical.coverage;
      sections.assetChartsCoverage = canonical.coverage;
    }
    const canonicalPresentation = canonical.presentation || canonical.profilePresentation || canonical.company?.presentation || canonical.fii?.presentation || null;
    if (canonicalPresentation?.summary) {
      out.assetPresentation = canonicalPresentation;
      out.profilePresentation = canonicalPresentation;
      out.assetDescription = out.assetDescription || canonicalPresentation.summary;
      out.description = out.description || canonicalPresentation.summary;
      out.descricao = out.descricao || canonicalPresentation.summary;
      out.sobre = out.sobre || canonicalPresentation.summary;
      sections.perfilApresentacao = canonicalPresentation;
      sections.empresa = mergeSectionsDeep(sections.empresa || {}, { sobre: canonicalPresentation.summary, presentation: canonicalPresentation, profilePresentation: canonicalPresentation });
      sections.fundo = mergeSectionsDeep(sections.fundo || {}, { sobre: canonicalPresentation.summary, presentation: canonicalPresentation, profilePresentation: canonicalPresentation });
    }
    const canonicalDividends = canonical.dividendHistory || canonical.company?.dividendHistory || canonical.fii?.dividendHistory;
    const canonicalDividendMonthly = canonical.dividendMonthly || canonical.company?.dividendMonthly || canonical.fii?.dividendMonthly;
    const canonicalDividendYearly = canonical.dividendYearly || canonical.company?.dividendYearly || canonical.fii?.dividendYearly;
    const canonicalDividendYieldHistory = canonical.dividendYieldHistory || canonical.company?.dividendYieldHistory || canonical.fii?.dividendYieldHistory;
    if (Array.isArray(canonicalDividends) && canonicalDividends.length) {
      out.historicoDividendos = Array.isArray(out.historicoDividendos) && out.historicoDividendos.length ? out.historicoDividendos : canonicalDividends;
      out.dividendHistory = canonicalDividends;
      out.dividends = canonicalDividends;
      out.proventos = Array.isArray(out.proventos) && out.proventos.length ? out.proventos : canonicalDividends;
      sections.dividendos = mergeSectionsDeep(sections.dividendos || {}, { historico: canonicalDividends, history: canonicalDividends, events: canonicalDividends, canonicalHistory: canonicalDividends });
      sections.dividends = mergeSectionsDeep(sections.dividends || {}, { history: canonicalDividends, events: canonicalDividends });
    }
    if (Array.isArray(canonicalDividendMonthly) && canonicalDividendMonthly.length) {
      out.dividendMonthly = canonicalDividendMonthly;
      out.proventosMensais = canonicalDividendMonthly;
      sections.dividendMonthly = canonicalDividendMonthly;
      sections.dividendos = mergeSectionsDeep(sections.dividendos || {}, { monthly: canonicalDividendMonthly, mensal: canonicalDividendMonthly });
    }
    if (Array.isArray(canonicalDividendYearly) && canonicalDividendYearly.length) {
      out.dividendYearly = canonicalDividendYearly;
      out.proventosAnuais = canonicalDividendYearly;
      sections.dividendYearly = canonicalDividendYearly;
      sections.dividendos = mergeSectionsDeep(sections.dividendos || {}, { yearly: canonicalDividendYearly, anual: canonicalDividendYearly });
    }
    if (Array.isArray(canonicalDividendYieldHistory) && canonicalDividendYieldHistory.length) {
      out.dividendYieldHistory = canonicalDividendYieldHistory;
      sections.dividendYieldHistory = canonicalDividendYieldHistory;
      sections.dividendos = mergeSectionsDeep(sections.dividendos || {}, { dividendYieldHistory: canonicalDividendYieldHistory, dyHistory: canonicalDividendYieldHistory });
    }
    if (canonical.fii) {
      out.fiiChartsCanonical = canonical.fii;
      if (Array.isArray(canonical.fii.distribution12m) && canonical.fii.distribution12m.length) {
        sections.distribuicoes12m = canonical.fii.distribution12m;
        out.distribuicoes12m = canonical.fii.distribution12m;
      }
      if (canonical.fii.info && Object.keys(canonical.fii.info).length) {
        sections.informacoesFundo = mergeSectionsDeep(sections.informacoesFundo || {}, canonical.fii.info);
        out.informacoesFundo = mergeSectionsDeep(out.informacoesFundo || {}, canonical.fii.info);
      }
      if (canonical.fii.presentation?.summary) {
        sections.informacoesFundo = mergeSectionsDeep(sections.informacoesFundo || {}, { sobre: canonical.fii.presentation.summary, presentation: canonical.fii.presentation });
        out.informacoesFundo = mergeSectionsDeep(out.informacoesFundo || {}, { sobre: canonical.fii.presentation.summary, presentation: canonical.fii.presentation });
      }
      if (Array.isArray(canonical.fii.peerComparison) && canonical.fii.peerComparison.length) {
        sections.comparadorFiis = { source: canonical.source, series: canonical.fii.peerComparison };
        out.comparadorFiis = canonical.fii.peerComparison;
        out.fiiPeerComparison = canonical.fii.peerComparison;
      }
      if (canonical.fii.fundamentalIndicatorHistory && Object.keys(canonical.fii.fundamentalIndicatorHistory || {}).length) {
        sections.historicoIndicadores = canonical.fii.fundamentalIndicatorHistory;
        out.historicoIndicadores = canonical.fii.fundamentalIndicatorHistory;
      }
      if (canonical.fii.dividendYieldHistory && Object.keys(canonical.fii.dividendYieldHistory || {}).length) {
        sections.dividendYieldHistory = canonical.fii.dividendYieldHistory;
        out.dividendYieldHistory = canonical.fii.dividendYieldHistory;
      }
      if (canonical.fii.dividendHistory && Object.keys(canonical.fii.dividendHistory || {}).length) {
        sections.dividendos = mergeSectionsDeep(sections.dividendos || {}, { canonicalHistory: canonical.fii.dividendHistory });
        out.dividendHistory = canonical.fii.dividendHistory;
      }
      if (canonical.fii.physicalAssets && Object.keys(canonical.fii.physicalAssets || {}).length) {
        sections.listaImoveis = canonical.fii.physicalAssets;
        out.listaImoveis = canonical.fii.physicalAssets;
      }
      if (canonical.fii.assetDistribution && Object.keys(canonical.fii.assetDistribution || {}).length) {
        sections.distribuicaoAtivosFundo = canonical.fii.assetDistribution;
        out.distribuicaoAtivosFundo = canonical.fii.assetDistribution;
        out.fiiAssetDistribution = canonical.fii.assetDistribution;
      }
    }
    if (canonical.company?.info && Object.keys(canonical.company.info).length) {
      sections.informacoesEmpresa = mergeSectionsDeep(sections.informacoesEmpresa || {}, canonical.company.info);
      out.informacoesEmpresa = mergeSectionsDeep(out.informacoesEmpresa || {}, canonical.company.info);
    }
    if (canonical.company?.presentation?.summary) {
      sections.informacoesEmpresa = mergeSectionsDeep(sections.informacoesEmpresa || {}, { sobre: canonical.company.presentation.summary, presentation: canonical.company.presentation });
      out.informacoesEmpresa = mergeSectionsDeep(out.informacoesEmpresa || {}, { sobre: canonical.company.presentation.summary, presentation: canonical.company.presentation });
    }
    if (canonical.company?.fundamentalIndicatorHistory && Object.keys(canonical.company.fundamentalIndicatorHistory || {}).length) {
      sections.historicoIndicadores = canonical.company.fundamentalIndicatorHistory;
      out.historicoIndicadores = canonical.company.fundamentalIndicatorHistory;
    }
    if (canonical.fundamentalIndicatorHistory && Object.keys(canonical.fundamentalIndicatorHistory || {}).length && !sections.historicoIndicadores) {
      sections.historicoIndicadores = canonical.fundamentalIndicatorHistory;
      out.historicoIndicadores = canonical.fundamentalIndicatorHistory;
    }
    if (canonical.company) {
      out.companyChartsCanonical = canonical.company;
    }
    if (canonical.financial) {
      const canonicalEquityEvolution = Array.isArray(canonical.financial.equityEvolution) && canonical.financial.equityEvolution.length
        ? canonical.financial.equityEvolution
        : canonical.financial.balanceSheet;
      out.financialChartsCanonical = canonical.financial;
      sections.demonstrativos = mergeSectionsDeep(sections.demonstrativos || {}, {
        revenueProfit: canonical.financial.revenueProfit,
        receitasLucros: canonical.financial.revenueProfit,
        profitVsQuote: canonical.financial.profitVsQuote,
        lucroCotacao: canonical.financial.profitVsQuote,
        equityEvolution: canonicalEquityEvolution,
        evolucaoPatrimonio: canonicalEquityEvolution,
        balanceSheet: canonical.financial.balanceSheet,
        balancoPatrimonial: canonical.financial.balanceSheet,
        payoutHistory: canonical.financial.payoutHistory,
        payoutHistorico: canonical.financial.payoutHistory,
      });
    }
  }
  if (apiExtras.historicoIndicadoresFii) {
    sections.historicoIndicadores = apiExtras.historicoIndicadoresFii;
    out.historicoIndicadores = apiExtras.historicoIndicadoresFii;
  }
  if (apiExtras.apiStatus) sections.apiStatus = apiExtras.apiStatus;
  out.sections = sections;
  return out;
}

function applyYahooQuoteToResults(results, yahoo) {
  if (!yahoo?.ok || !yahoo.data) return results;
  const out = { ...results };
  if (out.precoAtual !== undefined && out.precoAtual !== yahoo.data.precoAtual) out.precoAtualInvestidor10 = out.precoAtual;
  if (out.variacaoDay !== undefined && out.variacaoDay !== yahoo.data.variacaoDay) out.variacaoDayInvestidor10 = out.variacaoDay;
  if (yahoo.data.precoAtual !== undefined) out.precoAtual = yahoo.data.precoAtual;
  if (yahoo.data.variacaoDay !== undefined) out.variacaoDay = yahoo.data.variacaoDay;
  out.cotacaoFonte = 'YahooChart';
  return out;
}

function processSelectorPairInto(out, titleRaw, valueRaw) {
  const title = stripTags(titleRaw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const value = stripTags(valueRaw || '').replace(/\s+/g, ' ').trim();
  if (!title || !value || /^[-—–]+$/.test(value)) return;
  const setNum = (key) => { if (out[key] === undefined) out[key] = normalizeBRNumber(value) ?? value; };
  const setPct = (key) => { if (out[key] === undefined) out[key] = normalizePercent(value) ?? value; };
  const setStr = (key) => { if (out[key] === undefined) out[key] = value; };

  if (title.includes('cotacao') || title.includes('preco atual') || title.includes('valor atual')) setNum('precoAtual');
  if (title.includes('variacao') && title.includes('12')) setPct('variacao12m');
  else if (title.includes('variacao') || title.includes('var. dia')) setPct('variacaoDay');
  if (title === 'dy' || title.includes('dividend yield')) setPct('dividendYield');
  if (title.includes('dy medio')) setPct('dyMedio5a');
  if (title === 'p/l' || title.includes('p/l')) setNum('pl');
  if (title.includes('p/vp')) setNum('pvp');
  if (title.includes('roe')) setPct('roe');
  if (title.includes('roic')) setPct('roic');
  if (title.includes('roa')) setPct('roa');
  if (title.includes('lpa')) setNum('lpa');
  if (title.includes('vpa') || title.includes('vp por cota') || title.includes('valor patrimonial por cota')) setNum('valorPatrimonial');
  if (title.includes('valor de mercado')) setNum('valorDeMercado');
  if (title.includes('valor de firma') || title.includes('enterprise value')) setNum('valorDeFirma');
  if (title.includes('patrimonio liquido')) setNum('patrimonioLiquido');
  if (title.includes('liquidez')) setNum(title.includes('corrente') ? 'liquidezCorrente' : 'liquidezDiaria');
  if (title.includes('payout')) setPct('payout');
  if (title.includes('margem liquida')) setPct('margemLiquida');
  if (title.includes('margem bruta')) setPct('margemBruta');
  if (title.includes('margem ebitda')) setPct('margemEbitda');
  if (title.includes('margem ebit') || title.includes('margem operacional')) setPct('margemEbit');
  if (title.includes('ev/ebitda')) setNum('evEbitda');
  if (title.includes('ev/ebit')) setNum('evEbit');
  if (title.includes('cagr') && title.includes('receita')) setPct('cagrReceitas5a');
  if (title.includes('cagr') && title.includes('lucro')) setPct('cagrLucros5a');
  if (title.includes('cnpj')) setStr('cnpj');
  if (title.includes('segmento')) setStr('segmentoFii');
  if (title.includes('tipo de fundo')) setStr('tipoFundo');
  if (title.includes('mandato')) setStr('mandato');
  if (title.includes('publico') && title.includes('alvo')) setStr('publicoAlvo');
  if (title.includes('gestao')) setStr('tipoGestao');
  if (title.includes('taxa') && title.includes('administracao')) setStr('taxaAdministracao');
  if (title.includes('prazo')) setStr('prazoDuracao');
  if (title.includes('vacancia fisica') || title === 'vacancia') setPct('vacanciaFisica');
  if (title.includes('vacancia financeira')) setPct('vacanciaFinanceira');
  if (title.includes('cotistas')) setNum('numeroCotistas');
  if (title.includes('cotas emitidas') || title.includes('nº de cotas') || title.includes('numero de cotas')) setNum('cotasEmitidas');
  if (title.includes('ultimo rendimento')) setNum('ultimoRendimento');
  if (title.includes('total pago')) setNum('totalDividendos12m');
}

function parseSelectorResults(ticker, type, selectorResults = {}) {
  const out = {};
  const cards = selectorResults.cards || [];
  for (let i = 0; i < cards.length; i += 2) processSelectorPairInto(out, cards[i], cards[i + 1]);
  const titles = selectorResults.cells_titles || [];
  const values = selectorResults.cells_values || [];
  for (let i = 0; i < titles.length; i++) processSelectorPairInto(out, titles[i], values[i]);
  const table = selectorResults.table || [];
  for (let i = 0; i < table.length; i += 2) processSelectorPairInto(out, table[i], table[i + 1]);

  const logos = selectorResults.logo || [];
  if (logos[0]) {
    const candidateLogo = String(logos[0]).startsWith('/') ? `https://investidor10.com.br${logos[0]}` : String(logos[0]);
    if (!isGenericInvestidor10Logo(candidateLogo)) out.logoUrl = candidateLogo;
  }
  const about = (selectorResults.about || [])
    .map(x => cleanAboutCandidate(x))
    .filter(Boolean)
    .slice(0, 3);
  if (about.length) out.sobre = about.join('\n\n');

  const propNames = selectorResults.props || [];
  const propSmalls = selectorResults.propsSmall || [];
  const imoveis = [];
  let smallIdx = 0;
  for (const nome of propNames) {
    if (!nome) continue;
    let estado = '', abl = '';
    for (let s = 0; s < 2 && smallIdx < propSmalls.length; s++, smallIdx++) {
      const txt = stripTags(propSmalls[smallIdx]);
      if (/estado:/i.test(txt)) estado = txt.replace(/estado:/i, '').trim();
      if (/área bruta locável:|area bruta locavel:/i.test(txt)) abl = txt.replace(/área bruta locável:|area bruta locavel:/i, '').trim();
    }
    imoveis.push({ nome: stripTags(nome), estado, abl });
  }
  if (imoveis.length) {
    out.sections = { listaImoveis: imoveis };
  }

  const foundKeys = Object.keys(out).filter(k => out[k] !== undefined && out[k] !== null && k !== 'sections');
  return { results: out, foundKeys, selectorOnly: true };
}

function parseInvestidor10Html(ticker, type, html, sourceUrl) {
  const text = stripTags(html);
  const compact = text.replace(/\s+/g, ' ').trim();
  const tables = parseHtmlTables(html);
  let baseFields = type === 'FII' ? applyFields(compact, FII_FIELDS) : applyFields(compact, ACAO_FIELDS);
  const genericSections = pruneBadSectionSummaries(extractGenericSectionData(text, tables));
  if (type === 'FII') baseFields = sanitizeFiiBaseFields(baseFields, text, ticker, genericSections);
  const cnpj = extractCnpj(compact);
  if (cnpj && !baseFields.cnpj) baseFields.cnpj = cnpj;
  const h1 = getH1(html);
  const pageTitle = getPageTitle(html);
  if (h1) baseFields.nome = h1;
  else if (pageTitle) baseFields.nome = pageTitle;

  const aboutPresentation = extractInvestidor10AboutPresentation(html, text, ticker, type);
  const aboutCompany = aboutPresentation?.summary || extractAboutCompany(html, text, ticker, type);
  if (aboutCompany) {
    baseFields.sobre = aboutCompany;
    if (aboutPresentation?.summary) {
      baseFields.profilePresentation = aboutPresentation;
      baseFields.assetPresentation = aboutPresentation;
    }
  } else if (baseFields.sobre && cleanAboutCandidate(baseFields.sobre) === '') delete baseFields.sobre;
  if (type !== 'FII') {
    const cadastro = extractCompanyCadastroInfo(text);
    baseFields = { ...baseFields, ...cadastro };
    if (Object.keys(cadastro).length) baseFields.dadosEmpresa = { ...(baseFields.dadosEmpresa || {}), ...cadastro };
  }

  const dividendos = extractDividendHistory(compact);
  if (dividendos.length) baseFields.historicoDividendos = dividendos;

  const sections = {
    ...genericSections,
    checklistBah: extractChecklist(text, type),
    checklist: extractChecklist(text, type),
    checklistBuyHold: extractChecklist(text, type),
    dividendos: {
      historico: dividendos,
      totalDividendos12m: baseFields.totalDividendos12m,
      dividendYield: baseFields.dividendYield,
      dyMedio5a: baseFields.dyMedio5a,
      radar: genericSections.radarDividendos || null,
    },
    comunicados: extractComunicados(html, text),
    charts: extractChartCandidates(html),
    links: extractLinks(html, sourceUrl).slice(0, 80),
  };
  if (aboutCompany) sections.sobre = {
    text: aboutCompany,
    presentation: aboutPresentation || null,
    narrativeBlocks: aboutPresentation?.sections || [],
    keyValues: extractPairsFromText(aboutCompany).slice(0, 20),
    length: aboutCompany.length
  };

  if (type === 'FII') {
    sections.listaImoveis = extractImoveis(text, tables);
    sections.fiiChecklist = extractChecklist(text, type);
    sections.informacoesFundo = pick(baseFields, [
      'cnpj','numeroCotistas','cotasEmitidas','taxaAdministracao','tipoFundo','segmentoFii','mandato','publicoAlvo','tipoGestao','prazoDuracao','vacanciaFisica','vacanciaFinanceira'
    ]);
    sections.distribuicoes12m = pick(baseFields, ['yield1m','yield3m','yield6m','yield12m','totalDividendos12m','ultimoRendimento']);
    if (genericSections.mediaTipoSegmento && Object.keys(genericSections.mediaTipoSegmento).length) sections.mediaTipoSegmento = genericSections.mediaTipoSegmento;
    else { const mediaFallback = pick(baseFields, ['pvpMedioTipo','dyMedioTipo']); if (Object.keys(mediaFallback).length) sections.mediaTipoSegmento = mediaFallback; }
    sections.valorPatrimonial = pick(baseFields, ['valorPatrimonial','valorPatrimonialTotal','patrimonioLiquido','pvp']);
  } else {
    sections.empresa = {
      sobre: aboutCompany ? { text: aboutCompany, presentation: aboutPresentation || null, narrativeBlocks: aboutPresentation?.sections || [] } : (genericSections.sobre || null),
      dados: pick(baseFields, ['cnpj','nomeCompleto','anoEstreiaBolsa','numeroFuncionarios','anoFundacao','papeisEmpresa','papeisFracionados','valorDeMercado','valorDeFirma','patrimonioLiquido','ativosTotais','faturamento12m','lucro12m','freeFloat','tagAlong']),
      regioesReceita: genericSections.regioesReceita || null,
      negociosReceita: genericSections.negociosReceita || null,
      posicaoAcionaria: genericSections.posicaoAcionaria || null,
    };
    sections.demonstrativos = {
      receitasLucros: genericSections.receitasLucros || null,
      lucroCotacao: genericSections.lucroCotacao || null,
      resultados: genericSections.resultados || null,
      evolucaoPatrimonio: genericSections.evolucaoPatrimonio || null,
      balancoPatrimonial: genericSections.balancoPatrimonial || null,
    };
  }

  baseFields.sections = sections;
  const foundKeys = Object.keys(baseFields).filter(k => baseFields[k] !== undefined && baseFields[k] !== null && k !== 'sections');
  return {
    results: baseFields,
    foundKeys,
    htmlBytesProcessed: html.length,
    textBytesProcessed: text.length,
    tableCount: tables.length,
    chartCandidateCount: sections.charts.length,
    sourceUrl,
  };
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}


function historicalCurrentValue(results = {}, indicadorRe) {
  const hist = results.sections?.historicoIndicadores || results.historicoIndicadores;
  const linhas = Array.isArray(hist?.linhas) ? hist.linhas : [];
  const row = linhas.find(r => indicadorRe.test(String(r?.indicador || '')));
  if (!row?.valores) return undefined;
  return row.valores.Atual || row.valores.atual || row.valores['Último'] || row.valores['Ultimo'];
}

function cleanFiiInfoObject(info = {}) {
  const out = { ...(info || {}) };
  for (const key of ['taxaAdministracao','tipoFundo','segmentoFii','mandato','tipoGestao','prazoDuracao','publicoAlvo']) {
    if (typeof out[key] === 'string') out[key] = cleanFiiTextValue(out[key]);
  }
  return out;
}

function sanitizeFiiSections(results = {}) {
  const out = { ...results };
  const sections = { ...(out.sections || {}) };

  // Blocos que aparecem em FIIs por navegação global ou por área de ações/commodities.
  for (const key of ['radarDividendos','comparadorAcoes','comparador','comparacaoCommodity','dividendYieldSecao']) delete sections[key];
  if (sections.radarDividendos?.text && looksLikeNavigationBlock(sections.radarDividendos.text)) delete sections.radarDividendos;

  if (sections.informacoesFundo) {
    sections.informacoesFundo = cleanFiiInfoObject(sections.informacoesFundo);
    for (const [k, v] of Object.entries(sections.informacoesFundo)) if (out[k] === undefined || out[k] === null || out[k] === '') out[k] = v;
  }

  if (isGenericInvestidor10Logo(out.logoUrl)) delete out.logoUrl;

  const sectionAbout = typeof sections.sobre === 'string' ? sections.sobre : sections.sobre?.text;
  const cleanSectionAbout = cleanAboutCandidate(sectionAbout || '');
  if (cleanSectionAbout) out.sobre = cleanSectionAbout;
  else if (isGenericAboutText(out.sobre)) delete out.sobre;

  if (out.dividendos && !sections.dividendos) sections.dividendos = out.dividendos;

  const dy12m = sections.distribuicoes12m?.yield12m || out.yield12m || historicalCurrentValue({ ...out, sections }, /^Dividend Yield$/i) || out.dividendYield;
  if (dy12m && sections.dividendos) {
    if (!sections.dividendos.dividendYield || sections.dividendos.dividendYield === '8%' || /^8,?00?%?$/.test(String(sections.dividendos.dividendYield))) {
      sections.dividendos.dividendYield = dy12m;
    }
    out.dividendos = sections.dividendos;
  }
  if ((!out.dividendYield || out.dividendYield === '8%' || /^8,?00?%?$/.test(String(out.dividendYield))) && dy12m) out.dividendYield = dy12m;

  const vpTotalRaw = historicalCurrentValue({ ...out, sections }, /^Valor Patrimonial$/i);
  const vpCotaRaw = historicalCurrentValue({ ...out, sections }, /Val\. Patrimonial p\/ Cota|Valor Patrimonial.*Cota/i);
  const pvpRaw = historicalCurrentValue({ ...out, sections }, /^P\/VP$/i);
  const valorMercadoRaw = historicalCurrentValue({ ...out, sections }, /^Valor de Mercado$/i);
  const liquidezRaw = historicalCurrentValue({ ...out, sections }, /Liquidez Diária|Liquidez Media Diaria|Liquidez Média Diária/i);
  const cotistasRaw = historicalCurrentValue({ ...out, sections }, /Número de Cotistas|Numero de Cotistas/i);
  const cotasRaw = historicalCurrentValue({ ...out, sections }, /Cotas Emitidas/i);

  sections.valorPatrimonial = { ...(sections.valorPatrimonial || {}) };
  if (vpTotalRaw) {
    sections.valorPatrimonial.patrimonioLiquidoRaw = vpTotalRaw;
    const n = normalizeBRNumber(vpTotalRaw);
    if (n !== undefined) {
      sections.valorPatrimonial.patrimonioLiquido = n;
      sections.valorPatrimonial.valorPatrimonialTotal = n;
      out.patrimonioLiquido = n;
      out.valorPatrimonialTotal = n;
    }
  }
  if (vpCotaRaw) {
    sections.valorPatrimonial.valorPatrimonialRaw = vpCotaRaw;
    const n = normalizeBRNumber(vpCotaRaw);
    if (n !== undefined) {
      sections.valorPatrimonial.valorPatrimonial = n;
      out.valorPatrimonial = n;
    }
  }
  if (pvpRaw) {
    const n = normalizeBRNumber(pvpRaw);
    if (n !== undefined) {
      sections.valorPatrimonial.pvp = n;
      out.pvp = n;
    }
  }
  if (valorMercadoRaw) {
    const n = normalizeBRNumber(valorMercadoRaw);
    if (n !== undefined) {
      out.valorDeMercado = n;
      sections.valorPatrimonial.valorDeMercado = n;
      sections.valorPatrimonial.valorDeMercadoRaw = valorMercadoRaw;
    }
  }
  if (liquidezRaw) {
    const n = normalizeBRNumber(liquidezRaw);
    if (n !== undefined) out.liquidezDiaria = n;
  }
  // Mantém o valor exato vindo da seção cadastral; usa histórico só quando não houver número real.
  if (out.numeroCotistas === undefined && cotistasRaw) {
    const n = normalizeBRNumber(cotistasRaw);
    if (n !== undefined) out.numeroCotistas = n;
  }
  if (out.cotasEmitidas === undefined && cotasRaw) {
    const n = normalizeBRNumber(cotasRaw);
    if (n !== undefined) out.cotasEmitidas = n;
  }

  out.sections = sections;
  return out;
}

function sanitizeAcaoResults(results = {}) {
  const out = { ...results };
  const sem = out.indicadoresFundamentalistas?.semComparativos;
  if (sem && typeof sem === 'object') {
    // O parser amplo pode pegar valores de cards vizinhos; o bloco estruturado de indicadores tem prioridade.
    const keys = [
      'pl','pvp','psr','dividendYield','payout','margemLiquida','margemBruta','margemEbit','margemEbitda',
      'evEbitda','evEbit','pEbitda','pEbit','pAtivo','pCapGiro','pAtivoCircLiq','vpa','valorPatrimonial','lpa',
      'giroAtivos','roe','roic','roa','dividaLiquidaPatrimonio','dividaLiquidaEbitda','dividaLiquidaEbit',
      'dividaBrutaPatrimonio','patrimonioAtivos','passivosAtivos','liquidezCorrente','cagrReceitas5a','cagrLucros5a'
    ];
    for (const key of keys) {
      const semKey = key === 'dividendYield' ? 'dy' : key;
      if (sem[semKey] !== undefined) out[key] = sem[semKey];
    }
    if (sem.dy !== undefined) out.dividendYield = sem.dy;
    if (sem.vpa !== undefined) out.valorPatrimonial = sem.vpa;
  }

  if (out.dadosEmpresa?.cnpj && !out.cnpj) out.cnpj = out.dadosEmpresa.cnpj;
  if (out.informacoesEmpresa && typeof out.informacoesEmpresa === 'object') {
    for (const key of ['valorDeMercado','valorDeFirma','patrimonioLiquido','freeFloat','tagAlong','liquidezMediaDiaria']) {
      if (out.informacoesEmpresa[key] !== undefined) out[key] = out.informacoesEmpresa[key];
    }
    if (out.informacoesEmpresa.liquidezMediaDiaria !== undefined) out.liquidezDiaria = out.informacoesEmpresa.liquidezMediaDiaria;
  }

  if (out.dividendos?.historico?.length && !out.historicoDividendos?.length) out.historicoDividendos = out.dividendos.historico;
  if (out.dividendos?.dividendYield) out.dividendYield = out.dividendos.dividendYield;
  if (out.dividendos?.dyMedio5a) out.dyMedio5a = out.dividendos.dyMedio5a;

  const sections = { ...(out.sections || {}) };
  if (out.indicadoresFundamentalistas) sections.indicadores = out.indicadoresFundamentalistas;
  if (out.rentabilidade) sections.rentabilidade = out.rentabilidade;
  if (out.rentabilidadeReal) sections.rentabilidadeReal = out.rentabilidadeReal;
  if (out.checklistBuyAndHold) sections.checklistBah = out.checklistBuyAndHold;
  if (out.dividendos) sections.dividendos = out.dividendos;
  if (out.tabelaComparativoPares) sections.comparador = { pares: out.tabelaComparativoPares };
  if (out.commodities) sections.comparacaoCommodity = out.commodities;
  if (out.noticias) sections.comunicados = out.noticias;
  if (out.dadosEmpresa || out.informacoesEmpresa || out.sobre || out.profilePresentation || out.assetPresentation) {
    sections.empresa = mergeSectionsDeep(sections.empresa || {}, {
      sobre: isGenericAboutText(out.sobre) ? undefined : { text: out.sobre, presentation: out.profilePresentation || out.assetPresentation || null, narrativeBlocks: out.profilePresentation?.sections || out.assetPresentation?.sections || [] },
      dados: out.dadosEmpresa,
      informacoes: out.informacoesEmpresa,
      profilePresentation: out.profilePresentation || out.assetPresentation || undefined,
    });
  }
  if (Object.keys(sections).length) out.sections = sections;

  if (isGenericInvestidor10Logo(out.logoUrl)) delete out.logoUrl;
  // Para ação, a descrição SEO do ticker ainda é melhor do que texto genérico global; remove só os blocos claramente globais/lixo.
  if (isGenericAboutText(out.sobre) && !new RegExp(`\b${escapeRe(String(out.nome || ''))}\b|\b${escapeRe(String(out.dadosEmpresa?.nomeCompleto || ''))}\b`, 'i').test(String(out.sobre || ''))) delete out.sobre;
  return out;
}

function postProcessResultsByType(ticker, type, results = {}) {
  if (type === 'FII') return sanitizeFiiSections(results);
  return sanitizeAcaoResults(results);
}

function mergeParsedResults(primary = {}, secondary = {}) {
  // primary = seletores retornados pelo ValoraeScrape; secondary = parser amplo + parser específico por seção.
  // Na v19.9 o parser específico do HTML tem prioridade para evitar campos de FII poluídos por checklist/menu.
  const merged = { ...primary, ...secondary };
  if (primary.sections || secondary.sections) {
    merged.sections = mergeSectionsDeep(primary.sections || {}, secondary.sections || {});
  }
  return merged;
}

function buildCoverage(type, results = {}) {
  const s = results.sections || {};
  const common = {
    rentabilidade: !!(s.rentabilidade || s.rentabilidadeChart),
    historicoIndicadores: !!(s.historicoIndicadores || results.historicoIndicadores),
    checklistBah: Array.isArray(s.checklistBah) ? s.checklistBah.length > 0 : !!s.checklistBah,
    dividendos: !!(results.historicoDividendos?.length || s.dividendos?.historico?.length),
    comunicados: Array.isArray(s.comunicados) ? s.comunicados.length > 0 : !!s.comunicados,
    graficos: !!(s.rentabilidadeChart || results.chartsFinanceiros || (Array.isArray(s.charts) && s.charts.length > 0)),
  };
  if (type === 'FII') {
    return {
      ...common,
      informacoesFundo: !!s.informacoesFundo && Object.keys(s.informacoesFundo).length > 0,
      comparacaoIndices: !!s.comparacaoIndices,
      comparacaoFiis: !!s.comparacaoFiis,
      distribuicoes12m: !!s.distribuicoes12m && Object.keys(s.distribuicoes12m).length > 0,
      dividendYield: !!(results.dividendYield || s.dividendYieldSecao),
      sobre: !!results.sobre,
      listaImoveis: Array.isArray(s.listaImoveis) ? s.listaImoveis.length > 0 : !!s.listaImoveis,
      valorPatrimonial: !!(s.valorPatrimonial || results.valorPatrimonial || results.valorPatrimonialTotal),
      mediaTipoSegmento: !!s.mediaTipoSegmento,
    };
  }
  return {
    ...common,
    indicadores: ['pl','pvp','dividendYield','roe','roic','payout'].some(k => results[k] !== undefined),
    radarDividendos: !!s.radarDividendos,
    comparadorAcoes: !!(s.comparadorAcoes || s.comparador),
    comparacaoIndices: !!s.comparacaoIndices,
    comparacaoCommodity: !!s.comparacaoCommodity,
    sobreEmpresa: !!(results.sobre || s.empresa?.sobre),
    dadosEmpresa: !!(s.empresa?.dados && Object.keys(s.empresa.dados).length > 0),
    regioesReceita: !!(s.empresa?.regioesReceita || results.revenueGeography),
    negociosReceita: !!(s.empresa?.negociosReceita || results.revenueSegment),
    posicaoAcionaria: !!s.empresa?.posicaoAcionaria,
    receitasLucros: !!(s.demonstrativos?.receitasLucros || results.chartsFinanceiros?.receitasLucros),
    lucroCotacao: !!(s.demonstrativos?.lucroCotacao || results.chartsFinanceiros?.lucroCotacao),
    resultados: !!s.demonstrativos?.resultados,
    evolucaoPatrimonio: !!(s.demonstrativos?.evolucaoPatrimonio || results.chartsFinanceiros?.evolucaoPatrimonio),
    balancoPatrimonial: !!s.demonstrativos?.balancoPatrimonial,
  };
}


function buildQualityReport(type, results = {}, coverage = {}, warnings = []) {
  const checks = [];
  let score = 0;
  let max = 0;
  const add = (name, ok, weight, note = '') => {
    const passed = !!ok;
    checks.push({ name, ok: passed, weight, note });
    max += weight;
    if (passed) score += weight;
  };

  if (type === 'FII') {
    add('identidade', !!(results.nome || results.sobre || results.cnpj), 10, 'Nome, CNPJ ou descrição do fundo.');
    add('informacoesFundo', !!(coverage.informacoesFundo || results.informacoesFundo || results.numeroCotistas), 14, 'Dados cadastrais do FII.');
    add('indicadoresFii', !!(results.pvp || results.dividendYield || results.yield12m || results.valorPatrimonial), 14, 'P/VP, DY, VP/cota e yields.');
    add('historicoIndicadores', !!coverage.historicoIndicadores, 14, 'Histórico anual de indicadores.');
    add('dividendos', !!coverage.dividendos, 14, 'Histórico de distribuições.');
    add('rentabilidade', !!coverage.rentabilidade, 10, 'Rentabilidade nominal/real e/ou gráfico.');
    add('portfolioImoveis', !!coverage.listaImoveis, 10, 'Lista de imóveis/portfólio.');
    add('comparativos', !!(coverage.comparacaoIndices || coverage.mediaTipoSegmento || results.rentabilidadeVsIndicadores), 8, 'Comparativos com índices, tipo ou segmento.');
    add('comunicadosNoticias', !!coverage.comunicados, 6, 'Comunicados ou notícias relacionadas.');
  } else {
    add('cotacao', !!(results.precoAtual || results.variacaoDay || results.variacao12m), 10, 'Cotação atual e variações.');
    add('indicadores', !!coverage.indicadores, 16, 'Indicadores fundamentalistas.');
    add('comparativoSetor', !!(results.comparativoSetor || results.indicadoresFundamentalistas?.comparativoSetor), 12, 'Comparação setor/subsetor/segmento.');
    add('empresa', !!(coverage.dadosEmpresa || results.dadosEmpresa || results.informacoesEmpresa), 12, 'Dados cadastrais e informações corporativas.');
    add('dividendos', !!coverage.dividendos, 12, 'Dividendos e DY.');
    add('rentabilidade', !!coverage.rentabilidade, 10, 'Rentabilidade nominal/real.');
    add('checklist', !!coverage.checklistBah, 8, 'Checklist buy and hold.');
    add('comparadorPares', !!coverage.comparadorAcoes, 8, 'Tabela de pares/concorrentes.');
    add('graficosFinanceiros', !!(coverage.receitasLucros || coverage.lucroCotacao || coverage.evolucaoPatrimonio || coverage.graficos), 8, 'Gráficos e APIs internas.');
    add('comunicadosNoticias', !!coverage.comunicados, 4, 'Comunicados ou notícias relacionadas.');
  }

  const penalties = [];
  if (isGenericInvestidor10Logo(results.logoUrl)) penalties.push({ code: 'GENERIC_LOGO', points: 4, message: 'logoUrl genérico do Investidor10 detectado.' });
  if (isGenericAboutText(results.sobre)) penalties.push({ code: 'GENERIC_ABOUT', points: 6, message: 'Descrição genérica detectada.' });
  if (warnings?.length) penalties.push({ code: 'WARNINGS', points: Math.min(8, warnings.length * 2), message: `${warnings.length} aviso(s) no processamento.` });

  const penaltyPoints = penalties.reduce((sum, p) => sum + p.points, 0);
  const pct = max ? Math.max(0, Math.min(100, Math.round((score / max) * 100 - penaltyPoints))) : 0;
  return { score: pct, grade: pct >= 90 ? 'A' : pct >= 75 ? 'B' : pct >= 60 ? 'C' : 'D', checks, penalties };
}

async function fetchYahooChart(ticker, options = {}) {
  const t = canonicalizeTicker(ticker);
  const symbol = /^[A-Z]{1,5}$/.test(t) ? t : `${t}.SA`;
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  for (const host of hosts) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
    const controller = new AbortController();
    const timeoutMs = boundedTimeout(options.timeoutMs || DEFAULT_TIMEOUT_MS, options.yahooTimeoutMs || 7000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': browserHeaders(url)['User-Agent'], 'Accept': 'application/json' } });
      if (!res.ok) continue;
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      const meta = result?.meta || {};
      const price = meta.regularMarketPrice ?? meta.previousClose;
      const previous = meta.chartPreviousClose ?? meta.previousClose;
      const out = {};
      if (Number.isFinite(price)) out.precoAtual = price;
      if (Number.isFinite(price) && Number.isFinite(previous) && previous !== 0) {
        out.variacaoDay = `${(((price - previous) / previous) * 100).toFixed(2)}%`;
      }
      if (Object.keys(out).length) return { ok: true, data: out, source: 'YahooChart' };
    } catch {
      // ignora e tenta próximo host
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, data: {}, source: 'YahooChart', error: 'Yahoo Chart indisponível' };
}

function cloneNewsValue(value = {}, extra = {}) {
  return {
    ...value,
    ...extra,
    items: Array.isArray(value.items) ? value.items.map(item => ({ ...item })) : [],
    appPolicy: {
      canReplacePreviousNews: Array.isArray(value.items) && value.items.length > 0,
      shouldKeepPreviousNews: !(Array.isArray(value.items) && value.items.length > 0),
      optionalBlock: true,
      ...(value.appPolicy || {}),
      ...(extra.appPolicy || {}),
    },
    reliability: {
      version: VALORAE_NEWS_RELIABILITY_VERSION,
      source: value.source || 'GoogleNewsRSS',
      state: extra?.reliability?.state || value?.reliability?.state || (value.ok ? 'LIVE_OK' : 'UNAVAILABLE'),
      optionalBlock: true,
      ...(value.reliability || {}),
      ...(extra.reliability || {}),
    },
  };
}

function setNewsCache(cacheKey, value) {
  if (!value?.ok || !Array.isArray(value.items) || value.items.length === 0) return;
  while (newsCache.size >= NEWS_CACHE_MAX_ENTRIES) {
    const oldest = newsCache.keys().next().value;
    if (oldest === undefined) break;
    newsCache.delete(oldest);
    newsCacheMetrics.evictions += 1;
  }
  newsCache.set(cacheKey, { createdAt: Date.now(), value: cloneNewsValue(value, { cacheStatus: 'NEWS_CACHE_SEED' }) });
  newsCacheMetrics.sets += 1;
}

function readNewsCache(cacheKey) {
  const cached = newsCache.get(cacheKey);
  if (!cached) return null;
  const ageMs = Date.now() - Number(cached.createdAt || 0);
  if (ageMs <= NEWS_CACHE_TTL_MS) return { ...cached, ageMs, state: 'fresh' };
  if (ageMs <= NEWS_CACHE_TTL_MS + NEWS_CACHE_STALE_MS) return { ...cached, ageMs, state: 'stale' };
  newsCache.delete(cacheKey);
  newsCacheMetrics.evictions += 1;
  return null;
}

function newsUnavailable({ clean, query, code, error, timeoutMs, status, items = [] } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  return {
    ok: false,
    empty: safeItems.length === 0,
    items: safeItems,
    count: safeItems.length,
    source: 'GoogleNewsRSS',
    query,
    ticker: clean,
    code: code || (safeItems.length ? 'GOOGLE_NEWS_FILTERED_OUT' : 'GOOGLE_NEWS_EMPTY'),
    status,
    warning: error,
    message: error || 'Notícias temporariamente indisponíveis.',
    timeoutMs,
    cacheStatus: 'NEWS_UNAVAILABLE',
    fetchedAt: nowIso(),
    appPolicy: {
      canReplacePreviousNews: false,
      shouldKeepPreviousNews: true,
      optionalBlock: true,
      message: 'Notícias são bloco opcional: mantenha a última lista boa quando a fonte RSS falhar ou vier vazia.',
    },
    reliability: {
      version: VALORAE_NEWS_RELIABILITY_VERSION,
      source: 'GoogleNewsRSS',
      state: 'UNAVAILABLE_OPTIONAL',
      optionalBlock: true,
      canReplacePreviousNews: false,
      shouldKeepPreviousNews: true,
    },
  };
}

function newsDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function newsDateMs(item = {}) {
  const raw = item.publishedAt ?? item.pubDate ?? item.date ?? item.time ?? item.timestamp ?? '';
  if (typeof raw === 'number') return raw > 9_999_999_999 ? raw : raw * 1000;
  const str = String(raw || '').trim();
  if (!str) return 0;
  if (/^\d+$/.test(str)) {
    const n = Number(str);
    return n > 9_999_999_999 ? n : n * 1000;
  }
  const parsed = Date.parse(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortNewsNewestFirst(items = []) {
  return [...items].sort((a, b) => {
    const byDate = newsDateMs(b) - newsDateMs(a);
    if (byDate) return byDate;
    const byScore = Number(b.relevanceScore || 0) - Number(a.relevanceScore || 0);
    if (byScore) return byScore;
    return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR', { sensitivity: 'base' });
  });
}

async function fetchGoogleNews(ticker, aliases = [], limit = DEFAULT_NEWS_LIMIT, options = {}) {
  const clean = canonicalizeTicker(ticker);
  const safeLimit = Math.max(1, Math.min(50, Number(limit || DEFAULT_NEWS_LIMIT) || DEFAULT_NEWS_LIMIT));
  const searchQuery = String(options.searchQuery || options.search || options.query || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const hasSearchQuery = searchQuery.length >= 3;
  const isGeneralNews = !clean && !hasSearchQuery;
  const baseTerms = (hasSearchQuery
    ? [searchQuery, ...(clean ? [`${clean}`, `${clean}.SA`] : []), ...aliases]
    : (isGeneralNews
      ? ['B3', 'Ibovespa', 'ações brasileiras', 'FIIs', 'dividendos', 'proventos']
      : [`${clean}`, `${clean}.SA`, ...aliases]))
    .map(s => String(s || '').trim())
    .filter(s => s && s.length >= 3)
    .slice(0, 8);
  const asOfDay = newsDayKey();
  const cacheKey = `news:${asOfDay}:${clean || 'GERAL'}:${baseTerms.join('|')}:${safeLimit}`;
  const cached = readNewsCache(cacheKey);
  if (cached?.state === 'fresh' && !options.refresh && !options.nocache && !options.bypassCache) {
    newsCacheMetrics.hits += 1;
    return cloneNewsValue(cached.value, { cacheStatus: 'NEWS_CACHE_HIT', cachedAt: new Date(cached.createdAt).toISOString(), ageMs: cached.ageMs, reliability: { state: 'CACHE_OK' } });
  }
  if (cached?.state === 'stale' && shouldServeStaleWhileRevalidate(options)) {
    newsCacheMetrics.staleHits += 1;
    return cloneNewsValue(cached.value, { cacheStatus: 'NEWS_STALE_WHILE_REVALIDATE', stale: true, cachedAt: new Date(cached.createdAt).toISOString(), ageMs: cached.ageMs, reliability: { state: 'STALE_OK' }, appPolicy: { canReplacePreviousNews: true, shouldKeepPreviousNews: false } });
  }
  if (newsInFlight.has(cacheKey)) {
    newsCacheMetrics.inflightJoins += 1;
    const joined = await newsInFlight.get(cacheKey);
    return cloneNewsValue(joined, { cacheStatus: joined.cacheStatus === 'NEWS_LIVE' ? 'NEWS_INFLIGHT_JOIN' : joined.cacheStatus, reliability: { state: joined.ok ? 'INFLIGHT_OK' : joined?.reliability?.state } });
  }

  newsCacheMetrics.misses += 1;
  const promise = (async () => {
    const quotedAliases = baseTerms.map(term => term.includes(' ') ? `"${term}"` : term);
    const query = isGeneralNews
      ? '(B3 OR Ibovespa OR "bolsa brasileira" OR ações OR FIIs OR dividendos OR proventos OR resultados OR balanço) when:1d'
      : `(${quotedAliases.join(' OR ')}) (B3 OR ações OR ação OR bolsa OR dividendos OR proventos OR resultados OR balanço OR FII OR "fundo imobiliário") when:1d`;
    const params = new URLSearchParams({ q: query, hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' });
    const url = `https://news.google.com/rss/search?${params.toString()}`;
    const controller = new AbortController();
    const timeoutMs = boundedTimeout(options.timeoutMs || DEFAULT_TIMEOUT_MS, options.newsTimeoutMs || 2500);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': browserHeaders(url)['User-Agent'], 'Accept': 'application/rss+xml,application/xml,text/xml' } });
      if (!res.ok) throw Object.assign(new Error(`Google News HTTP ${res.status}`), { status: res.status });
      const xml = await res.text();
      const rawItems = parseRssItems(xml);
      const items = sortNewsNewestFirst(
        rawItems
          .map(item => ({ ...item, query, relevanceScore: scoreNews(item, clean, baseTerms) }))
          .filter(item => {
            const ts = newsDateMs(item);
            const now = Date.now();
            return item.relevanceScore > 0 && ts > 0 && ts <= now + 10 * 60_000 && (now - ts) <= 36 * 60 * 60 * 1000;
          })
      ).slice(0, safeLimit);
      if (!items.length) {
        newsCacheMetrics.empty += 1;
        if (cached?.state === 'stale') {
          newsCacheMetrics.staleHits += 1;
          return cloneNewsValue(cached.value, { cacheStatus: 'NEWS_STALE_IF_EMPTY', stale: true, cachedAt: new Date(cached.createdAt).toISOString(), ageMs: cached.ageMs, liveEmpty: true, code: 'GOOGLE_NEWS_EMPTY_WITH_STALE_FALLBACK', reliability: { state: 'STALE_OK' }, appPolicy: { canReplacePreviousNews: true, shouldKeepPreviousNews: false } });
        }
        return newsUnavailable({ clean, query, code: rawItems.length ? 'GOOGLE_NEWS_NO_RELEVANT_ITEMS' : 'GOOGLE_NEWS_EMPTY', timeoutMs, items: [] });
      }
      const value = {
        ok: true,
        empty: false,
        items,
        count: items.length,
        source: 'GoogleNewsRSS',
        query,
        searchQuery,
        ticker: clean,
        code: 'GOOGLE_NEWS_OK',
        cacheStatus: 'NEWS_LIVE',
        fetchedAt: nowIso(),
        asOf: asOfDay,
        sortedBy: 'publishedAt_desc_today_first',
        timeoutMs,
        appPolicy: { canReplacePreviousNews: true, shouldKeepPreviousNews: false, optionalBlock: true, queryWindow: 'when:1d', maxAgeHours: 36 },
        reliability: { version: VALORAE_NEWS_RELIABILITY_VERSION, source: 'GoogleNewsRSS', state: 'LIVE_OK', optionalBlock: true, count: items.length },
      };
      setNewsCache(cacheKey, value);
      return cloneNewsValue(value);
    } catch (err) {
      newsCacheMetrics.errors += 1;
      if (cached?.state === 'stale') {
        newsCacheMetrics.staleHits += 1;
        return cloneNewsValue(cached.value, { cacheStatus: 'NEWS_STALE_IF_ERROR', stale: true, cachedAt: new Date(cached.createdAt).toISOString(), ageMs: cached.ageMs, liveError: err?.message || 'Falha no Google News', code: 'GOOGLE_NEWS_STALE_IF_ERROR', reliability: { state: 'STALE_OK' }, appPolicy: { canReplacePreviousNews: true, shouldKeepPreviousNews: false } });
      }
      const code = err?.name === 'AbortError' ? 'GOOGLE_NEWS_TIMEOUT' : (err?.status ? 'GOOGLE_NEWS_HTTP_ERROR' : 'GOOGLE_NEWS_FETCH_FAILED');
      return newsUnavailable({ clean, query, code, error: err?.message || 'Falha no Google News', timeoutMs, status: err?.status });
    } finally {
      clearTimeout(timer);
    }
  })();
  newsInFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    newsInFlight.delete(cacheKey);
  }
}


function normalizeNewsHttpUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withProtocol);
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function newsSourceDomain(value = '') {
  const safeUrl = normalizeNewsHttpUrl(value);
  if (!safeUrl) return '';
  try {
    return new URL(safeUrl).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function newsSourceLogoUrl(domain = '') {
  const clean = String(domain || '').trim().replace(/^www\./i, '').toLowerCase();
  return clean ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=64` : '';
}

function brandNewsItem(item = {}) {
  const sourceUrl = normalizeNewsHttpUrl(item.sourceUrl || item.source_url || item.publisherUrl || item.publisher_url || '');
  const linkDomain = newsSourceDomain(item.url || item.link || '');
  const sourceDomain = String(item.sourceDomain || item.source_domain || '').trim().replace(/^www\./i, '').toLowerCase()
    || newsSourceDomain(sourceUrl)
    || (linkDomain.includes('news.google.') ? '' : linkDomain);
  const sourceLogoUrl = String(item.sourceLogoUrl || item.source_logo_url || item.logoUrl || item.logo_url || item.faviconUrl || item.favicon_url || '').trim()
    || newsSourceLogoUrl(sourceDomain);
  return {
    ...item,
    sourceUrl,
    source_url: sourceUrl,
    publisherUrl: sourceUrl,
    publisher_url: sourceUrl,
    sourceDomain,
    source_domain: sourceDomain,
    publisherDomain: sourceDomain,
    publisher_domain: sourceDomain,
    sourceLogoUrl,
    source_logo_url: sourceLogoUrl,
    faviconUrl: sourceLogoUrl,
    favicon_url: sourceLogoUrl
  };
}

function parseRssItems(xml) {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && out.length < 50) {
    const item = m[1];
    const title = decodeHtml(firstMatch(item, /<title>([\s\S]*?)<\/title>/i) || '');
    const link = decodeHtml(firstMatch(item, /<link>([\s\S]*?)<\/link>/i) || '');
    const pubRaw = decodeHtml(firstMatch(item, /<pubDate>([\s\S]*?)<\/pubDate>/i) || '');
    const source = decodeHtml(firstMatch(item, /<source[^>]*>([\s\S]*?)<\/source>/i) || '');
    const sourceUrl = decodeHtml(firstMatch(item, /<source[^>]*\surl=["']([^"']+)["'][^>]*>/i) || '');
    const desc = stripTags(firstMatch(item, /<description>([\s\S]*?)<\/description>/i) || '');
    if (title && link) {
      const dateMs = Date.parse(pubRaw || '');
      const isoDate = Number.isFinite(dateMs) ? new Date(dateMs).toISOString() : undefined;
      out.push(brandNewsItem({
        title,
        link,
        url: link,
        pubDate: isoDate,
        publishedAt: isoDate,
        timestamp: Number.isFinite(dateMs) ? Math.floor(dateMs / 1000) : undefined,
        source,
        provider: source,
        sourceUrl,
        snippet: desc,
        summary: desc,
        category: 'Mercado'
      }));
    }
  }
  return out;
}

function scoreNews(item, ticker, aliases) {
  const hay = `${item.title} ${item.snippet} ${item.source}`.toLowerCase();
  let score = 0;
  if (!ticker) {
    if (/b3|ibovespa|bolsa|ações|acao|fii|fundo imobiliário|dividend|provento|jcp|resultado|balanço|lucro|cotação/i.test(hay)) score += 6;
  } else {
    if (hay.includes(ticker.toLowerCase())) score += 10;
    if (hay.includes(`${ticker.toLowerCase()}.sa`)) score += 12;
  }
  for (const alias of aliases) {
    const a = alias.toLowerCase();
    if (a.length >= 5 && hay.includes(a)) score += 3;
  }
  if (/dividend|provento|jcp|resultado|balanço|lucro|prejuízo|cotação|ação|bolsa|fii|fundo imobiliário/i.test(hay)) score += 3;
  return score;
}


export function clearValoraeCaches(scope = 'all') {
  const normalized = String(scope || 'all').toLowerCase();
  const before = getValoraeRuntimeStats().caches;
  if (normalized === 'all' || normalized === 'asset' || normalized === 'assetresult') {
    assetResultCache.clear();
    assetResultInFlight.clear();
    assetResultCacheBytes = 0;
    Object.keys(assetResultMetrics).forEach(k => { assetResultMetrics[k] = 0; });
  }
  if (normalized === 'all' || normalized === 'html') { htmlCache.clear(); htmlCacheFamilies.clear(); }
  if (normalized === 'all' || normalized === 'scrape-result' || normalized === 'scrapeResult') clearScrapeResultCache();
  if (normalized === 'all' || normalized === 'scrape' || normalized === 'scraperesponse') {
    valoraeScrapeResponseCache.clear();
    valoraeScrapeInFlight.clear();
    valoraeScrapeResponseCacheBytes = 0;
  }
  if (normalized === 'all' || normalized === 'news') { newsCache.clear(); newsInFlight.clear(); Object.keys(newsCacheMetrics).forEach(k => { newsCacheMetrics[k] = 0; }); }
  return { ok: true, scope: normalized, before, after: getValoraeRuntimeStats().caches, clearedAt: nowIso() };
}

export function runValoraeSelfTest() {
  const checks = [];
  const add = (name, ok, detail = {}) => checks.push({ name, ok: Boolean(ok), ...detail });
  add('ticker-validation', validarTicker('PETR4') === null && validarTicker('GARE11') === null && validarTicker('^BVSP') !== null);
  add('asset-type-units', inferAssetType('TAEE11') === 'ACAO' && inferAssetType('SANB11') === 'ACAO' && inferAssetType('GARE11') === 'FII');
  add('asset-type-etf', inferAssetType('BOVA11') === 'ETF');
  add('cache-stats', Boolean(getValoraeRuntimeStats()?.caches?.assetResult));
  add('performance-capabilities', Boolean(performanceCapabilities()?.profiles?.fast));
  add('engine-efficiency-module', buildEngineModuleTree({ summaryOnly: true }).length >= 6, { efficiencyVersion: VALORAE_ENGINE_EFFICIENCY_VERSION });
  add('indicator-taxonomy-module', Boolean(VALORAE_ASSET_INDICATOR_TAXONOMY_VERSION), { taxonomyVersion: VALORAE_ASSET_INDICATOR_TAXONOMY_VERSION });
  add('engine-maturity-booster-module', Boolean(VALORAE_ENGINE_MATURITY_BOOSTER_VERSION), { maturityVersion: VALORAE_ENGINE_MATURITY_BOOSTER_VERSION });
  add('field-consistency-guard-module', Boolean(VALORAE_FIELD_CONSISTENCY_GUARD_VERSION), { guardVersion: VALORAE_FIELD_CONSISTENCY_GUARD_VERSION });
  add('payload-budget-module', Boolean(VALORAE_PAYLOAD_BUDGET_VERSION), { budgetVersion: VALORAE_PAYLOAD_BUDGET_VERSION });
  add('asset-action-plan-module', Boolean(VALORAE_ASSET_ACTION_PLAN_VERSION), { actionPlanVersion: VALORAE_ASSET_ACTION_PLAN_VERSION });
  add('schema-version', typeof VALORAE_SCHEMA_VERSION === 'string' && VALORAE_SCHEMA_VERSION.length > 8, { schemaVersion: VALORAE_SCHEMA_VERSION });
  const failed = checks.filter(c => !c.ok);
  return { ok: failed.length === 0, version: VALORAE_ENGINE_VERSION, checks, failed, checkedAt: nowIso() };
}

export class ValoraeEngine {
  static version = VALORAE_ENGINE_VERSION;

  static cacheStats() {
    return getValoraeRuntimeStats();
  }

  static async fetchAtivo(rawTicker, rawType, options = {}) {
    options = resolvePerformanceOptions(options, { endpoint: 'asset', ticker: rawTicker, type: rawType });
    const ticker = canonicalizeTicker(rawTicker);
    const validation = validarTicker(ticker);
    if (validation) throw new Error(validation);
    const type = rawType || inferAssetType(ticker);
    const cacheEnabled = assetResultCacheEnabled(options);
    const key = cacheEnabled ? assetResultCacheKey(ticker, type, options) : '';

    let staleBackup = null;
    if (cacheEnabled) {
      const cached = assetResultCacheGet(key);
      if (cached) {
        cached.cacheStatus = 'RESULT_CACHE_HIT';
        cached.metrics = { ...(cached.metrics || {}), resultCache: 'HIT', resultCacheServedAt: nowIso(), performanceProfile: options.performanceProfile };
        return cached;
      }
      staleBackup = assetResultCacheGet(key, { allowStale: true });
      if (staleBackup && shouldServeStaleWhileRevalidate(options)) {
        const existingRefresh = assetResultInFlight.get(key);
        if (!existingRefresh) {
          const refreshPromise = ValoraeEngine._fetchAtivoUncached(ticker, type, { ...options, staleWhileRevalidate: false })
            .then(payload => {
              if (payload?.status !== 'ERROR') assetResultCacheSet(key, payload, Number(options.resultCacheTtlMs || ASSET_RESULT_CACHE_TTL_MS), Number(options.staleResultCacheMs || ASSET_RESULT_CACHE_STALE_MS));
              return payload;
            })
            .catch(() => null)
            .finally(() => assetResultInFlight.delete(key));
          assetResultInFlight.set(key, refreshPromise);
        } else {
          assetResultMetrics.inflightJoins += 1;
        }
        delete staleBackup.__cacheStale;
        staleBackup.cacheStatus = 'RESULT_CACHE_STALE_WHILE_REVALIDATE';
        staleBackup.warnings = uniq([...(staleBackup.warnings || []), 'Resposta stale servida imediatamente enquanto o VALORAE atualiza o ativo em segundo plano na instância quente.']);
        staleBackup.metrics = { ...(staleBackup.metrics || {}), resultCache: 'STALE_WHILE_REVALIDATE', resultCacheServedAt: nowIso(), staleWhileRevalidate: true, performanceProfile: options.performanceProfile };
        return staleBackup;
      }
      const inFlight = assetResultInFlight.get(key);
      if (inFlight) {
        assetResultMetrics.inflightJoins += 1;
        const payload = deepClone(await inFlight);
        payload.cacheStatus = 'RESULT_CACHE_COALESCED';
        payload.metrics = { ...(payload.metrics || {}), resultCache: 'COALESCED', resultCacheServedAt: nowIso(), performanceProfile: options.performanceProfile };
        return payload;
      }
    }

    const promise = ValoraeEngine._fetchAtivoUncached(ticker, type, options);
    if (cacheEnabled) assetResultInFlight.set(key, promise);
    try {
      const payload = await promise;
      if (cacheEnabled && payload?.status !== 'ERROR') assetResultCacheSet(key, payload, Number(options.resultCacheTtlMs || ASSET_RESULT_CACHE_TTL_MS), Number(options.staleResultCacheMs || ASSET_RESULT_CACHE_STALE_MS));
      payload.cacheStatus = cacheEnabled ? 'RESULT_CACHE_MISS' : 'RESULT_CACHE_BYPASS';
      payload.metrics = { ...(payload.metrics || {}), resultCache: payload.cacheStatus, resultCacheTtlMs: cacheEnabled ? Number(options.resultCacheTtlMs || ASSET_RESULT_CACHE_TTL_MS) : 0, staleResultCacheMs: Number(options.staleResultCacheMs || ASSET_RESULT_CACHE_STALE_MS), performanceProfile: options.performanceProfile };
      return payload;
    } catch (err) {
      if (staleBackup && options.staleIfError !== false) {
        delete staleBackup.__cacheStale;
        staleBackup.cacheStatus = 'RESULT_CACHE_STALE_IF_ERROR';
        staleBackup.warnings = uniq([...(staleBackup.warnings || []), `Resposta servida do cache stale por falha de atualização: ${err?.message || 'erro desconhecido'}`]);
        staleBackup.metrics = { ...(staleBackup.metrics || {}), resultCache: 'STALE_IF_ERROR', resultCacheServedAt: nowIso(), performanceProfile: options.performanceProfile };
        return staleBackup;
      }
      throw err;
    } finally {
      if (cacheEnabled) assetResultInFlight.delete(key);
    }
  }

  static async _fetchAtivoUncached(rawTicker, rawType, options = {}) {
    const started = performance.now();
    const ticker = canonicalizeTicker(rawTicker);
    const validation = validarTicker(ticker);
    if (validation) throw new Error(validation);
    const type = rawType || inferAssetType(ticker);
    const includeNews = options.includeNews === true || options.includeNews === '1';
    const mode = options.mode || 'super';
    const warnings = [];
    const sourcesTried = [];
    let parse = null;
    let htmlFetch = null;
    const runtimeProfiler = createEngineRuntimeProfiler({ ticker, type, view: options.view || 'full', profile: options.performanceProfile || options.profile || 'standard' });
    const yahooQuotePromise = (USE_YAHOO_FOR_CURRENT_QUOTE && options.useYahooFallback !== false)
      ? fetchYahooChart(ticker, options)
      : null;
    let statusInvestPrefetch = null;
    const statusInvestHedgePromise = shouldHedgeStatusInvest(options)
      ? fetchStatusInvestComplementHtml(ticker, type, options).catch(err => ({ ok: false, hedged: true, error: err?.message || 'statusinvest hedge failed' }))
      : null;
    let stageToken = runtimeProfiler.start('source.investidor10');

    const primaryUrls = investidor10Urls(ticker, type);
    if (!isProviderAvailable('Investidor10')) {
      const health = getProviderHealthSnapshot().Investidor10;
      warnings.push(`Investidor10 em cooldown temporário pelo circuit breaker; fallback será priorizado.`);
      sourcesTried.push({ name: 'Investidor10', provider: 'CircuitBreaker', status: 0, ok: false, blocked: false, error: 'Circuit breaker em cooldown', cooldownUntil: health?.cooldownUntil });
    } else {
      for (const url of primaryUrls) {
        const fetched = await fetchPublicHtml(url, {
          timeoutMs: options.timeoutMs,
          maxChars: options.maxHtmlChars,
          valoraeScrapeUrl: options.valoraeScrapeUrl,
          scrapeUrl: options.scrapeUrl,
          valoraeScrapeTimeoutMs: options.valoraeScrapeTimeoutMs,
          returnHtml: options.returnHtml !== false,
          includeScripts: options.returnHtml !== false,
          cache: options.cache !== false,
        });
        recordProviderResult('Investidor10', fetched.ok, { status: fetched.status, blocked: fetched.blocked, error: fetched.error });
        sourcesTried.push({ name: 'Investidor10', provider: fetched.provider, url, status: fetched.status, ok: fetched.ok, blocked: fetched.blocked, error: fetched.error, htmlLength: fetched.htmlLength, selectorResultKeys: fetched.selectorResultKeys, attempts: fetched.attempts });
        if (fetched.ok) {
          htmlFetch = fetched;
          if (fetched.html) {
            parse = parseInvestidor10Html(ticker, type, fetched.html, fetched.finalUrl || url);
            const selectorParse = parseSelectorResults(ticker, type, fetched.selectorResults || {});
            parse.results = mergeParsedResults(selectorParse.results, parse.results);
            parse.foundKeys = Object.keys(parse.results).filter(k => parse.results[k] !== undefined && parse.results[k] !== null && k !== 'sections');
          } else {
            const selectorParse = parseSelectorResults(ticker, type, fetched.selectorResults || {});
            if (selectorParse.foundKeys.length) {
              parse = { ...selectorParse, htmlBytesProcessed: 0, textBytesProcessed: 0, tableCount: 0, chartCandidateCount: 0, sourceUrl: fetched.finalUrl || url };
              warnings.push('ValoraeScrape retornou seletores sem HTML; resultado montado por seletores.');
            }
          }
          if (parse) break;
        }
      }
    }

    let adaptiveCompletionReport = { attempted: false, reason: 'not-needed' };
    if (needsAdaptiveCompletion(type, parse, options)) {
      const completion = await tryAdaptiveHtmlCompletion(ticker, type, primaryUrls, parse, options);
      adaptiveCompletionReport = completion.report;
      if (completion.parse && completion.parse !== parse) {
        parse = completion.parse;
        htmlFetch = completion.fetch || htmlFetch;
        if (completion.fetch) {
          sourcesTried.push({
            name: 'Investidor10AdaptiveCompletion',
            provider: completion.fetch.provider,
            url: completion.fetch.finalUrl || completion.fetch.url,
            status: completion.fetch.status,
            ok: completion.fetch.ok,
            blocked: completion.fetch.blocked,
            error: completion.fetch.error,
            htmlLength: completion.fetch.htmlLength,
            attempts: completion.fetch.attempts,
          });
        }
        warnings.push('Extração rápida ficaria PARTIAL; complemento adaptativo com HTML completo preencheu campos ausentes.');
      }
    }
    runtimeProfiler.end(stageToken, { urlsTried: primaryUrls.length, parsed: Boolean(parse), source: htmlFetch?.hostname || null, adaptiveCompletion: adaptiveCompletionReport });
    stageToken = runtimeProfiler.start('source.statusinvest');

    // StatusInvest é só fallback complementar, não substitui todas as seções do Investidor10.
    if (!parse && boolEnv('VALORAE_TRY_STATUSINVEST', true)) {
      if (!isProviderAvailable('StatusInvest')) {
        const health = getProviderHealthSnapshot().StatusInvest;
        sourcesTried.push({ name: 'StatusInvest', provider: 'CircuitBreaker', status: 0, ok: false, blocked: false, error: 'Circuit breaker em cooldown', cooldownUntil: health?.cooldownUntil });
      } else {
        if (!statusInvestPrefetch && statusInvestHedgePromise) statusInvestPrefetch = await statusInvestHedgePromise;
        const urls = statusInvestUrls(ticker, type);
        const candidates = [];
        if (statusInvestPrefetch) candidates.push({ url: statusInvestPrefetch.finalUrl || statusInvestPrefetch.url || urls[0], fetched: statusInvestPrefetch, prefetched: true });
        for (const url of urls) {
          const alreadyPrefetched = statusInvestPrefetch && String(statusInvestPrefetch.finalUrl || statusInvestPrefetch.url || '').includes(new URL(url).hostname);
          if (!alreadyPrefetched) candidates.push({ url, fetched: null, prefetched: false });
        }
        for (const candidate of candidates) {
          const url = candidate.url;
          const fetched = candidate.fetched || await fetchPublicHtml(url, {
            timeoutMs: options.timeoutMs,
            maxChars: Math.min(options.maxHtmlChars || DEFAULT_MAX_HTML_CHARS, 1_200_000),
            valoraeScrapeUrl: options.valoraeScrapeUrl,
            scrapeUrl: options.scrapeUrl,
            valoraeScrapeTimeoutMs: options.valoraeScrapeTimeoutMs,
            returnHtml: options.returnHtml !== false,
            includeScripts: options.returnHtml !== false,
            cache: options.cache !== false,
          });
          if (!candidate.prefetched) recordProviderResult('StatusInvest', fetched.ok, { status: fetched.status, blocked: fetched.blocked, error: fetched.error });
          sourcesTried.push({ name: candidate.prefetched ? 'StatusInvestHedgedFallback' : 'StatusInvest', provider: fetched.provider, url, status: fetched.status, ok: fetched.ok, blocked: fetched.blocked, error: fetched.error, htmlLength: fetched.htmlLength, selectorResultKeys: fetched.selectorResultKeys, attempts: fetched.attempts, prefetched: Boolean(candidate.prefetched || fetched.hedged) });
          if (fetched.ok && fetched.html) {
            htmlFetch = fetched;
            parse = parseInvestidor10Html(ticker, type, fetched.html, fetched.finalUrl || url);
            parse.sourceUrl = fetched.finalUrl || url;
            warnings.push('Dados estruturados vieram de fallback HTML; algumas seções específicas do Investidor10 podem não existir nessa fonte.');
            break;
          }
        }
      }
    }
    runtimeProfiler.end(stageToken, { attempted: !parse && boolEnv('VALORAE_TRY_STATUSINVEST', true), parsed: Boolean(parse), source: htmlFetch?.hostname || null });
    stageToken = runtimeProfiler.start('source.investidor10InternalApis');

    let results = parse?.results || {};
    let source = parse ? (htmlFetch?.hostname?.includes('statusinvest') ? `${htmlFetch?.provider || 'Fetch'}+StatusInvestHTML` : `${htmlFetch?.provider || 'Fetch'}+Investidor10HTML`) : 'None';

    if (parse && htmlFetch?.html && htmlFetch?.hostname?.includes('investidor10')) {
      const { apiExtras, apiWarnings } = await fetchInvestidor10ApiExtras(ticker, type, htmlFetch.html, options);
      if (apiExtras && Object.keys(apiExtras).length) {
        results = applyApiExtrasToResults(results, apiExtras, type);
        if (apiExtras.apiStatus?.length) source = `${source}+Investidor10InternalAPIs`;
      }
      warnings.push(...(apiWarnings || []));
    }
    runtimeProfiler.end(stageToken, { attempted: Boolean(parse && htmlFetch?.html && htmlFetch?.hostname?.includes('investidor10')), keys: Object.keys(results || {}).filter(k => k !== 'sections').length });
    stageToken = runtimeProfiler.start('source.yahoo');

    const hasUseful = Object.keys(results).filter(k => k !== 'sections').length > 0;
    let yahooQuote = null;
    if ((USE_YAHOO_FOR_CURRENT_QUOTE || !hasUseful) && options.useYahooFallback !== false) {
      yahooQuote = await (yahooQuotePromise || fetchYahooChart(ticker, options));
      recordProviderResult('YahooChart', yahooQuote.ok, { error: yahooQuote.error });
      if (yahooQuote.ok) {
        results = hasUseful ? applyYahooQuoteToResults(results, yahooQuote) : { ...results, ...yahooQuote.data };
        source = source === 'None' ? yahooQuote.source : `${source}+${yahooQuote.source}`;
        if (!hasUseful) warnings.push('Retorno parcial: cotação via Yahoo Chart; HTML completo não foi processado.');
      }
    }
    runtimeProfiler.end(stageToken, { attempted: (USE_YAHOO_FOR_CURRENT_QUOTE || !hasUseful) && options.useYahooFallback !== false, ok: Boolean(yahooQuote?.ok) });

    let statusInvestAnalysisPrimaryReport = { attempted: false, ok: false, usedKeys: [] };
    if (options.statusInvestComplement !== false && (options.complete === true || options.complete === '1' || shouldHedgeStatusInvest(options))) {
      if (!statusInvestPrefetch && statusInvestHedgePromise) statusInvestPrefetch = await statusInvestHedgePromise;
      if (statusInvestPrefetch?.ok && statusInvestPrefetch.html) {
        const parsedStatusInvest = parseInvestidor10Html(ticker, type, statusInvestPrefetch.html, statusInvestPrefetch.finalUrl || statusInvestPrefetch.url || statusInvestUrls(ticker, type)[0]);
        const processedStatusInvest = postProcessResultsByType(ticker, type, parsedStatusInvest.results || {});
        const statusMerge = mergeStatusInvestPrimaryForAnalysis(results, processedStatusInvest, type);
        if (statusMerge.usedKeys.length) {
          results = statusMerge.results;
          source = source === 'None' ? 'StatusInvestAnalysisPrimary' : `${source}+StatusInvestAnalysisPrimary`;
          warnings.push(`StatusInvest priorizado na Análise para campos de resumo/indicadores: ${statusMerge.usedKeys.slice(0, 8).join(', ')}${statusMerge.usedKeys.length > 8 ? '…' : ''}.`);
        }
        statusInvestAnalysisPrimaryReport = { attempted: true, ok: true, usedKeys: statusMerge.usedKeys, htmlLength: statusInvestPrefetch.htmlLength || statusInvestPrefetch.html.length };
      } else if (statusInvestPrefetch) {
        statusInvestAnalysisPrimaryReport = { attempted: true, ok: false, usedKeys: [], error: statusInvestPrefetch.error || 'StatusInvest indisponível' };
      }
    }

    stageToken = runtimeProfiler.start('source.statusinvestComplement');
    let statusInvestComplementReport = { attempted: false, reason: 'not-needed' };
    const complementNeed = !isExtractionCompleteEnough(type, results) || usefulResultKeys(results).length < completionTargetKeys(type);
    if (complementNeed && options.statusInvestComplement !== false) {
      if (!statusInvestPrefetch && statusInvestHedgePromise) statusInvestPrefetch = await statusInvestHedgePromise;
      const complement = await tryStatusInvestComplement(ticker, type, results, options, statusInvestPrefetch);
      statusInvestComplementReport = complement.report;
      if (complement.fetch) {
        sourcesTried.push({
          name: 'StatusInvestComplement',
          provider: complement.fetch.provider,
          url: complement.fetch.finalUrl || complement.fetch.url,
          status: complement.fetch.status,
          ok: complement.fetch.ok,
          blocked: complement.fetch.blocked,
          error: complement.fetch.error,
          htmlLength: complement.fetch.htmlLength,
          attempts: complement.fetch.attempts,
        });
      }
      if (complement.usedKeys?.length) {
        results = complement.results;
        source = source === 'None' ? 'StatusInvestComplement' : `${source}+StatusInvestComplement`;
        warnings.push(`Complemento StatusInvest preencheu campos ausentes: ${complement.usedKeys.slice(0, 8).join(', ')}${complement.usedKeys.length > 8 ? '…' : ''}.`);
      }
    }
    runtimeProfiler.end(stageToken, { attempted: Boolean(statusInvestComplementReport.attempted), ok: Boolean(statusInvestComplementReport.ok), usedKeys: statusInvestComplementReport.afterCompleteness?.presentCriticalFields?.length || 0 });
    stageToken = runtimeProfiler.start('postprocess.enrich');

    results = postProcessResultsByType(ticker, type, results);
    results = enrichAssetResults(ticker, type, results);
    let canonicalReliability = { used: false, appliedFields: [], snapshot: null, reliability: null, results };
    if (VALORAE_CANONICAL_DATA_ENABLED && options.canonicalData !== false && options.cvmCanonical !== false) {
      canonicalReliability = applyCanonicalReliabilityLayer(ticker, type, results, {
        richSourceSignals: sourcesTried.map(s => s.name || s.provider || s.url).filter(Boolean),
      });
      results = canonicalReliability.results;
      if (canonicalReliability.used) {
        sourcesTried.push({ name: 'CVMCanonicalLayer', provider: 'CVM/OpenData canonical cache', status: 200, ok: true, blocked: false, appliedFields: canonicalReliability.appliedFields });
        warnings.push(`Camada canônica CVM preencheu campos estáveis ausentes sem substituir Investidor10/StatusInvest: ${canonicalReliability.appliedFields.slice(0, 8).join(', ')}${canonicalReliability.appliedFields.length > 8 ? '…' : ''}.`);
      }
    }
    const foundKeysBeforeSnapshot = usefulResultKeys(results).length;
    const snapshotHydration = foundKeysBeforeSnapshot < completionTargetKeys(type) || !parse
      ? hydrateMissingResultsFromBestSnapshot(ticker, type, results, options)
      : { results, usedFields: [], snapshot: null };
    if (snapshotHydration.usedFields.length) {
      results = snapshotHydration.results;
      warnings.push(`Campos ausentes preenchidos com último snapshot real do ativo: ${snapshotHydration.usedFields.slice(0, 8).join(', ')}${snapshotHydration.usedFields.length > 8 ? '…' : ''}.`);
    }
    runtimeProfiler.end(stageToken, { keys: usefulResultKeys(results).length, beforeSnapshotKeys: foundKeysBeforeSnapshot, snapshotHydratedFields: snapshotHydration.usedFields.length });
    stageToken = runtimeProfiler.start('news.google');

    if (!parse) {
      const blocked = sourcesTried.find(s => s.blocked || s.status === 403 || s.status === 401 || s.status === 429);
      warnings.push(blocked ? `Scraping HTML indisponível ou bloqueado: ${blocked.error || 'HTTP ' + blocked.status}` : 'Scraping HTML indisponível.');
    }

    const aliases = [];
    if (results.nome) aliases.push(results.nome);
    if (/PETR/i.test(ticker)) aliases.push('Petrobras', 'Petróleo Brasileiro');
    if (/GARE/i.test(ticker)) aliases.push('Guardian Real Estate');
    const news = includeNews ? await fetchGoogleNews(ticker, aliases, Number(options.newsLimit || DEFAULT_NEWS_LIMIT), options) : undefined;
    runtimeProfiler.end(stageToken, { includeNews, ok: Boolean(news?.ok), items: Array.isArray(news?.items) ? news.items.length : 0 });
    stageToken = runtimeProfiler.start('payload.base');

    const foundKeys = Object.keys(results).filter(k => results[k] !== undefined && results[k] !== null && k !== 'sections');
    const htmlBytes = parse?.htmlBytesProcessed || 0;
    const targetKeyCount = completionTargetKeys(type);
    const finalCompletenessReport = buildExtractionCompletenessReport(type, results);
    const hasCompleteSnapshotHydration = snapshotHydration.usedFields.length > 0 && (foundKeys.length >= targetKeyCount || finalCompletenessReport.complete);
    const renderableByCanonicalBlocks = Boolean(canonicalReliability?.reliability?.renderableCore);
    const partial = !(hasCompleteSnapshotHydration || finalCompletenessReport.complete || foundKeys.length >= targetKeyCount || renderableByCanonicalBlocks);
    const status = partial ? 'PARTIAL' : 'OK';
    if (!foundKeys.length) warnings.push('Nenhuma fonte retornou dados úteis para este ticker.');

    const coverage = buildCoverage(type, results);
    const runtimeStats = getValoraeRuntimeStats();
    let payload = {
      schemaVersion: VALORAE_SCHEMA_VERSION,
      version: VALORAE_ENGINE_VERSION,
      status,
      partial,
      ticker,
      type,
      mode,
      results,
      cacheStatus: parse ? (htmlFetch?.html ? 'LIVE_HTML' : 'LIVE_SELECTOR') : 'ERROR',
      warnings: uniq(warnings),
      coverage,
      quality: buildQualityReport(type, results, coverage, uniq(warnings)),
      news: news?.items,
      newsStatus: includeNews ? { ok: Boolean(news?.ok), source: news?.source, code: news?.code, error: news?.error, empty: Boolean(news?.empty), count: Array.isArray(news?.items) ? news.items.length : 0, cacheStatus: news?.cacheStatus, stale: Boolean(news?.stale), fetchedAt: news?.fetchedAt, cachedAt: news?.cachedAt, reliability: news?.reliability, appPolicy: news?.appPolicy } : undefined,
      dataReliability: canonicalReliability.reliability,
      metrics: {
        engineVersion: VALORAE_ENGINE_VERSION,
        schemaVersion: VALORAE_SCHEMA_VERSION,
        totalTimeMs: Math.round(performance.now() - started),
        source,
        sourcesTried,
        htmlBytesProcessed: htmlBytes,
        textBytesProcessed: parse?.textBytesProcessed || 0,
        tableCount: parse?.tableCount || 0,
        chartCandidateCount: parse?.chartCandidateCount || 0,
        foundKeys,
        foundKeysCount: foundKeys.length,
        scrapeStatus: parse ? 'HTML_PARSED' : 'NO_HTML_DATA',
        scrapeError: !parse ? (sourcesTried.find(s => s.error)?.error || 'Sem HTML') : undefined,
        generatedAt: nowIso(),
        runtime: runtimeStats,
        performanceProfile: options.performanceProfile || options.profile || 'standard',
        performanceHints: options.performanceHints,
        extractionCompleteness: {
          version: '21.12.52-news-reliability-upgrade',
          strategy: 'cvm-canonical-foundation+progressive-cache-yahoo-html-statusinvest-snapshot',
          targetKeys: targetKeyCount,
          beforeSnapshotKeys: foundKeysBeforeSnapshot,
          afterSnapshotKeys: foundKeys.length,
          score: finalCompletenessReport.score,
          threshold: finalCompletenessReport.threshold,
          complete: finalCompletenessReport.complete,
          criticalFields: finalCompletenessReport,
          adaptiveCompletion: adaptiveCompletionReport,
          statusInvestComplement: statusInvestComplementReport,
          statusInvestAnalysisPrimary: statusInvestAnalysisPrimaryReport,
          statusInvestHedge: { enabled: Boolean(statusInvestHedgePromise), prefetched: Boolean(statusInvestPrefetch), ok: Boolean(statusInvestPrefetch?.ok), cache: statusInvestPrefetch?.cache || null, status: statusInvestPrefetch?.status || null },
          bestSnapshotHydration: snapshotHydration.usedFields.length ? {
            used: true,
            fields: snapshotHydration.usedFields,
            snapshotCapturedAt: snapshotHydration.snapshot?.capturedAt,
            snapshotSource: snapshotHydration.snapshot?.source,
            snapshotFoundKeysCount: snapshotHydration.snapshot?.foundKeysCount,
          } : { used: false },
          yahooPrefetch: Boolean(yahooQuotePromise),
          canonicalReliability: {
            version: VALORAE_CANONICAL_RELIABILITY_VERSION,
            enabled: VALORAE_CANONICAL_DATA_ENABLED && options.canonicalData !== false && options.cvmCanonical !== false,
            used: Boolean(canonicalReliability.used),
            appliedFields: canonicalReliability.appliedFields,
            renderableCore: Boolean(canonicalReliability.reliability?.renderableCore),
            globalState: canonicalReliability.reliability?.globalState,
          },
        },
        returnHtml: options.returnHtml !== false,
        internalApisEnabled: options.enableInternalApis !== false,
      },
      performance: {
        profile: options.performanceProfile || options.profile || 'standard',
        cachePolicy: options.cachePolicy || 'memory-lru-stale-if-error',
        hints: options.performanceHints,
        optimizations: {
          viewAwareChartSeriesBudget: true,
          singlePassResultCachePacking: true,
          freeTierSafe: true,
          turboCompletenessScore: true,
          statusInvestComplement: options.statusInvestComplement !== false,
          hedgedStatusInvest: Boolean(statusInvestHedgePromise),
          bestSnapshotHydration: options.useBestSnapshotFallback !== false && options.snapshotFallback !== false,
          canonicalCvmFoundation: VALORAE_CANONICAL_DATA_ENABLED && options.canonicalData !== false && options.cvmCanonical !== false,
          richProvidersPreserved: true,
        },
      },
    };
    runtimeProfiler.end(stageToken, { status, partial, foundKeys: foundKeys.length });
    stageToken = runtimeProfiler.start('contracts.coreQuality');
    payload = applyResilienceWarnings(payload);
    const assemblyPlan = resolveEngineAssemblyPlan(options);
    payload.metrics.engineAssembly = assemblyPlan;
    if (assemblyPlan.buildSchemaAudit) {
      payload.schemaStability = buildSchemaStability(payload);
      payload.validation = buildSchemaValidation(payload);
    }
    payload.sourceReport = buildSourceReport(payload);
    payload.quality = augmentQualityReport(payload);
    if (assemblyPlan.buildHeavyQualityMatrices) payload.fieldConfidence = buildFieldConfidence(payload);
    payload.valoraeScore = buildValoraeScore(payload);
    payload.normalized = buildUniversalNormalized(payload);
    payload.assetClassContract = buildAssetClassContract(payload);
    payload.assetIndicatorCoverage = analyzeAssetIndicatorCoverage(payload);
    payload.fieldConsistencyGuard = buildFieldConsistencyGuard(payload);
    if (assemblyPlan.buildHeavyQualityMatrices) {
      payload.dataQualityMatrix = buildAssetDataQualityMatrix(payload);
      payload.sourceReliability = buildSourceReliabilityMatrix(runtimeStats);
    }
    const chartSource = { ...(payload.results || {}), ...(payload.results?.sections || {}) };
    const resolvedView = resolvePayloadView(options.view || 'full');
    const chartSeriesLimit = resolveChartSeriesLimit(options);
    if (assemblyPlan.buildChartReadiness) payload.chartReadiness = buildChartReadinessReport(chartSource);
    payload.chartSeries = buildNormalizedChartSeries(chartSource, { maxSeries: chartSeriesLimit });
    payload.metrics.engineOptimizations = {
      version: VALORAE_ENGINE_EFFICIENCY_VERSION,
      payloadViewResolved: resolvedView.resolved,
      chartSeriesLimit,
      cacheSetStrategy: 'single-json-pass-size-and-clone',
      assemblyPlanMemoized: true,
      singleRuntimeStatsSnapshot: true,
      compactViewsUseLowerChartBudget: resolvedView.resolved === 'compact' || resolvedView.resolved === 'app',
      viewAwareChartSeriesBudget: true,
      appSynchronizedAssembly: true,
      assetClassContractVersion: VALORAE_ASSET_CLASS_CONTRACT_VERSION,
      assetIndicatorTaxonomyVersion: VALORAE_ASSET_INDICATOR_TAXONOMY_VERSION,
      engineMaturityBoosterVersion: VALORAE_ENGINE_MATURITY_BOOSTER_VERSION,
      fieldConsistencyGuardVersion: VALORAE_FIELD_CONSISTENCY_GUARD_VERSION,
      payloadBudgetVersion: VALORAE_PAYLOAD_BUDGET_VERSION,
      assetActionPlanVersion: VALORAE_ASSET_ACTION_PLAN_VERSION,
      engineRuntimeProfilerVersion: VALORAE_ENGINE_RUNTIME_PROFILER_VERSION,
      engineLaunchGateVersion: VALORAE_ENGINE_LAUNCH_GATE_VERSION,
      assemblyMode: assemblyPlan.mode,
      skippedRoots: assemblyPlan.skippedRootsWhenMobileOptimized,
    };
    payload.performance.optimizations = {
      ...(payload.performance.optimizations || {}),
      viewAwareContractAssembly: true,
      lightweightMobileContracts: assemblyPlan.mode === 'mobile-optimized',
      appRootsAlwaysBuilt: assemblyPlan.appRootsAlwaysBuilt,
    };
    runtimeProfiler.end(stageToken, { normalizedFields: Object.keys(payload.normalized || {}).filter(k => k !== '_meta').length, chartSeries: payload.chartSeries?.series?.length || 0 });
    stageToken = runtimeProfiler.start('contracts.app');
    payload.panelReadiness = buildPanelReadiness(payload);
    payload.consumerDiagnostics = assemblyPlan.buildConsumerDiagnostics
      ? buildConsumerDiagnostics(payload, runtimeStats)
      : buildLiteConsumerDiagnostics(payload);
    if (payload.results?.dividendos) payload.dividendStats = normalizeDividendHistory(payload.results.dividendos);
    if (payload.results?.dividendos && payload.consumerDiagnostics) payload.consumerDiagnostics.dataMap.dividendStatsReady = true;
    payload.appPayload = buildAppConsumerPayload(payload);
    payload.appRenderContract = assemblyPlan.buildFullRenderContract
      ? buildAppRenderContract(payload)
      : buildLiteAppRenderContract(payload);
    payload.appDataContract = buildAppDataContract(payload);
    payload.appSyncEnvelope = buildAppSyncEnvelope(payload);
    payload.appMobileSnapshot = buildAppMobileSnapshot(payload);
    payload = attachMobileAssetChartBundle(payload);
    payload.appResponseIntegrity = buildAppResponseIntegrity(payload);
    runtimeProfiler.end(stageToken, { appMetrics: payload.appPayload?.metrics?.count || 0, appCharts: payload.appPayload?.charts?.count || 0 });
    stageToken = runtimeProfiler.start('guardrails.final');
    // Guardrails finais para consumo: recalculados depois de appPayload/sync/integridade
    // para refletir exatamente o payload que será entregue ao app ou ao monitor.
    payload.fieldConsistencyGuard = buildFieldConsistencyGuard(payload);
    payload.payloadBudget = buildPayloadBudget(payload, { view: options.view || 'full' });
    payload.assetActionPlan = buildAssetActionPlan(payload);
    runtimeProfiler.end(stageToken, { fieldIssues: payload.fieldConsistencyGuard?.issueCounts?.total || 0, payloadState: payload.payloadBudget?.state });
    payload.engineEfficiency = buildEngineEfficiencyReport(payload, assemblyPlan, runtimeStats, options);
    if (snapshotHydration.usedFields.length) {
      payload.bestSnapshotHydration = {
        used: true,
        fields: snapshotHydration.usedFields,
        snapshotCapturedAt: snapshotHydration.snapshot?.capturedAt,
        snapshotSource: snapshotHydration.snapshot?.source,
        note: 'Campos vieram de último snapshot real em memória para evitar tela incompleta quando a fonte ao vivo falha.',
      };
    }
    if (payload.dataReliability) payload.metrics.dataReliability = payload.dataReliability;
    payload.metrics.bestSnapshotStored = assetBestSnapshotSet(ticker, type, payload);
    payload.engineRuntimeProfiler = runtimeProfiler.report(payload, assemblyPlan, runtimeStats, options);
    payload.engineMaturityBooster = buildEngineMaturityBooster(payload, assemblyPlan, runtimeStats, options);
    payload.engineLaunchGate = buildEngineLaunchGate(payload, { view: options.view || 'full' });
    if (assemblyPlan.buildDebugInfo) {
      payload.engineModuleTree = buildEngineModuleTree();
      payload.debug = buildDebugInfo(payload, { providerOrder: ['Investidor10', 'StatusInvest', 'YahooChart', 'GoogleNews'], includeRawHtml: false, providerHealth: getProviderHealthSnapshot() });
    }
    stageToken = runtimeProfiler.start('payload.view');
    payload = applyPayloadView(payload, options.view || 'full', { includeQuality: options.includeQuality !== false, includeDebug: assemblyPlan.buildDebugInfo });
    runtimeProfiler.end(stageToken, { resolvedView: payload.view || options.view || 'full', approximateBytes: (() => { try { return Buffer.byteLength(JSON.stringify(payload), 'utf8'); } catch { return 0; } })() });
    if (payload.engineRuntimeProfiler && typeof payload.engineRuntimeProfiler === 'object') {
      payload.engineRuntimeProfiler.postView = { view: payload.view, appliedAt: nowIso(), finalBytesApprox: (() => { try { return Buffer.byteLength(JSON.stringify(payload), 'utf8'); } catch { return 0; } })() };
    }
    return payload;
  }

  static async fetchAtivosBatch(tickers, options = {}) {
    options = resolvePerformanceOptions(options, { endpoint: 'assets', batchSize: Array.isArray(tickers) ? tickers.length : 0 });
    const started = performance.now();
    const maxConcurrency = Math.max(1, Math.min(Number(options.maxConcurrency || options.concurrency || intEnv('VALORAE_BATCH_CONCURRENCY', 4)), Number(options.maxConcurrencyHardLimit || 8)));
    const requestedQueue = tickers.map(canonicalizeTicker);
    const queue = VALORAE_BATCH_DEDUPE_ENABLED && options.dedupeBatch !== false
      ? [...new Set(requestedQueue)]
      : requestedQueue.slice();
    const byTicker = new Map();
    const errors = [];
    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const i = cursor++;
        const ticker = queue[i];
        try {
          const type = inferAssetType(ticker);
          const data = await ValoraeEngine.fetchAtivo(ticker, type, options);
          byTicker.set(ticker, data);
        } catch (err) {
          errors.push({ ticker, error: err?.message || 'Erro desconhecido' });
          if (options.continueOnError === false) throw err;
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(maxConcurrency, queue.length || 1) }, worker));
    const assets = requestedQueue.map(ticker => byTicker.get(ticker)).filter(Boolean);
    const cleanAssets = assets.filter(Boolean);
    const stats = {
      requested: requestedQueue.length,
      uniqueRequested: queue.length,
      deduped: Math.max(0, requestedQueue.length - queue.length),
      success: cleanAssets.filter(a => a.status === 'OK').length,
      partial: cleanAssets.filter(a => a.partial).length,
      failed: errors.length,
      durationMs: Math.round(performance.now() - started),
      maxConcurrency,
      cacheHits: cleanAssets.filter(a => /HIT/.test(String(a.cacheStatus || a.metrics?.resultCache || ''))).length,
      averageQualityScore: cleanAssets.length ? Math.round(cleanAssets.reduce((sum, a) => sum + Number(a.quality?.score || 0), 0) / cleanAssets.length) : 0,
      grades: cleanAssets.reduce((acc, a) => { const g = a.quality?.grade || 'NA'; acc[g] = (acc[g] || 0) + 1; return acc; }, {}),
      performanceProfile: options.performanceProfile || options.profile || 'portfolio',
      selectorOnly: options.returnHtml === false
    };
    return { version: VALORAE_ENGINE_VERSION, assets: cleanAssets, errors, stats };
  }

  static async fetchNews(ticker, aliases = [], options = {}) {
    return fetchGoogleNews(ticker, aliases, Number(options.limit || DEFAULT_NEWS_LIMIT), options);
  }

  static async scrapeUrl(url, options = {}) {
    return fetchPublicHtml(url, options);
  }
}

export default ValoraeEngine;
