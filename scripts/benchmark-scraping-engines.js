import { performance } from 'node:perf_hooks';
import { load as loadParse5 } from 'cheerio';
import { load as loadHtmlparser2 } from 'cheerio/slim';
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
  pageTitle: 'title',
  heading: 'h2',
  cards: '.asset-card',
  assets: '#assets',
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

function domExtract(load, selectors) {
  const $ = load(html, { xmlMode: false, scriptingEnabled: false }, true);
  const out = {};
  for (const [key, raw] of Object.entries(selectors)) {
    const spec = typeof raw === 'string' ? { selector: raw, extract: 'text' } : raw;
    const values = [];
    $(spec.selector).slice(0, Number(spec.limit || 200)).each((_index, element) => {
      const mode = spec.extract || 'text';
      if (mode === 'href' || mode === 'content') values.push(compact($(element).attr(mode) || ''));
      else if (mode === 'number') values.push(financialNumber($(element).text()));
      else if (mode === 'cells') values.push($(element).children('th,td').map((_i, cell) => compact($(cell).text())).get());
      else values.push(compact($(element).text()));
    });
    out[key] = values.filter(value => value !== '' && value !== null && value !== undefined);
  }
  return out;
}

function fingerprint(value) {
  return JSON.stringify(value, (_key, item) => typeof item === 'number' ? Number(item.toPrecision(12)) : item);
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
  const heapAfter = process.memoryUsage().heapUsed;
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

const parse5Expected = domExtract(loadParse5, complexSelectors);
const expectedFingerprint = fingerprint(parse5Expected);
const complex = [
  measure('cheerio-parse5', () => domExtract(loadParse5, complexSelectors), expectedFingerprint),
  measure('cheerio-htmlparser2', () => domExtract(loadHtmlparser2, complexSelectors), expectedFingerprint),
  measure('valorae-hybrid-adaptive', () => extractStandardHtmlSelectors(html, complexSelectors, { maxSelectors: 40, maxPerSelector: 200, parserMode: 'adaptive' }).results, expectedFingerprint),
  measure('valorae-hybrid-force-parse5', () => extractStandardHtmlSelectors(html, complexSelectors, { maxSelectors: 40, maxPerSelector: 200, parserMode: 'parse5' }).results, expectedFingerprint),
  measure('valorae-css-lite-legacy', () => extractCustomSelectors(html, complexSelectors, { maxSelectors: 40, maxPerSelector: 200 }).results),
];

const simpleExpected = extractFastSelectors(html, simpleSelectors, { maxSelectors: 40, maxPerSelector: 200 }).results;
const simple = [
  measure('valorae-single-pass-fast', () => extractFastSelectors(html, simpleSelectors, { maxSelectors: 40, maxPerSelector: 200 }).results, fingerprint(simpleExpected)),
  measure('cheerio-parse5-simple', () => domExtract(loadParse5, simpleSelectors)),
  measure('cheerio-htmlparser2-simple', () => domExtract(loadHtmlparser2, simpleSelectors)),
];

console.log(JSON.stringify({
  benchmark: 'valorae-scraping-engines',
  node: process.version,
  htmlBytes: Buffer.byteLength(html),
  rows,
  iterations,
  complex,
  simple,
}, null, 2));
