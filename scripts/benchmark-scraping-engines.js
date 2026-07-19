import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { load as loadParse5 } from 'cheerio';
import { load as loadHtmlparser2 } from 'cheerio/slim';
import { selectAll } from 'css-select';
import { getText } from 'domutils';
import { parseDocument } from 'htmlparser2';
import { parse as parse5Parse } from 'parse5';
import { adapter as parse5Htmlparser2Adapter } from 'parse5-htmlparser2-tree-adapter';
import { extractCustomSelectors } from '../lib/scrape/custom-selectors.js';
import { extractFastSelectors } from '../lib/scrape/fast-selectors.js';
import { extractStandardHtmlSelectors } from '../lib/scrape/standard-html-parser.js';

const quick = process.argv.includes('--quick');
const rows = quick ? 900 : 3_600;
const iterations = quick ? 12 : 36;
const warmups = quick ? 3 : 8;

function buildFixture(count) {
  const body = [];
  for (let index = 0; index < count; index += 1) {
    const ticker = index % 2 === 0 ? 'PETR4' : 'GARE11';
    body.push(
      `<article class="asset-card" data-ticker="${ticker}">` +
      `<h2 class="asset-title">${ticker}</h2>` +
      `<span class="price">R$ ${(20 + index / 100).toFixed(2).replace('.', ',')}</span>` +
      `<a class="details" href="/ativos/${ticker.toLowerCase()}/${index}">Detalhes</a>` +
      `<table class="fundamentals"><tbody><tr data-row="dy"><th>DY</th><td>${(5 + index / 1000).toFixed(2)}%</td></tr></tbody></table>` +
      `</article>`,
    );
  }
  return `<!doctype html><html lang="pt-BR"><head>` +
    `<meta property="og:title" content="VALORAE benchmark"><title>VALORAE</title>` +
    `</head><body><main id="assets">${body.join('')}</main></body></html>`;
}

const html = buildFixture(rows);
const complexSelectors = {
  tickers: { selector: 'article.asset-card[data-ticker] h2.asset-title', extract: 'text', limit: 80 },
  prices: { selector: 'article.asset-card span.price', extract: 'number', limit: 80 },
  links: { selector: 'article.asset-card a.details', extract: 'href', limit: 80 },
  dyRows: { selector: 'table.fundamentals tr[data-row="dy"]', extract: 'cells', limit: 80 },
  title: { selector: 'title', extract: 'text', limit: 1 },
  ogTitle: { selector: 'meta[property="og:title"]', extract: 'content', limit: 1 },
  tickersAlias: { selector: 'article.asset-card[data-ticker] h2.asset-title', extract: 'text', limit: 80 },
  pricesAlias: { selector: 'article.asset-card span.price', extract: 'number', limit: 80 },
  linksAlias: { selector: 'article.asset-card a.details', extract: 'href', limit: 80 },
  dyRowsAlias: { selector: 'table.fundamentals tr[data-row="dy"]', extract: 'cells', limit: 80 },
};

const simpleSelectors = {
  pageTitle: { selector: 'title', extract: 'text', limit: 1 },
  headings: { selector: 'h2', extract: 'text', limit: 80 },
  links: { selector: 'a[href]', extract: 'href', limit: 80 },
};

