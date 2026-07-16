import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sendJson } from '../lib/core/http.js';
import { extractCustomSelectors } from '../lib/scrape/custom-selectors.js';
import { extractSelectors } from '../lib/scrape/selector-engine.js';
import {
  VALORAE_HTML_PARSER_IMPLEMENTATION,
  VALORAE_HTML_PARSER_SHADOW_POLICY,
  VALORAE_HTML_PARSER_SHADOW_VERSION,
  buildHtmlParserShadowManifest,
  compareHtmlParserResults,
  extractStandardHtmlSelectors,
  resetHtmlParserShadowMetricsForTests,
} from '../lib/scrape/standard-html-parser.js';
import { dispatchRoute, routeManifest } from '../routes/_router.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const malformedHtml = `
<!doctype html><html><body>
<table id="indicators"><tr class="indicator"><td>P/L<td>8,42</tr></table>
<section class="cards"><article class="card"><strong data-field="ticker">PETR4</strong></article></section>
</body></html>`;
const selectors = {
  row: { selector: '#indicators > tbody > tr.indicator', extract: 'cells' },
  ticker: { selector: '.cards > .card > strong[data-field="ticker"]', extract: 'text' },
  dataField: { selector: 'strong[data-field]', extract: 'attr:data-field' },
};

const legacy = extractCustomSelectors(malformedHtml, selectors);
const standard = extractStandardHtmlSelectors(malformedHtml, selectors);
assert.equal(standard.ok, true);
assert.deepEqual(standard.results.row, [['P/L', '8,42']]);
assert.deepEqual(standard.results.ticker, ['PETR4']);
assert.deepEqual(standard.results.dataField, ['ticker']);
assert.equal(legacy.results.row.length, 0, 'fixture deve reproduzir lacuna do parser regex');

const comparison = compareHtmlParserResults(legacy.results, standard.results, selectors);
assert.equal(comparison.lostKeyCount, 0);
assert.equal(comparison.gainedKeyCount, 1);
assert.equal(comparison.promotionSafe, true);
assert.ok(comparison.standardCoverage.percent > comparison.legacyCoverage.percent);

resetHtmlParserShadowMetricsForTests();
delete process.env.VALORAE_STANDARD_HTML_PARSER_MODE;
delete process.env.VALORAE_STANDARD_HTML_PARSER_ENABLED;
const shadow = extractSelectors(malformedHtml, selectors, { maxSelectors: 10, maxPerSelector: 10 }, { url: 'https://investidor10.com.br/acoes/petr4/' });
assert.deepEqual(shadow.results, legacy.results, 'modo sombra não pode alterar a saída financeira');
assert.equal(shadow.strategy, 'css-lite');
assert.equal(shadow.htmlParserShadow.ran, true);
assert.equal(shadow.htmlParserShadow.promoted, false);
assert.equal(shadow.htmlParserShadow.outputSource, 'legacy-preserved');
assert.equal(shadow.htmlParserShadow.comparison.gainedKeyCount, 1);

process.env.VALORAE_STANDARD_HTML_PARSER_MODE = 'prefer-standard';
const promoted = extractSelectors(malformedHtml, selectors, { maxSelectors: 10, maxPerSelector: 10 }, { url: 'https://investidor10.com.br/acoes/petr4/' });
assert.equal(promoted.strategy, 'standards-dom-promoted');
assert.deepEqual(promoted.results.row, [['P/L', '8,42']]);
assert.equal(promoted.htmlParserShadow.promoted, true);
delete process.env.VALORAE_STANDARD_HTML_PARSER_MODE;

const fast = extractSelectors('<h1>VALORAE</h1>', { title: 'h1' }, {}, {});
assert.deepEqual(fast.results.title, ['VALORAE']);
assert.equal(fast.strategy, 'single-pass');
assert.equal(fast.htmlParserShadow.ran, false);
assert.equal(fast.htmlParserShadow.reason, 'fast-path-preserved');

const manifest = buildHtmlParserShadowManifest();
assert.equal(manifest.version, VALORAE_HTML_PARSER_SHADOW_VERSION);
assert.equal(manifest.policyVersion, VALORAE_HTML_PARSER_SHADOW_POLICY);
assert.equal(manifest.implementation, VALORAE_HTML_PARSER_IMPLEMENTATION);
assert.equal(manifest.contractImpact, 'none');
assert.equal(manifest.compatibility, 'additive-hidden-from-ui');
assert.equal(manifest.mode, 'shadow');
assert.ok(routeManifest().routes.includes('/contract/html-parser-shadow'));

function mockResponse() {
  const headers = new Map();
  return {
    headers,
    response: {
      writableEnded: false,
      statusCode: 200,
      body: '',
      setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
      getHeader(name) { return headers.get(String(name).toLowerCase()); },
      removeHeader(name) { headers.delete(String(name).toLowerCase()); },
      end(value = '') { this.body = String(value); this.writableEnded = true; return this; },
      status(code) { this.statusCode = code; return this; },
      send(value) { return this.end(value); },
    },
  };
}

const direct = mockResponse();
sendJson({ method: 'GET', url: '/api/v1/ready', headers: {} }, direct.response, { status: 'OK' });
assert.equal(direct.headers.get('x-valorae-html-parser-shadow'), VALORAE_HTML_PARSER_SHADOW_VERSION);

const routed = mockResponse();
await dispatchRoute({ method: 'GET', url: '/api/v1/contract/html-parser-shadow', headers: { 'x-request-id': 'cp109-manifest' } }, routed.response);
const body = JSON.parse(routed.response.body || '{}');
assert.equal(routed.response.statusCode, 200);
assert.equal(body.version, VALORAE_HTML_PARSER_SHADOW_VERSION);
assert.equal(body.outputPolicy, 'legacy-output-always-preserved');
assert.equal(routed.headers.get('x-valorae-html-parser-shadow'), VALORAE_HTML_PARSER_SHADOW_VERSION);

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(packageJson.dependencies?.cheerio, '^1.2.0');
assert.ok(fs.existsSync(new URL('../package-lock.json', import.meta.url)));
assert.ok(fs.existsSync(new URL('../contracts/checkpoint109/html-parser-shadow.json', import.meta.url)));

const protocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const clientContract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeHtmlParserShadow.kt');
const clientHttp = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt');
if (protocol !== null || clientContract !== null || clientHttp !== null) {
  assert.ok(protocol?.includes('HeaderHtmlParserShadow'));
  assert.ok(protocol?.includes('HeaderHtmlParserShadowAccept'));
  assert.ok(clientContract?.includes(VALORAE_HTML_PARSER_SHADOW_VERSION));
  assert.ok(clientContract?.includes('hiddenFromUi'));
  assert.ok(clientHttp?.includes('standards-html-shadow-v1'));
}

console.log('html-parser-shadow-checkpoint109-v339 ok');
