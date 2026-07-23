import assert from 'node:assert/strict';
import http from 'node:http';
import { fetch as undiciFetch } from 'undici';
import {
  VALORAE_HYBRID_DOCUMENT_HARDENING_VERSION,
  createLazyHtmlDocumentContext,
  buildHybridDocumentManifest,
} from '../lib/scrape/document-context.js';
import { extractStandardHtmlSelectors } from '../lib/scrape/standard-html-parser.js';
import {
  VALORAE_FETCH_HARDENING_VERSION,
  buildNativeRequestHeaders,
  detectResponseEncoding,
  readTextLimited,
} from '../lib/http/native-adaptive-fetch.js';
import { fetchText } from '../lib/sources/fetch.js';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

assert.equal(VALORAE_HYBRID_DOCUMENT_HARDENING_VERSION, '2026.07.17-checkpoint118-v1');
assert.equal(VALORAE_FETCH_HARDENING_VERSION, '2026.07.17-checkpoint118-v1');

const tableHtml = '<table><tr><td>Receita</td><td>10</td></tr></table>';
const tableSelectors = { rows: { selector: 'table > tbody > tr', extract: 'cells' } };
const tableContext = createLazyHtmlDocumentContext(tableHtml, { selectors: tableSelectors });
assert.equal(tableContext.preferredParser, 'parse5');
assert.equal(tableContext.decisionReason, 'selector-requires-browser-table-tree');
const tableResult = extractStandardHtmlSelectors(tableHtml, tableSelectors);
assert.deepEqual(tableResult.results.rows, [['Receita', '10']]);
assert.equal(tableResult.metrics.parserEngine, 'parse5');

const documentHtml = '<title>Valorae</title><main id="content">OK</main>';
const documentContext = createLazyHtmlDocumentContext(documentHtml, {
  selectors: { content: 'body > main#content' },
});
assert.equal(documentContext.preferredParser, 'parse5');
assert.equal(documentContext.decisionReason, 'selector-requires-implied-document-tree');

const ordinaryTable = createLazyHtmlDocumentContext(tableHtml, { selectors: { cells: 'td' } });
assert.equal(ordinaryTable.preferredParser, 'htmlparser2');
assert.equal(ordinaryTable.decisionReason, 'performance-safe-html');

const fosterParenting = createLazyHtmlDocumentContext('<table><div id="outside">x</div><tr><td>1</td></tr></table>');
assert.equal(fosterParenting.preferredParser, 'parse5');
assert.equal(fosterParenting.decisionReason, 'standards-sensitive-foster-parenting-content');

const legacyBytes = Buffer.from([0x43, 0x61, 0x66, 0xe9]);
assert.deepEqual(
  detectResponseEncoding(legacyBytes, 'text/html'),
  { encoding: 'windows-1252', source: 'invalid-utf8-text-fallback' },
);
const legacyDecoded = await readTextLimited(new Response(legacyBytes, {
  headers: { 'content-type': 'text/html' },
}));
assert.equal(legacyDecoded.text, 'Café');

const sanitized = buildNativeRequestHeaders('https://investidor10.com.br/', {
  Host: 'evil.example',
  Connection: 'close',
  'Proxy-Authorization': 'secret',
  'X-Valorae-Test': 'ok',
});
assert.equal(Object.keys(sanitized).some(key => key.toLowerCase() === 'host'), false);
assert.equal(Object.keys(sanitized).some(key => key.toLowerCase() === 'connection'), false);
assert.equal(Object.keys(sanitized).some(key => key.toLowerCase() === 'proxy-authorization'), false);
assert.equal(sanitized['X-Valorae-Test'], 'ok');

let unstableRequests = 0;
let observedHeaders = null;
const previousDisableExternal = process.env.VALORAE_DISABLE_EXTERNAL;
const previousGlobalFetch = globalThis.fetch;
process.env.VALORAE_DISABLE_EXTERNAL = '0';
globalThis.fetch = undiciFetch;
const server = http.createServer((request, response) => {
  if (request.url?.startsWith('/unstable')) {
    unstableRequests += 1;
    if (unstableRequests === 1) {
      response.writeHead(503, { 'content-type': 'text/html', 'retry-after': '0' });
      response.end('<html><body>temporariamente indisponível</body></html>');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('recuperado');
    return;
  }
  observedHeaders = request.headers;
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('headers-ok');
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
try {
  const unstableUrl = `${baseUrl}/unstable?checkpoint=118`;
  const failure = await fetchText(unstableUrl, { retries: 0, ttlMs: 60_000, staleMs: 60_000 });
  assert.equal(failure.status, 503);
  assert.equal(failure.cacheStatus, 'LIVE_ERROR');

  const recovered = await fetchText(unstableUrl, { retries: 0, ttlMs: 60_000, staleMs: 60_000 });
  assert.equal(recovered.status, 200);
  assert.equal(recovered.text, 'recuperado');
  assert.equal(recovered.cacheStatus, 'LIVE');
  assert.equal(unstableRequests, 2, 'a resposta 503 não pode envenenar o cache fresco');

  await fetchText(`${baseUrl}/headers?checkpoint=118`, {
    retries: 0,
    headers: { Connection: 'close', 'X-Valorae-Test': 'preserved' },
  });
  assert.notEqual(observedHeaders?.connection, 'close');
  assert.equal(observedHeaders?.['x-valorae-test'], 'preserved');
} finally {
  await new Promise(resolve => server.close(resolve));
  if (previousDisableExternal === undefined) delete process.env.VALORAE_DISABLE_EXTERNAL;
  else process.env.VALORAE_DISABLE_EXTERNAL = previousDisableExternal;
  globalThis.fetch = previousGlobalFetch;
}

const manifest = buildHybridDocumentManifest();
assert.equal(manifest.hardeningVersion, '2026.07.17-checkpoint118-v1');
assert.match(manifest.parserPolicy.selectorAwareStandardsFallback, /browser-document-table-and-form-tree/);
assert.equal(manifest.safety.non2xxResponsesAreNeverStoredAsFreshFetchCache, true);
assert.equal(manifest.safety.outboundHeadersAreSanitizedAfterFinalMerge, true);
assert.equal(manifest.safety.invalidUndeclaredUtf8FallsBackToWindows1252ForText, true);

const apkContract = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeScrapingEngine.kt');
const apkProtocol = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt');
const apkMetadataText = readSiblingApkFile('metadata.json');
if (apkContract !== null || apkProtocol !== null || apkMetadataText !== null) {
  assert.ok(apkContract?.includes(`HardeningVersion = "${VALORAE_HYBRID_DOCUMENT_HARDENING_VERSION}"`));
  assert.ok(apkContract?.includes('runtimeHardened'));
  assert.ok(apkContract?.includes('serverVersion.isNullOrBlank() || serverVersion == Version'));
  assert.ok(apkProtocol?.includes('ScrapingEngineHardeningVersion'));
  const apkMetadata = JSON.parse(apkMetadataText || '{}');
  assert.equal(apkMetadata.versionCode, 26072302);
  assert.equal(apkMetadata.proxyPatch, '21.12.382-quote-state-resilience-v350');
}

console.log('scraping-runtime-hardening-checkpoint118-v348 ok');