function compact(value = '') {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function financialNumber(value = '') {
  const text = compact(value).replace(/[^0-9,.-]/g, '');
  if (!text) return null;
  return Number(text.replace(/\./g, '').replace(',', '.'));
}

function extractValue(nodes, spec, helpers) {
  const values = [];
  for (const element of nodes.slice(0, Number(spec.limit || 200))) {
    const mode = spec.extract || 'text';
    if (mode === 'href' || mode === 'content') values.push(compact(helpers.attribute(element, mode) || ''));
    else if (mode === 'number') values.push(financialNumber(helpers.text(element)));
    else if (mode === 'cells') values.push(helpers.children(element, 'th,td').map(cell => compact(helpers.text(cell))));
    else values.push(compact(helpers.text(element)));
  }
  return values.filter(value => value !== '' && value !== null && value !== undefined);
}

function cheerioExtract(load, selectors) {
  const $ = load(html, { xmlMode: false, scriptingEnabled: false }, true);
  const out = {};
  for (const [key, raw] of Object.entries(selectors)) {
    const spec = typeof raw === 'string' ? { selector: raw, extract: 'text' } : raw;
    const nodes = $(spec.selector).toArray();
    out[key] = extractValue(nodes, spec, {
      attribute: (element, name) => $(element).attr(name),
      text: element => $(element).text(),
      children: (element, selector) => $(element).children(selector).toArray(),
    });
  }
  return out;
}

function directExtract(parse, selectors) {
  const document = parse(html);
  const out = {};
  for (const [key, raw] of Object.entries(selectors)) {
    const spec = typeof raw === 'string' ? { selector: raw, extract: 'text' } : raw;
    const nodes = selectAll(spec.selector, document);
    out[key] = extractValue(nodes, spec, {
      attribute: (element, name) => element?.attribs?.[name],
      text: element => getText(element),
      children: (element, selector) => selectAll(`:scope > ${selector}`, element),
    });
  }
  return out;
}

function normalizeSimpleResult(result, selectors) {
  const normalized = {};
  for (const key of Object.keys(selectors)) {
    const value = result?.[key];
    const list = Array.isArray(value) ? value : value == null ? [] : [value];
    normalized[key] = [...new Set(list.map(item => typeof item === 'string' ? compact(item) : item))];
  }
  return normalized;
}

function fingerprint(value) {
  return JSON.stringify(value, (_key, item) => typeof item === 'number' ? Number(item.toPrecision(12)) : item);
}

function resultEnvelope(name, elapsedMs, result, heapBefore, heapAfter, expectedFingerprint = '') {
  const currentFingerprint = fingerprint(result);
  return {
    engine: name,
    iterations,
    totalMs: Number(elapsedMs.toFixed(2)),
    averageMs: Number((elapsedMs / iterations).toFixed(3)),
    operationsPerSecond: Number((iterations * 1000 / elapsedMs).toFixed(2)),
    heapDeltaKiB: Number(((heapAfter - heapBefore) / 1024).toFixed(1)),
    parityWithParse5: expectedFingerprint ? currentFingerprint === expectedFingerprint : null,
    resultBytes: Buffer.byteLength(currentFingerprint),
  };
}

function measure(name, run, expectedFingerprint = '') {
  for (let index = 0; index < warmups; index += 1) run();
  globalThis.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  let result;
  for (let index = 0; index < iterations; index += 1) result = run();
  const elapsedMs = performance.now() - started;
  globalThis.gc?.();
  return resultEnvelope(name, elapsedMs, result, heapBefore, process.memoryUsage().heapUsed, expectedFingerprint);
}

async function measureAsync(name, run, expectedFingerprint = '') {
  for (let index = 0; index < Math.min(2, warmups); index += 1) await run();
  globalThis.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  let result;
  for (let index = 0; index < iterations; index += 1) result = await run();
  const elapsedMs = performance.now() - started;
  globalThis.gc?.();
  return resultEnvelope(name, elapsedMs, result, heapBefore, process.memoryUsage().heapUsed, expectedFingerprint);
}

async function browserBenchmark(expectedFingerprint) {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch (error) {
    return { available: false, reason: `playwright-core indisponível: ${error?.code || error?.message || 'erro'}`, results: [] };
  }
  const candidates = [process.env.CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
  const executablePath = candidates.find(candidate => fs.existsSync(candidate));
  if (!executablePath) return { available: false, reason: 'Chromium não encontrado no ambiente de benchmark.', results: [] };
  const launchStarted = performance.now();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const startupMs = performance.now() - launchStarted;
    const page = await browser.newPage();
    const specs = Object.fromEntries(Object.entries(complexSelectors).map(([key, spec]) => [key, typeof spec === 'string' ? { selector: spec, extract: 'text' } : spec]));
    const run = async () => {
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      return page.evaluate((selectorSpecs) => {
        const compactBrowser = value => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        const financialBrowser = value => {
          const text = compactBrowser(value).replace(/[^0-9,.-]/g, '');
          return text ? Number(text.replace(/\./g, '').replace(',', '.')) : null;
        };
        const out = {};
        for (const [key, spec] of Object.entries(selectorSpecs)) {
          const values = [...document.querySelectorAll(spec.selector)].slice(0, Number(spec.limit || 200)).map(element => {
            const mode = spec.extract || 'text';
            if (mode === 'href' || mode === 'content') return compactBrowser(element.getAttribute(mode) || '');
            if (mode === 'number') return financialBrowser(element.textContent || '');
            if (mode === 'cells') return [...element.querySelectorAll(':scope > th, :scope > td')].map(cell => compactBrowser(cell.textContent || ''));
            return compactBrowser(element.textContent || '');
          }).filter(value => value !== '' && value !== null && value !== undefined);
          out[key] = values;
        }
        return out;
      }, specs);
    };
    const result = await measureAsync('playwright-chromium-dom', run, expectedFingerprint);
    await page.close();
    return {
      available: true,
      executablePath,
      startupMs: Number(startupMs.toFixed(2)),
      note: 'Inclui page.setContent e querySelectorAll; não inclui rede.',
      results: [result],
    };
  } catch (error) {
    return { available: false, reason: error?.message || 'Falha ao executar Chromium.', results: [] };
  } finally {
    await browser?.close().catch(() => {});
  }
}

const parse5Direct = selectors => directExtract(input => parse5Parse(input, { treeAdapter: parse5Htmlparser2Adapter, scriptingEnabled: false }), selectors);
const htmlparser2Direct = selectors => directExtract(input => parseDocument(input, { xmlMode: false, decodeEntities: true }), selectors);
const parse5Expected = parse5Direct(complexSelectors);
const expectedFingerprint = fingerprint(parse5Expected);

const complex = [
  measure('parse5-direct-css-select', () => parse5Direct(complexSelectors), expectedFingerprint),
  measure('htmlparser2-direct-css-select', () => htmlparser2Direct(complexSelectors), expectedFingerprint),
  measure('cheerio-parse5', () => cheerioExtract(loadParse5, complexSelectors), expectedFingerprint),
  measure('cheerio-htmlparser2', () => cheerioExtract(loadHtmlparser2, complexSelectors), expectedFingerprint),
  measure('valorae-hybrid-adaptive', () => extractStandardHtmlSelectors(html, complexSelectors, { maxSelectors: 40, maxPerSelector: 200, parserMode: 'adaptive' }).results, expectedFingerprint),
  measure('valorae-hybrid-force-parse5', () => extractStandardHtmlSelectors(html, complexSelectors, { maxSelectors: 40, maxPerSelector: 200, parserMode: 'parse5' }).results, expectedFingerprint),
  measure('valorae-css-lite-legacy', () => extractCustomSelectors(html, complexSelectors, { maxSelectors: 40, maxPerSelector: 200 }).results),
];

const simpleExpected = normalizeSimpleResult(parse5Direct(simpleSelectors), simpleSelectors);
const simpleFingerprint = fingerprint(simpleExpected);
const simple = [
  measure('parse5-direct-simple', () => normalizeSimpleResult(parse5Direct(simpleSelectors), simpleSelectors), simpleFingerprint),
  measure('htmlparser2-direct-simple', () => normalizeSimpleResult(htmlparser2Direct(simpleSelectors), simpleSelectors), simpleFingerprint),
  measure('cheerio-parse5-simple', () => normalizeSimpleResult(cheerioExtract(loadParse5, simpleSelectors), simpleSelectors), simpleFingerprint),
  measure('cheerio-htmlparser2-simple', () => normalizeSimpleResult(cheerioExtract(loadHtmlparser2, simpleSelectors), simpleSelectors), simpleFingerprint),
  measure('valorae-single-pass-fast', () => normalizeSimpleResult(extractFastSelectors(html, simpleSelectors, { maxSelectors: 40, maxPerSelector: 200 }).results, simpleSelectors), simpleFingerprint),
];

const browser = await browserBenchmark(expectedFingerprint);

console.log(JSON.stringify({
  benchmark: 'valorae-scraping-engines-v2',
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  htmlBytes: Buffer.byteLength(html),
  rows,
  iterations,
  warmups,
  complex,
  simple,
  browser,
}, null, 2));
